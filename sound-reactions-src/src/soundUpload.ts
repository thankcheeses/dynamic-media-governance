/**
 * "Upload your own sound": a file the viewer picks is decoded and measured in
 * the browser, then goes through the same eight-check preflight as a library
 * sound or a recording. It stays in this tab as a blob: URL (session-only,
 * like microphone recordings) and is never uploaded anywhere.
 *
 * Decoding uses an OfflineAudioContext, which renders nothing and plays
 * nothing, so the rule that an AudioContext is only ever created inside a
 * click handler (src/audio.ts) is untouched.
 *
 * Loudness here is an approximation: the unweighted RMS of the whole clip in
 * dBFS, offset like BS.1770 (−0.691 dB). It is not K-weighted, not gated and
 * not EBU R128; the preflight labels it as approximate. The generated library
 * is the only audio with build-time ffmpeg measurements.
 */
import type { Clip, MediaKind } from './types'

export const SOUND_UPLOAD_LIMITS = {
  /** Largest file we will try to decode at all. */
  fileBytes: 25 * 1024 * 1024,
  /** Longest clip we will fully analyze; anything longer is reported by duration and blocked by the duration check anyway. */
  analyzeSeconds: 300,
}

const ACCEPTED = /^audio\//
const ACCEPTED_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|webm|flac|aiff?)$/i

export const isAudioFile = (file: File) => ACCEPTED.test(file.type) || ACCEPTED_EXT.test(file.name)

/** Approximate integrated loudness of decoded channels (see module note). Silence returns −70. */
export function loudnessOf(channels: Float32Array[]): number {
  if (channels.length === 0) return -70
  let sum = 0
  for (const ch of channels) {
    let acc = 0
    for (let i = 0; i < ch.length; i++) acc += ch[i] * ch[i]
    sum += ch.length ? acc / ch.length : 0
  }
  if (sum <= 1e-12) return -70
  return Math.max(-70, Math.round((-0.691 + 10 * Math.log10(sum)) * 10) / 10)
}

/** Peak sample level in dBFS. */
export function peakOf(channels: Float32Array[]): number {
  let peak = 0
  for (const ch of channels) for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a }
  return peak <= 1e-9 ? -Infinity : Math.round(20 * Math.log10(peak) * 10) / 10
}

export interface DecodedSound { duration: number; sampleRate: number; channels: Float32Array[] }

/** Builds the Clip for an uploaded file from its decoded audio. Description and transcript start empty: the person must write them. */
export function clipFromUpload(file: File, decoded: DecodedSound, kind: MediaKind, audioUrl: string): Clip {
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Uploaded sound'
  return {
    id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.length > 40 ? `${name.slice(0, 39)}…` : name,
    kind,
    duration: Math.round(decoded.duration * 10) / 10,
    description: '',
    transcript: '',
    emoji: kind === 'voice' ? '🎙️' : '🔊',
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    lufs: loudnessOf(decoded.channels),
    aiDeclared: false,
    aiLabel: false,
    abuse: false,
    copyright: false,
    audioUrl,
    approxLoudness: true,
  }
}

export interface SoundUpload { clip: Clip; peakDb: number; notes: string[] }

/** Decodes and measures a picked audio file in the browser. Throws a plain-language error for unusable files. */
export async function analyzeSoundFile(file: File, kind: MediaKind): Promise<SoundUpload> {
  if (!isAudioFile(file)) throw new Error('Choose an audio file (MP3, M4A, WAV, OGG or WebM)')
  if (file.size > SOUND_UPLOAD_LIMITS.fileBytes) throw new Error(`That file is ${(file.size / 1048576).toFixed(0)} MB; the most this prototype will read is ${SOUND_UPLOAD_LIMITS.fileBytes / 1048576} MB`)
  if (typeof OfflineAudioContext === 'undefined') throw new Error('This browser cannot decode audio here')
  const buffer = await file.arrayBuffer()
  let audio: AudioBuffer
  try {
    audio = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(buffer)
  } catch {
    throw new Error('That file could not be decoded as audio in this browser')
  }
  const notes: string[] = []
  const keep = Math.min(audio.length, Math.ceil(SOUND_UPLOAD_LIMITS.analyzeSeconds * audio.sampleRate))
  if (keep < audio.length) notes.push(`Only the first ${SOUND_UPLOAD_LIMITS.analyzeSeconds} seconds were measured.`)
  const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c).subarray(0, keep))
  const decoded: DecodedSound = { duration: audio.duration, sampleRate: audio.sampleRate, channels }
  const url = URL.createObjectURL(file)
  const clip = clipFromUpload(file, decoded, kind, url)
  const peakDb = peakOf(channels)
  notes.push('Loudness is approximate (unweighted RMS, measured in your browser), not EBU R128.')
  notes.push('The copyright check is SIMULATED: only use sounds you have the right to share.')
  return { clip, peakDb, notes }
}
