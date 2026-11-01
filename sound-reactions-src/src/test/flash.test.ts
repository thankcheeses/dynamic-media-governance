import { describe, expect, it } from 'vitest'
import { chromaticity, isSaturatedRed, linear, maxFlashesPerSecond, redStep, sampleOf, transitions, WHITE_UV, REF_W, type Sample } from '../flash'

/** A uniform w×h RGBA frame. */
function frame(w: number, h: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) { data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255 }
  return data
}
const one = (rgb: [number, number, number]): Sample => sampleOf(frame(1, 1, rgb))

describe('CIE 1976 UCS chromaticity', () => {
  it('puts sRGB white at D65 and sRGB red where WCAG/ISO 9241-391 expect it', () => {
    const [uw, vw] = chromaticity(1, 1, 1)
    expect(uw).toBeCloseTo(WHITE_UV[0], 3)
    expect(vw).toBeCloseTo(WHITE_UV[1], 3)
    const [ur, vr] = chromaticity(1, 0, 0)
    expect(ur).toBeCloseTo(0.4507, 3)
    expect(vr).toBeCloseTo(0.5229, 3)
  })
  it('treats black as achromatic rather than undefined', () => {
    expect(chromaticity(0, 0, 0)).toEqual([WHITE_UV[0], WHITE_UV[1]])
  })
  it('linearises sRGB the WCAG way', () => {
    expect(linear(0)).toBe(0)
    expect(linear(255)).toBeCloseTo(1, 6)
    expect(linear(128)).toBeCloseTo(0.2158, 3)
  })
})

describe('red transition rule', () => {
  it('needs one saturated-red state and a chromaticity change above 0.2', () => {
    const red = one([255, 0, 0]), black = one([0, 0, 0]), white = one([255, 255, 255])
    const darkRed = one([128, 0, 0]), green = one([0, 255, 0]), orange = one([255, 128, 0])
    expect(isSaturatedRed(255, 0, 0)).toBe(true)
    expect(isSaturatedRed(255, 128, 0)).toBe(false)
    expect(redStep(black, red, 0)).toBe(1)   // into red
    expect(redStep(red, black, 0)).toBe(-1)  // out of red
    expect(redStep(red, white, 0)).toBe(-1)
    expect(redStep(red, darkRed, 0)).toBe(0) // same chromaticity, only brightness changed
    expect(redStep(green, black, 0)).toBe(0) // no red involved
    expect(redStep(red, orange, 0)).toBe(0)  // orange is close to red in u′v′
  })
})

describe('flash counting', () => {
  const W = 64, H = 64
  const scale = (REF_W / W) ** 2
  it('counts a full-frame red pulse at 15 fps as more than three red flashes a second', () => {
    const red = sampleOf(frame(W, H, [255, 0, 0])), black = sampleOf(frame(W, H, [0, 0, 0]))
    const samples = Array.from({ length: 15 }, (_, i) => (i % 2 ? red : black))
    const durations = samples.map(() => 1000 / 15)
    const { general, red: redSteps } = transitions(samples, scale)
    expect(maxFlashesPerSecond(redSteps, durations)).toBeGreaterThan(3)
    expect(maxFlashesPerSecond(general, durations)).toBeGreaterThan(3)
  })
  it('does not count a slow fade or a brightness-only red change as red flashes', () => {
    const red = sampleOf(frame(W, H, [255, 0, 0])), darkRed = sampleOf(frame(W, H, [96, 0, 0]))
    const samples = Array.from({ length: 15 }, (_, i) => (i % 2 ? red : darkRed))
    const durations = samples.map(() => 1000 / 15)
    const { red: redSteps } = transitions(samples, scale)
    expect(maxFlashesPerSecond(redSteps, durations)).toBe(0)
  })
  it('ignores transitions that cover too little of the field', () => {
    const red = frame(W, H, [0, 0, 0]); for (let i = 0; i < 4; i++) red[i * 4] = 255 // four red pixels
    const samples = [sampleOf(frame(W, H, [0, 0, 0])), sampleOf(red), sampleOf(frame(W, H, [0, 0, 0])), sampleOf(red)]
    const { red: redSteps } = transitions(samples, scale)
    expect(redSteps.every((s) => s === 0)).toBe(true)
  })
})
