import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, SOUND_LIBRARY, VOICE_DEMO } from '../data'
import { runPreflight } from '../governance'

const clip = () => ({ ...SOUND_LIBRARY[0] })

describe('deterministic governance preflight', () => {
  it('passes a harmless described clip', () => { expect(runPreflight(clip(), DEFAULT_CONFIG).decision).toBe('PASS') })
  it('holds a clip with no transcript or description', () => {
    const result = runPreflight({ ...clip(), transcript: '', description: '' }, DEFAULT_CONFIG)
    expect(result.decision).toBe('REVIEW'); expect(result.reasonCodes).toContain('TRANSCRIPT_REVIEW')
  })
  it('blocks a 12-second reaction under the default duration policy', () => {
    expect(runPreflight({ ...clip(), duration: 12 }, DEFAULT_CONFIG).decision).toBe('BLOCK')
  })
  it('flips the duration decision when the threshold changes', () => {
    const config = { ...DEFAULT_CONFIG, durationLimit: 12 }
    expect(runPreflight({ ...clip(), duration: 12 }, config).decision).toBe('PASS')
  })
  it('allows a failure policy to be changed from BLOCK to REVIEW', () => {
    const config = { ...DEFAULT_CONFIG, policies: { ...DEFAULT_CONFIG.policies, duration: 'REVIEW' as const } }
    expect(runPreflight({ ...clip(), duration: 12 }, config).decision).toBe('REVIEW')
  })
  it('applies the separate 140-second voice-post limit', () => {
    expect(runPreflight({ ...VOICE_DEMO, duration: 12 }, DEFAULT_CONFIG).decision).toBe('PASS')
  })
  it('requires a label for declared AI audio', () => {
    expect(runPreflight({ ...clip(), aiDeclared: true, aiLabel: false }, DEFAULT_CONFIG).reasonCodes).toContain('SYNTHETIC_REVIEW')
  })
  it('enforces the configurable rate limit', () => {
    expect(runPreflight(clip(), DEFAULT_CONFIG, 5).reasonCodes).toContain('RATE_REVIEW')
  })
  it('labels abuse and copyright checks as simulated', () => {
    const result = runPreflight(clip(), DEFAULT_CONFIG)
    expect(result.checks.find((check) => check.key === 'abuse')?.simulated).toBe(true)
    expect(result.checks.find((check) => check.key === 'copyright')?.simulated).toBe(true)
  })
})

describe('dynamic header screening', () => {
  it('passes the measured three.js GIF', async () => {
    const { HEADER_PRESETS, scanHeader } = await import('../headers')
    const real = HEADER_PRESETS.find((p) => p.measured && p.media)!
    expect(real.fps).toBeLessThanOrEqual(15)
    expect(real.loopSeconds).toBeLessThanOrEqual(10)
    expect(real.sizeMB).toBeLessThanOrEqual(8)
    expect(scanHeader(real).decision).toBe('PASS')
  })
  it('scans every hosted GIF, the owner’s picks included, in the browser before it plays', async () => {
    const { HEADER_PRESETS } = await import('../headers')
    const owner = ['code-loop', 'paid-in-full'].map((id) => HEADER_PRESETS.find((p) => p.id === id)!)
    for (const preset of owner) {
      expect(preset.scanInBrowser).toBe(true)
      expect(preset.measured).toBeFalsy()
      expect(preset.hosted!.pageUrl).toMatch(/^https:\/\/(giphy|tenor)\.com\//)
      expect(preset.hosted!.gif).toMatch(/^https:\/\/media\d?\.(giphy|tenor)\.com\//)
    }
  })
  it('leaves unmeasured hosted picks to the browser scan, with a GIF and a still to scan from', async () => {
    const { HEADER_PRESETS } = await import('../headers')
    const picked = HEADER_PRESETS.filter((p) => p.scanInBrowser)
    expect(picked.length).toBeGreaterThanOrEqual(6)
    for (const preset of picked) {
      expect(preset.measured).toBeFalsy()
      expect(preset.hosted?.gif).toMatch(/^https:\/\/media\d?\.(giphy|tenor)\.com\//)
      if (preset.hosted?.provider === 'GIPHY') expect(preset.hosted.still).toMatch(/giphy_s\.gif$/)
    }
  })
  it('rejects an upload over the guardrails before scanning', async () => {
    const { headerPreset, scanHeader } = await import('../headers')
    expect(scanHeader(headerPreset('timelapse')).decision).toBe('REJECTED')
  })
  it('hard-blocks severe and red flashing, and holds moderate flashing provisionally', async () => {
    const { headerPreset, scanHeader } = await import('../headers')
    expect(scanHeader(headerPreset('strobe')).decision).toBe('BLOCK')
    expect(scanHeader(headerPreset('red-pulse')).decision).toBe('BLOCK')
    // WCAG 2.2 allows up to three red flashes a second, like general flashes.
    expect(scanHeader({ fps: 13, loopSeconds: 5.6, sizeMB: 1.6, flashesPerSecond: 3, redFlashesPerSecond: 2, flashArea: 0.25 }).decision).toBe('PASS')
    expect(scanHeader({ fps: 13, loopSeconds: 5.6, sizeMB: 1.6, flashesPerSecond: 0, redFlashesPerSecond: 4, flashArea: 0.3 }).decision).toBe('BLOCK')
    expect(scanHeader(headerPreset('confetti')).decision).toBe('PROVISIONAL')
  })
})

describe('header frame-rate rule', () => {
  it('transcodes a fast GIF down to 15 fps instead of rejecting it', async () => {
    const { scanHeader } = await import('../headers')
    const result = scanHeader({ fps: 20, loopSeconds: 1.5, sizeMB: 1.7, flashesPerSecond: 1, redFlashesPerSecond: 0 })
    expect(result.decision).toBe('PASS')
    expect(result.checks.find((c) => c.key === 'fps')?.detail).toMatch(/transcoded down to 15 fps/)
  })
  it('still rejects a file over the size or loop limit', async () => {
    const { scanHeader } = await import('../headers')
    expect(scanHeader({ fps: 12, loopSeconds: 14, sizeMB: 2, flashesPerSecond: 0, redFlashesPerSecond: 0 }).decision).toBe('REJECTED')
    expect(scanHeader({ fps: 12, loopSeconds: 6, sizeMB: 9.5, flashesPerSecond: 0, redFlashesPerSecond: 0 }).decision).toBe('REJECTED')
  })
})

describe('flash severity', () => {
  it('hard-blocks over-limit flashing across a large part of the header', async () => {
    const { scanHeader } = await import('../headers')
    expect(scanHeader({ fps: 10, loopSeconds: 2, sizeMB: 0.1, flashesPerSecond: 5, redFlashesPerSecond: 0, flashArea: 1 }).decision).toBe('BLOCK')
  })
  it('publishes small-area over-limit flashing provisionally', async () => {
    const { scanHeader } = await import('../headers')
    expect(scanHeader({ fps: 15, loopSeconds: 6, sizeMB: 3, flashesPerSecond: 4, redFlashesPerSecond: 0, flashArea: 0.08 }).decision).toBe('PROVISIONAL')
  })
  it('treats an unknown flash area as full-frame', async () => {
    const { scanHeader } = await import('../headers')
    expect(scanHeader({ fps: 15, loopSeconds: 6, sizeMB: 3, flashesPerSecond: 4, redFlashesPerSecond: 0 }).decision).toBe('BLOCK')
  })
})
