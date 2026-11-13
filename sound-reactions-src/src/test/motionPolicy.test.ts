import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../data'
import { headerPlayback, reduceMotion, richMotionAllowed, uiMotionAllowed } from '../motionPolicy'

const base = { style: 'video' as const, fps: 24, decision: 'PASS' as const, settings: DEFAULT_SETTINGS, osReduced: false, warningAccepted: false, userPaused: false, inView: true, scrolling: false, hidden: false }

describe('motion policy', () => {
  it('UI micro-motion needs a real browser and no reduce-motion from either source', () => {
    expect(uiMotionAllowed(DEFAULT_SETTINGS, false)).toBe(true)
    expect(uiMotionAllowed(DEFAULT_SETTINGS, null)).toBe(false)
    expect(uiMotionAllowed(DEFAULT_SETTINGS, true)).toBe(false)
    expect(uiMotionAllowed({ reducedMotion: true }, false)).toBe(false)
    expect(reduceMotion({ reducedMotion: false }, null)).toBe(false)
  })

  it('rich decorative motion is also off under low power and data saver', () => {
    expect(richMotionAllowed(DEFAULT_SETTINGS, false)).toBe(true)
    expect(richMotionAllowed({ ...DEFAULT_SETTINGS, lowPower: true }, false)).toBe(false)
    expect(richMotionAllowed({ ...DEFAULT_SETTINGS, dataSaver: true }, false)).toBe(false)
  })

  it.each([
    [{}, 'Playing at up to 15 fps', true, true],
    [{ fps: 12 }, 'Playing at up to 12 fps', true, true],
    [{ fps: 13.26 }, 'Playing at up to 13 fps', true, true],
    [{ settings: { ...DEFAULT_SETTINGS, reducedMotion: true } }, 'Showing a still frame because reduced motion is on', false, false],
    [{ osReduced: true }, 'Showing a still frame because reduced motion is on', false, false],
    [{ settings: { ...DEFAULT_SETTINGS, lowPower: true } }, 'Showing a still frame because low-power mode is on', false, false],
    [{ settings: { ...DEFAULT_SETTINGS, dataSaver: true } }, 'Showing a still frame because data saver is on', false, false],
    [{ style: 'strobe' as const }, 'Showing a still frame because Still frame only'.replace('Showing a still frame because ', ''), false, false],
    [{ decision: 'PROVISIONAL' as const }, 'Waiting behind its warning label', false, false],
    [{ decision: 'PROVISIONAL' as const, warningAccepted: true }, 'Playing at up to 15 fps', true, true],
    [{ userPaused: true }, 'Paused by you', false, true],
    [{ hidden: true }, 'Paused because the tab is hidden', false, true],
    [{ inView: false }, 'Paused because it is off-screen', false, true],
    [{ scrolling: true }, 'Paused while you scroll', false, true],
  ])('header rule table %j → %s', (patch, status, running, canPause) => {
    const out = headerPlayback({ ...base, ...patch })
    expect(out.status).toBe(status)
    expect(out.running).toBe(running)
    expect(out.canPause).toBe(canPause)
  })

  it('a still-only style never animates even when everything else allows it', () => {
    const out = headerPlayback({ ...base, style: 'redpulse' })
    expect(out.stillReason).toBe('Still frame only')
    expect(out.running).toBe(false)
  })
})
