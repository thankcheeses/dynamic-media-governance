import { describe, expect, it } from 'vitest'
import { clipFromUpload, isAudioFile, loudnessOf, peakOf } from '../soundUpload'

const sine = (amplitude: number, seconds = 1, rate = 8000) => Float32Array.from({ length: seconds * rate }, (_, i) => amplitude * Math.sin((2 * Math.PI * 440 * i) / rate))

describe('uploaded sound measurement', () => {
  it('estimates loudness from RMS with the BS.1770 offset and reports peak in dBFS', () => {
    // A sine at 0.2 peak has RMS 0.1414 (−17.0 dBFS); with the −0.691 offset that is about −17.7.
    expect(loudnessOf([sine(0.2)])).toBeCloseTo(-17.7, 0)
    expect(peakOf([sine(0.2)])).toBeCloseTo(-14, 0)
    // Two identical channels sum their mean squares (+3 dB), as the standard does.
    expect(loudnessOf([sine(0.2), sine(0.2)])).toBeCloseTo(-14.7, 0)
    expect(loudnessOf([new Float32Array(800)])).toBe(-70)
    expect(loudnessOf([])).toBe(-70)
    expect(peakOf([new Float32Array(10)])).toBe(-Infinity)
  })

  it('accepts audio files by type or extension', () => {
    expect(isAudioFile(new File([''], 'x.mp3', { type: 'audio/mpeg' }))).toBe(true)
    expect(isAudioFile(new File([''], 'x.m4a', { type: '' }))).toBe(true)
    expect(isAudioFile(new File([''], 'x.gif', { type: 'image/gif' }))).toBe(false)
  })

  it('builds a clip that must still be described, flagged as approximately measured', () => {
    const file = new File([new Uint8Array(16 * 1024)], 'air_horn-final.wav', { type: 'audio/wav' })
    const clip = clipFromUpload(file, { duration: 1.04, sampleRate: 8000, channels: [sine(0.2)] }, 'reaction', 'blob:test')
    expect(clip).toMatchObject({ name: 'air horn final', kind: 'reaction', duration: 1, sizeKb: 16, description: '', transcript: '', audioUrl: 'blob:test', approxLoudness: true, abuse: false, copyright: false, aiDeclared: false })
    expect(clip.lufs).toBeCloseTo(-17.7, 0)
    expect(clip.id).toMatch(/^upload-/)
  })
})
