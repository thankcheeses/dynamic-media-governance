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
