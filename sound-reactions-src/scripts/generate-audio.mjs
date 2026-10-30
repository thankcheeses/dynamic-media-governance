// Build-time audio generation with ElevenLabs. Run:
//   NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/generate-audio.mjs [--check] [--only id,id]
// The SDK reads ELEVENLABS_API_KEY from the environment. The key is never
// written to disk by this script, never logged, and never reaches browser code:
// the app only ships the resulting MP3s from public/audio.
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { execFileSync, spawnSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { SOUNDS, VOICE } from './audio-catalog.mjs'

const OUT = new URL('../public/audio/', import.meta.url)
const RAW = new URL('../.audio-raw/', import.meta.url)
const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null

if (!process.env.ELEVENLABS_API_KEY) {
  console.error('ELEVENLABS_API_KEY is not set. Run with: node --env-file=.env.local scripts/generate-audio.mjs')
  process.exit(1)
}
const client = new ElevenLabsClient()

if (args.includes('--check')) {
  const sub = await client.user.subscription.get()
  console.log(JSON.stringify({ tier: sub.tier, characterCount: sub.characterCount, characterLimit: sub.characterLimit, status: sub.status }))
  process.exit(0)
}

mkdirSync(OUT, { recursive: true })
mkdirSync(RAW, { recursive: true })

async function save(stream, file) {
  const node = typeof stream.getReader === 'function' ? Readable.fromWeb(stream) : stream
  await pipeline(node, createWriteStream(file))
}

/** Level each clip with ffmpeg loudnorm and report measured loudness. */
/**
 * Max momentary loudness (400 ms window, EBU R128 "M"), the loudest moment of a
 * clip. For 1.5-4 s effects, integrated loudness averages in the gaps between
 * claps and underrates them; max momentary matches how loud the clip sounds.
 */
function measure(path) {
  const { stderr } = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true:framelog=info', '-f', 'null', '-'], { encoding: 'utf8' })
  let maxM = -Infinity
  for (const match of stderr.matchAll(/\bM:\s*(-?[\d.]+)/g)) maxM = Math.max(maxM, Number(match[1]))
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'))
  const peak = summary.match(/Peak:\s+(-?[\d.]+)\s+dBFS/)
  return { momentaryMax: Number.isFinite(maxM) ? Math.round(maxM * 10) / 10 : null, truePeak: peak ? Number(peak[1]) : null }
}

function master(rawPath, outPath, target) {
  // Apply exact gain toward the target, then limit at 4x sample rate (catches
  // inter-sample peaks) with headroom for MP3 overshoot.
  // Transient-heavy clips (claps) lose loudness in the limiter, so iterate:
  // measure the result and correct the remaining gap, up to 5 passes.
  const raw = measure(rawPath).momentaryMax
  let gain = raw === null ? 0 : target - raw
  let result = { momentaryMax: null, truePeak: null }
  for (let pass = 0; pass < 5; pass++) {
    gain = Math.max(-20, Math.min(30, gain))
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', rawPath, '-af', `volume=${gain.toFixed(2)}dB,aresample=176400,alimiter=limit=0.66:level=false:attack=1:release=50,aresample=44100`, '-ac', '1', '-b:a', '128k', outPath])
    result = measure(outPath)
    if (result.momentaryMax === null || Math.abs(target - result.momentaryMax) < 0.7) break
    gain += target - result.momentaryMax
  }
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', outPath]).toString().trim())
  const { momentaryMax, truePeak } = result
  return { duration: Math.round(duration * 10) / 10, sizeKb: Math.ceil(statSync(outPath).size / 1024), lufs: momentaryMax, truePeak, metric: 'max-momentary' }
}

const manifest = {}
const jobs = [...SOUNDS.map((s) => ({ ...s, type: 'sfx' })), { ...VOICE, type: 'voice' }].filter((j) => !only || only.includes(j.id))

for (const job of jobs) {
  const raw = new URL(`${job.id}.mp3`, RAW).pathname
  const out = new URL(`${job.id}.mp3`, OUT).pathname
  process.stdout.write(`${job.id} … `)
  try {
    if (!existsSync(raw)) {
      const audio = job.type === 'sfx'
        ? await client.textToSoundEffects.convert({ text: job.prompt, durationSeconds: job.seconds, promptInfluence: job.influence ?? 0.6, outputFormat: 'mp3_44100_128' })
        : await client.textToSpeech.convert(job.voiceId, { text: job.text, modelId: 'eleven_multilingual_v2', outputFormat: 'mp3_44100_128', voiceSettings: { stability: 0.45, similarityBoost: 0.75 } })
      await save(audio, raw)
    }
    // Speech sits a little below effects so a voice post never jumps out.
    manifest[job.id] = master(raw, out, job.type === 'voice' ? -16 : -15)
    console.log(JSON.stringify(manifest[job.id]))
  } catch (error) {
    if (existsSync(raw) && statSync(raw).size === 0) unlinkSync(raw)
    const status = error?.statusCode ?? error?.status ?? ''
    console.log(`FAILED ${status} ${String(error?.message ?? error).slice(0, 160)}`)
  }
}

const manifestPath = new URL('../src/audio-manifest.json', import.meta.url)
let previous = {}
try { previous = JSON.parse(readFileSync(manifestPath, 'utf8')) } catch { /* first run */ }
writeFileSync(manifestPath, JSON.stringify({ ...previous, ...manifest }, null, 2) + '\n')
console.log(`\nwrote ${Object.keys(manifest).length} clips`)
