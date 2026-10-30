/**
 * In-browser screening for a header a viewer uploads (GIF or short video).
 * Mirrors scripts/analyze-header.py: the same simplified WCAG 2.3.1 general
 * flash and red flash test, the same area rule and the same loop wrap.
 * It is a screening aid for the prototype, not a certified PEA tool.
 *
 * It also does the platform's transcode step: the file becomes a sequence of
 * frames at no more than 15 fps, cropped to the 3:1 header, with no audio.
 * Nothing leaves the browser.
 */
import { decompressFrames, parseGIF } from 'gifuct-js'
import { HEADER_LIMITS, type HeaderMeasurement } from './headers'

const LUM_DELTA = 0.1
const DARK_MAX = 0.8
const RED_RATIO = 0.8
const RED_DELTA = 20
const REF_W = 1024
const AREA_PX = 21824
const ANALYSIS_W = 480
const PLAYER_W = 600
const PLAYER_H = 200
/** Longest stretch we decode. Anything longer is rejected on loop length anyway. */
const MAX_DECODE_SECONDS = HEADER_LIMITS.loopSeconds + 2

export interface UploadedMedia {
  name: string
  /** Where the file came from: picked from the device, or from GIPHY. */
  source?: 'device' | 'giphy'
  sourceUrl?: string
  measurement: HeaderMeasurement
  kind: 'gif' | 'video'
  frames: ImageBitmap[]
  frameMs: number
  poster: string
}

export interface UploadAnalysis {
  measurement: HeaderMeasurement
  media: UploadedMedia
  notes: string[]
}

const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const LIN = Float32Array.from({ length: 256 }, (_, i) => lin(i))

interface Sample { lum: Float32Array; red: Float32Array }

function sampleOf(data: Uint8ClampedArray): Sample {
  const n = data.length / 4
  const lum = new Float32Array(n), red = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    const R = LIN[r], G = LIN[g], B = LIN[b]
    lum[i] = 0.2126 * R + 0.7152 * G + 0.0722 * B
    red[i] = r / Math.max(r + g + b, 1e-6) >= RED_RATIO ? (R - G - B) * 320 : 0
  }
  return { lum, red }
}

/** Transition direction per step (+1, -1, 0), counting only large-area changes. */
function transitions(samples: Sample[], scale: number) {
  const general: number[] = [], red: number[] = []
  let maxArea = 0
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i], b = samples[(i + 1) % samples.length]
    let up = 0, down = 0, rUp = 0, rDown = 0
    for (let p = 0; p < a.lum.length; p++) {
      const darker = Math.min(a.lum[p], b.lum[p])
      const d = b.lum[p] - a.lum[p]
      if (darker < DARK_MAX) { if (d >= LUM_DELTA) up++; else if (-d >= LUM_DELTA) down++ }
      const dr = b.red[p] - a.red[p]
      if (dr > RED_DELTA) rUp++; else if (dr < -RED_DELTA) rDown++
    }
    const step = up * scale > AREA_PX ? 1 : down * scale > AREA_PX ? -1 : 0
    general.push(step)
    if (step !== 0) maxArea = Math.max(maxArea, Math.max(up, down) / a.lum.length)
    red.push(rUp * scale > AREA_PX ? 1 : rDown * scale > AREA_PX ? -1 : 0)
  }
  return { general, red, maxArea }
}

/** Most flashes (pairs of opposing transitions) in any one-second window. */
function maxFlashesPerSecond(steps: number[], durationsMs: number[]) {
  const events: Array<[number, number]> = []
  let t = 0
  steps.forEach((s, i) => { if (s !== 0) events.push([t / 1000, s]); t += durationsMs[i] })
  let best = 0
  for (const [start] of events) {
    const window = events.filter(([at]) => at >= start && at < start + 1).map(([, s]) => s)
    let opposing = 0
    for (let i = 1; i < window.length; i++) if (window[i] !== window[i - 1]) opposing++
    best = Math.max(best, window.length ? Math.floor((opposing + 1) / 2) : 0)
  }
  return best
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is unavailable in this browser')
  return { c, ctx }
}

/** Center-crop a source to the 3:1 header and scale it to the player size. */
function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number) {
  const target = PLAYER_W / PLAYER_H
  let cw = sw, ch = sw / target
  if (ch > sh) { ch = sh; cw = sh * target }
  ctx.clearRect(0, 0, PLAYER_W, PLAYER_H)
  ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, PLAYER_W, PLAYER_H)
}

interface Decoded { full: Array<{ source: CanvasImageSource; ms: number }>; width: number; height: number; totalMs: number }

