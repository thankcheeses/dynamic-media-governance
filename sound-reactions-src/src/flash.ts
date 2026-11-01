/**
 * The flash arithmetic behind the header scan, kept free of the DOM so it can
 * be unit-tested and mirrored exactly by scripts/analyze-header.py.
 *
 * General flash: WCAG 2.2 SC 2.3.1, a change in relative luminance of 10% or
 * more where the darker state is below 0.80.
 *
 * Red flash: WCAG 2.2's working definition of "a pair of opposing transitions
 * involving a saturated red" (ISO 9241-391): one state has R/(R+G+B) >= 0.8 and
 * the two states differ by more than 0.2 in the CIE 1976 UCS chromaticity
 * diagram, Δ(u′,v′) = sqrt((u′1-u′2)² + (v′1-v′2)²).
 *
 * Both are evaluated per pixel; a transition only counts when it covers more
 * than 25% of a 10° field (21,824 px at the 1024×768 reference), and a flash is
 * a pair of opposing transitions. This is a screening aid, not a certified
 * photosensitive epilepsy analysis.
 */

export const LUM_DELTA = 0.1
export const DARK_MAX = 0.8
export const RED_RATIO = 0.8
export const CHROMA_DELTA = 0.2
export const REF_W = 1024
export const AREA_PX = 21824

/** sRGB channel (0–255) to linear light (0–1), as in WCAG's relative luminance. */
export const linear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const LIN = Float32Array.from({ length: 256 }, (_, i) => linear(i))

/** D65 white in u′v′; used for black, whose chromaticity is otherwise undefined. */
export const WHITE_UV: readonly [number, number] = [0.19784, 0.46834]

/** CIE 1976 UCS chromaticity (u′, v′) of a linear-light RGB triple. */
export function chromaticity(R: number, G: number, B: number): [number, number] {
  const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B
  const Z = 0.0193339 * R + 0.119192 * G + 0.9503041 * B
  const d = X + 15 * Y + 3 * Z
  if (d <= 1e-9) return [WHITE_UV[0], WHITE_UV[1]]
  return [4 * X / d, 9 * Y / d]
}

/** Saturated red by WCAG's rule, on 8-bit channels. */
export const isSaturatedRed = (r: number, g: number, b: number) => r / Math.max(r + g + b, 1e-6) >= RED_RATIO

export interface Sample {
  lum: Float32Array
  /** R/(R+G+B) per pixel, 0–1. */
  ratio: Float32Array
  u: Float32Array
  v: Float32Array
}

/** Per-pixel luminance, red ratio and chromaticity for one RGBA frame. */
export function sampleOf(data: Uint8ClampedArray | Uint8Array): Sample {
  const n = data.length / 4
  const lum = new Float32Array(n), ratio = new Float32Array(n), u = new Float32Array(n), v = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    const R = LIN[r], G = LIN[g], B = LIN[b]
    lum[i] = 0.2126 * R + 0.7152 * G + 0.0722 * B
    ratio[i] = r / Math.max(r + g + b, 1e-6)
    const [uu, vv] = chromaticity(R, G, B)
    u[i] = uu; v[i] = vv
  }
  return { lum, ratio, u, v }
}

/**
 * Direction of a red transition between two pixel states: +1 into saturated
 * red, -1 out of it, 0 if neither state is saturated red or the chromaticity
 * change is 0.2 or less.
 */
export function redStep(a: Sample, b: Sample, p: number): -1 | 0 | 1 {
  const aRed = a.ratio[p] >= RED_RATIO, bRed = b.ratio[p] >= RED_RATIO
  if (!aRed && !bRed) return 0
  const du = a.u[p] - b.u[p], dv = a.v[p] - b.v[p]
  if (Math.sqrt(du * du + dv * dv) <= CHROMA_DELTA) return 0
  if (bRed && !aRed) return 1
  if (aRed && !bRed) return -1
  return b.ratio[p] > a.ratio[p] ? 1 : -1
}

/** Transition direction per step (+1, -1, 0), counting only large-area changes; wraps to the first frame. */
export function transitions(samples: Sample[], scale: number) {
  const general: number[] = [], red: number[] = []
  let maxArea = 0
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i], b = samples[(i + 1) % samples.length]
    let up = 0, down = 0, rUp = 0, rDown = 0
    for (let p = 0; p < a.lum.length; p++) {
      const darker = Math.min(a.lum[p], b.lum[p])
      const d = b.lum[p] - a.lum[p]
      if (darker < DARK_MAX) { if (d >= LUM_DELTA) up++; else if (-d >= LUM_DELTA) down++ }
      const rs = redStep(a, b, p)
      if (rs > 0) rUp++; else if (rs < 0) rDown++
    }
    const step = up * scale > AREA_PX ? 1 : down * scale > AREA_PX ? -1 : 0
    general.push(step)
    if (step !== 0) maxArea = Math.max(maxArea, Math.max(up, down) / a.lum.length)
    red.push(rUp * scale > AREA_PX ? 1 : rDown * scale > AREA_PX ? -1 : 0)
  }
  return { general, red, maxArea }
}

/** Most flashes (pairs of opposing transitions) in any one-second window. */
export function maxFlashesPerSecond(steps: number[], durationsMs: number[]) {
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
