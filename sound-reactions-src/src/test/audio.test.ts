import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAudioController, type AudioDeps } from '../audio'
import { DEFAULT_SETTINGS, SOUND_LIBRARY } from '../data'

/** The smallest Web Audio graph the controller touches, recording what was started and stopped. */
class FakeParam { value = 0; setValueAtTime = vi.fn(); exponentialRampToValueAtTime = vi.fn(); setTargetAtTime = vi.fn() }
class FakeNode { connect = vi.fn(); disconnect = vi.fn(); gain = new FakeParam(); frequency = new FakeParam(); type = ''; threshold = new FakeParam(); knee = new FakeParam(); ratio = new FakeParam(); attack = new FakeParam(); release = new FakeParam(); buffer: unknown = null; onended: (() => void) | null = null; fftSize = 0; smoothingTimeConstant = 0; frequencyBinCount = 32; getByteFrequencyData = vi.fn() }
class FakeSource extends FakeNode {
  started = false; stopped = false
  start() { this.started = true }
  stop() { this.stopped = true }
}
class FakeContext {
  state: 'suspended' | 'running' = 'suspended'
  currentTime = 0
  sampleRate = 48000
  destination = new FakeNode()
  sources: FakeSource[] = []
  createGain() { return new FakeNode() }
  createAnalyser() { return new FakeNode() }
  createDynamicsCompressor() { return new FakeNode() }
  createBiquadFilter() { return new FakeNode() }
  private source() { const node = new FakeSource(); this.sources.push(node); return node }
  createOscillator() { return this.source() }
  createBufferSource() { return this.source() }
  createBuffer(_c: number, length: number) { return { getChannelData: () => new Float32Array(length) } }
  resume() { this.state = 'running'; return Promise.resolve() }
  suspend() { this.state = 'suspended'; return Promise.resolve() }
  decodeAudioData() { return Promise.reject(new Error('no decoder in tests')) }
}

let context: FakeContext
let deps: AudioDeps & { audit: ReturnType<typeof vi.fn<AudioDeps['audit']>>; notify: ReturnType<typeof vi.fn<AudioDeps['notify']>> }
const synth = (id: string) => ({ ...SOUND_LIBRARY[0], id, audioUrl: undefined })
// The controller constructs its own context; hand it the test's shared instance so the test can read the graph.
const SharedContext = function () { return context } as unknown as typeof AudioContext

beforeEach(() => {
  vi.useFakeTimers()
  context = new FakeContext()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  deps = { audit: vi.fn<AudioDeps['audit']>(), notify: vi.fn<AudioDeps['notify']>(), contextClass: () => SharedContext }
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('audio controller policy', () => {
  it('starting a second clip stops the first (one stream at a time)', async () => {
    const controller = createAudioController(deps)
    await controller.play(synth('a'))
    const firstSources = [...context.sources]
    expect(firstSources.length).toBeGreaterThan(0)
    await controller.play(synth('b'))
    expect(firstSources.every((s) => s.stopped)).toBe(true)
    expect(controller.getSnapshot()).toMatchObject({ clipId: 'b', status: 'playing' })
    expect(deps.audit).toHaveBeenCalledTimes(2)
  })

  it('low-power mode stops what is playing and refuses the next play', async () => {
    const controller = createAudioController(deps)
    await controller.play(synth('a'))
    controller.applySettings({ ...DEFAULT_SETTINGS, lowPower: true })
    expect(controller.getSnapshot()).toMatchObject({ clipId: null, status: 'idle', message: 'Paused because low-power mode is on' })
    await controller.play(synth('b'))
    expect(controller.getSnapshot().status).toBe('idle')
    expect(deps.notify).toHaveBeenCalledWith(expect.stringMatching(/Low-power mode is on/))
    expect(deps.audit).toHaveBeenCalledTimes(1)
  })

  it('a hidden tab stops playback', async () => {
    const controller = createAudioController(deps)
    const listeners: Array<() => void> = []
    const doc = { hidden: false, addEventListener: (_: string, cb: () => void) => { listeners.push(cb) }, removeEventListener: vi.fn() }
    const detach = controller.watchVisibility(doc)
    await controller.play(synth('a'))
    doc.hidden = true
    listeners.forEach((cb) => cb())
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle', message: 'Paused because the tab was hidden' })
    detach()
    expect(doc.removeEventListener).toHaveBeenCalled()
  })

  it('the volume follows settings without re-creating the graph', async () => {
    const controller = createAudioController(deps)
    await controller.play(synth('a'))
    const before = context.sources.length
    controller.applySettings({ ...DEFAULT_SETTINGS, volume: 0.2, muted: false })
    expect(context.sources.length).toBe(before)
    expect(controller.getSnapshot().status).toBe('playing')
  })

  it('a clip that finishes reports it and goes idle', async () => {
    const controller = createAudioController(deps)
    await controller.play({ ...synth('a'), duration: 1 })
    vi.advanceTimersByTime(1200)
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle', message: 'Playback finished' })
  })

  it('says so when Web Audio is missing instead of failing silently', async () => {
    const controller = createAudioController({ ...deps, contextClass: () => null })
    await controller.play(synth('a'))
    expect(controller.getSnapshot().message).toBe('Web Audio is not supported')
  })
})