async function decodeGif(file: File): Promise<Decoded> {
  const gif = parseGIF(await file.arrayBuffer())
  const parts = decompressFrames(gif, true)
  const width = gif.lsd.width, height = gif.lsd.height
  const { c: stage, ctx } = canvas(width, height)
  const full: Decoded['full'] = []
  let totalMs = 0
  let previous: ImageData | null = null
  for (const part of parts) {
    // Browsers treat very short GIF delays as 100 ms; do the same.
    const ms = part.delay && part.delay > 10 ? part.delay : 100
    if (totalMs >= MAX_DECODE_SECONDS * 1000) { totalMs += ms; continue }
    if (part.disposalType === 3) previous = ctx.getImageData(0, 0, width, height)
    const patch = new ImageData(new Uint8ClampedArray(part.patch), part.dims.width, part.dims.height)
    const { c: tmp, ctx: tctx } = canvas(part.dims.width, part.dims.height)
    tctx.putImageData(patch, 0, 0)
    ctx.drawImage(tmp, part.dims.left, part.dims.top)
    const snapshot = await createImageBitmap(stage)
    full.push({ source: snapshot, ms })
    totalMs += ms
    if (part.disposalType === 2) ctx.clearRect(part.dims.left, part.dims.top, part.dims.width, part.dims.height)
    else if (part.disposalType === 3 && previous) ctx.putImageData(previous, 0, 0)
  }
  return { full, width, height, totalMs }
}

async function decodeVideo(file: File): Promise<Decoded> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = url
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('This video format can’t be read in this browser'))
    })
    const duration = video.duration
    const width = video.videoWidth, height = video.videoHeight
    const step = 1000 / HEADER_LIMITS.fps
    const full: Decoded['full'] = []
    // The platform serves headers at 15 fps, so sample what would be served.
    for (let t = 0; t < Math.min(duration, MAX_DECODE_SECONDS) * 1000; t += step) {
      video.currentTime = t / 1000
      await new Promise<void>((resolve) => { video.onseeked = () => resolve() })
      full.push({ source: await createImageBitmap(video), ms: step })
    }
    return { full, width, height, totalMs: duration * 1000 }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function analyzeUpload(file: File, origin?: { source: 'device' | 'giphy'; sourceUrl?: string }): Promise<UploadAnalysis> {
  const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name)
  const isVideo = file.type.startsWith('video/')
  if (!isGif && !isVideo) throw new Error('Choose a GIF or a video file (MP4, WebM or MOV)')
  const decoded = isGif ? await decodeGif(file) : await decodeVideo(file)
  if (decoded.full.length === 0) throw new Error('No frames could be read from this file')

  // Flash analysis on the full, uncropped frames at a small working size.
  const aw = Math.min(ANALYSIS_W, decoded.width)
  const ah = Math.max(1, Math.round(decoded.height * (aw / decoded.width)))
  const { ctx: actx } = canvas(aw, ah)
  const samples = decoded.full.map(({ source }) => { actx.drawImage(source, 0, 0, aw, ah); return sampleOf(actx.getImageData(0, 0, aw, ah).data) })
  const durations = decoded.full.map((f) => f.ms)
  const { general, red, maxArea } = transitions(samples, (REF_W / aw) ** 2)
  const flashesPerSecond = maxFlashesPerSecond(general, durations)
  const redFlashes = maxFlashesPerSecond(red, durations)

  const loopSeconds = Math.round(decoded.totalMs / 10) / 100
  const nativeFps = isGif ? Math.round((decoded.full.length / (Math.min(decoded.totalMs, MAX_DECODE_SECONDS * 1000) / 1000)) * 100) / 100 : HEADER_LIMITS.fps
  const measurement: HeaderMeasurement = {
    fps: nativeFps,
    loopSeconds,
    sizeMB: Math.round((file.size / 1048576) * 100) / 100,
    flashesPerSecond,
    redFlash: redFlashes > 0,
    flashArea: Math.round(maxArea * 100) / 100,
  }

  // Transcode: resample to at most 15 fps and crop to 3:1 for the player.
  const outFps = Math.min(HEADER_LIMITS.fps, nativeFps)
  const frameMs = 1000 / outFps
  const playable = Math.min(decoded.totalMs, HEADER_LIMITS.loopSeconds * 1000)
  const { c: pc, ctx: pctx } = canvas(PLAYER_W, PLAYER_H)
  const frames: ImageBitmap[] = []
  const starts: number[] = []; let acc = 0
  for (const f of decoded.full) { starts.push(acc); acc += f.ms }
  for (let t = 0; t < playable; t += frameMs) {
    let idx = starts.findIndex((s, i) => t >= s && (i === starts.length - 1 || t < starts[i + 1]))
    if (idx < 0) idx = decoded.full.length - 1
    drawCover(pctx, decoded.full[idx].source, decoded.width, decoded.height)
    frames.push(await createImageBitmap(pc))
  }
  drawCover(pctx, decoded.full[0].source, decoded.width, decoded.height)
  const poster = pc.toDataURL('image/jpeg', 0.85)
  decoded.full.forEach((f) => (f.source as ImageBitmap).close?.())

  const notes: string[] = []
  if (isVideo) notes.push(`Video: analyzed as served, at ${HEADER_LIMITS.fps} fps with the audio removed.`)
  else if (nativeFps > HEADER_LIMITS.fps) notes.push(`Your GIF runs at ${nativeFps} fps; the header plays it at ${HEADER_LIMITS.fps} fps.`)
  if (decoded.totalMs > MAX_DECODE_SECONDS * 1000) notes.push(`Only the first ${MAX_DECODE_SECONDS} seconds were analyzed.`)

  return { measurement, media: { name: file.name, ...origin, measurement, kind: isGif ? 'gif' : 'video', frames, frameMs, poster }, notes }
}
