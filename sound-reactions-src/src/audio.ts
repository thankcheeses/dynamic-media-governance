import { useSyncExternalStore } from 'react'
import type { Clip } from './types'
import { toast } from 'sonner'
import { useAppStore } from './store'

/** 0.05 s of silence (8 kHz mono WAV) used once to switch iOS into playback mode. */
const SILENT_WAV = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA'

/** Gain headroom applied to synthesized clips before the compressor. */
const SYNTH_HEADROOM = 0.34

export interface PlaybackState {
  clipId: string | null
  status: 'idle' | 'playing' | 'paused'
  elapsed: number
  duration: number
  message: string
}

class AudioController {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sources: AudioScheduledSourceNode[] = []
  private element: HTMLAudioElement | null = null
  private analyser: AnalyserNode | null = null
  private bins: Uint8Array<ArrayBuffer> = new Uint8Array(0)
  /** Per-play nodes, disconnected on stop so repeated plays don't accumulate. */
  private chain: AudioNode[] = []
  private elementGain: GainNode | null = null
  /** Increments on every play; stale async work compares against it and bails. */
  private playToken = 0
  private buffers = new Map<string, Promise<AudioBuffer>>()
  private timer: ReturnType<typeof setInterval> | null = null
  private startedAt = 0
  private volume = 0.7
  private muted = false
  private state: PlaybackState = { clipId: null, status: 'idle', elapsed: 0, duration: 0, message: '' }
  private listeners = new Set<() => void>()

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  getSnapshot = () => this.state

  private emit(patch: Partial<PlaybackState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  setVolume(volume: number, muted: boolean) {
    this.volume = volume
    this.muted = muted
    const value = muted ? 0 : volume
    // Synthesized clips run through the same headroom factor used at play() start,
    // so a mid-clip volume change cannot jump the synth path ~3x louder.
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(value * SYNTH_HEADROOM, this.ctx.currentTime, 0.01)
    if (this.elementGain && this.ctx) this.elementGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01)
    else if (this.element) this.element.volume = value
  }

  /**
   * Live levels of whatever is playing, 0..1 per band, read from an AnalyserNode.
   * Returns false when nothing is playing (callers keep their resting shape).
   * The analyser only exists after a user gesture started playback.
   */
  readLevels(out: Float32Array): boolean {
    if (!this.analyser || this.state.status !== 'playing') return false
    this.analyser.getByteFrequencyData(this.bins)
    // Log-spaced bands from ~90 Hz to ~9 kHz, like a hardware level meter, so
    // low sounds (a hum) and bright ones (a ding) both move several bars.
    const nyquist = (this.ctx?.sampleRate ?? 48000) / 2
    const hzPerBin = nyquist / this.bins.length
    const lo = Math.log(90), hi = Math.log(9000)
    for (let i = 0; i < out.length; i++) {
      const from = Math.max(1, Math.floor(Math.exp(lo + ((hi - lo) * i) / out.length) / hzPerBin))
      const to = Math.max(from + 1, Math.floor(Math.exp(lo + ((hi - lo) * (i + 1)) / out.length) / hzPerBin))
      let peak = 0
      for (let bin = from; bin < to && bin < this.bins.length; bin++) peak = Math.max(peak, this.bins[bin])
      out[i] = peak / 255
    }
    return true
  }

  /** Average live level 0..1, for visuals that react to loudness as a whole. */
  readLevel(): number {
    if (!this.analyser || this.state.status !== 'playing') return 0
    this.analyser.getByteFrequencyData(this.bins)
    let sum = 0
    for (const value of this.bins) sum += value
    return sum / (this.bins.length * 255)
  }

  /** Current engine state for the Sound check ('none' before the first play). */
  engineState(): string { return this.ctx?.state ?? 'none' }

  /** What the Sound check in Settings reports. */
  diagnostics = { lastFile: '' as string, lastFileResult: 'not tried' as string }

  /**
   * iPhones mute Web Audio when the ringer switch is on silent. Safari 17+ lets
   * a page declare itself a "playback" app (navigator.audioSession); older iOS
   * switches categories once a media element plays during a gesture, so a
   * 0.05 s silent clip is played the first time. Both happen only inside play().
   */
  private unlocked = false
  private unlockDevice() {
    if (this.unlocked) return
    this.unlocked = true
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    try { if (nav.audioSession) nav.audioSession.type = 'playback' } catch { /* unsupported */ }
    try {
      const silent = new Audio(SILENT_WAV)
      silent.volume = 0.01
      void silent.play().catch(() => undefined)
    } catch { /* unsupported */ }
  }

  /** Create the context and analyser. Only ever called from play(), inside a user gesture. */
  private ensureGraph(): AudioContext | null {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return null
    this.unlockDevice()
    if (!this.ctx) this.ctx = new AudioContextClass()
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.72
      this.analyser.connect(this.ctx.destination)
      this.bins = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount))
    }
    return this.ctx
  }

  stop(message = 'Playback stopped') {
    this.playToken++ // cancels any play() still waiting on a file load
    const wasActive = Boolean(this.state.clipId)
    this.sources.forEach((source) => { try { source.stop() } catch { /* already stopped */ } })
    this.sources = []
    if (this.element) { this.element.pause(); this.element.currentTime = 0; this.element = null }
    this.chain.forEach((node) => { try { node.disconnect() } catch { /* already disconnected */ } })
    this.chain = []
    this.master = null
    this.elementGain = null
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.ctx?.state === 'running') void this.ctx.suspend()
    this.emit({ clipId: null, status: 'idle', elapsed: 0, duration: 0, message: wasActive ? message : this.state.message })
  }

  async play(clip: Clip) {
    if (this.state.clipId === clip.id && this.state.status === 'playing') { this.stop(); return }
    this.stop()
    useAppStore.getState().addAudit('playback_started', clip.id, `User-initiated playback: ${clip.name}`)
    this.emit({ clipId: clip.id, status: 'playing', elapsed: 0, duration: clip.duration, message: `Playing ${clip.name}` })
    this.startedAt = performance.now()
    this.timer = setInterval(() => {
      const elapsed = Math.min(clip.duration, (performance.now() - this.startedAt) / 1000)
      this.emit({ elapsed })
      if (elapsed >= clip.duration) this.stop('Playback finished')
    }, 100)

    const token = ++this.playToken

    // Live microphone recordings (blob: URLs) are same-document; play them directly.
    if (clip.audioUrl?.startsWith('blob:')) {
      const element = new Audio(clip.audioUrl)
      element.volume = this.muted ? 0 : this.volume
      element.onended = () => { if (token === this.playToken) this.stop('Playback finished') }
      element.onerror = () => { if (token === this.playToken) this.stop('Recording unavailable; try the synthesized demo') }
      this.element = element
      await element.play()
      return
    }

    const ctx = this.ensureGraph()
    if (!ctx) { this.stop('Web Audio is not supported'); return }
    this.ctx = ctx
    // Resume synchronously inside the user gesture (Safari requires it), before any await.
    const resumed = ctx.resume()

    if (clip.audioUrl) {
      // Generated files are fetched and decoded into the same Web Audio graph the
      // synthesizer uses. An <audio> element routed through Web Audio is silenced
      // when the page runs in a sandboxed frame (the file counts as cross-origin),
      // so decoding is the path that plays everywhere the synth does.
      try {
        this.diagnostics.lastFile = clip.name
        const buffer = await this.loadBuffer(clip.audioUrl)
        this.diagnostics.lastFileResult = `loaded (${buffer.duration.toFixed(1)} s)`
        await resumed.catch(() => undefined)
        if (ctx.state !== 'running') this.warnBlocked()
        if (token !== this.playToken) return // user stopped or picked another clip meanwhile
        const source = ctx.createBufferSource()
        source.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = this.muted ? 0 : this.volume
        source.connect(gain)
        gain.connect(this.analyser ?? ctx.destination)
        source.onended = () => { if (token === this.playToken && this.state.clipId === clip.id) this.stop('Playback finished') }
        this.sources.push(source)
        this.chain.push(gain)
        this.elementGain = gain
        this.startedAt = performance.now() // progress starts when sound starts
        source.start()
        return
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        this.diagnostics.lastFileResult = `failed: ${reason}`
        if (token !== this.playToken) return
        // Never fail silently: say so, then play the synthesized version of the same sound.
        this.emit({ message: `${clip.name}: audio file unavailable, playing the backup version` })
        toast(`Couldn't load the ${clip.name} sound (${reason}). Playing the backup version.`)
      }
    }

    await resumed.catch(() => undefined)
    if (token !== this.playToken) return
    if (ctx.state !== 'running') this.warnBlocked()
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : this.volume * SYNTH_HEADROOM
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -6
    compressor.knee.value = 3
    compressor.ratio.value = 12
    compressor.attack.value = 0.002
    compressor.release.value = 0.12
    this.master.connect(compressor)
    compressor.connect(this.analyser ?? ctx.destination)
    this.chain.push(this.master, compressor)
    const synthesisKey = clip.kind === 'voice' ? 'voice' : (clip.soundId ?? clip.name.toLowerCase().replaceAll(' ', '-'))
    this.synthesize(synthesisKey, ctx.currentTime + 0.02)
  }

  private warnedBlocked = false
  private warnBlocked() {
    if (this.warnedBlocked) return
    this.warnedBlocked = true
    toast('Your browser is holding the sound back. Tap play again, and check your volume. On iPhone, flip the silent switch off.')
  }

  /** Fetch + decode once per file; later plays reuse the decoded buffer. */
  private loadBuffer(url: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(url)
    if (cached) return cached
    const ctx = this.ctx
    if (!ctx) return Promise.reject(new Error('No audio context'))
    const pending = fetch(url)
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer() })
      .then((data) => ctx.decodeAudioData(data))
    pending.catch(() => this.buffers.delete(url))
    this.buffers.set(url, pending)
    return pending
  }

  private tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', endFreq?: number) {
    if (!this.ctx || !this.master) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.55, start + Math.min(0.04, duration / 4))
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(gain); gain.connect(this.master)
    osc.start(start); osc.stop(start + duration + 0.02)
    this.sources.push(osc)
  }

  private noise(start: number, duration: number, highpass = 500) {
    if (!this.ctx || !this.master) return
    const length = Math.ceil(this.ctx.sampleRate * duration)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const channel = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) channel[i] = (Math.random() * 2 - 1) * Math.exp(-i / length * 3)
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'; filter.frequency.value = highpass
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.45, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(filter); filter.connect(gain); gain.connect(this.master)
    source.start(start); source.stop(start + duration)
    this.sources.push(source)
  }

  private synthesize(id: string, t: number) {
    if (id === 'applause') for (let i = 0; i < 22; i++) this.noise(t + i * 0.12, 0.09 + (i % 3) * 0.025, 850)
    else if (id === 'side-eye') { this.tone(330, t, 0.65, 'triangle', 245); this.tone(220, t + 0.8, 0.85, 'triangle', 155) }
    else if (id === 'laughter') for (let i = 0; i < 6; i++) this.tone(240 + (i % 2) * 85, t + i * 0.43, 0.28, 'square', 180 + (i % 2) * 60)
    else if (id === 'gasp') { this.noise(t, 1.1, 1100); this.tone(310, t + 0.3, 1.4, 'sine', 690) }
    else if (id === 'mm-hmm') { this.tone(175, t, 0.65, 'sine', 195); this.tone(165, t + 0.78, 0.75, 'sine', 205) }
    else if (id === 'tiny-violin') { this.tone(620, t, 1.7, 'sawtooth', 460); this.tone(510, t + 1.75, 1.85, 'sawtooth', 350); this.tone(930, t, 3.4, 'sine', 700) }
    else if (id === 'airhorn') for (let i = 0; i < 3; i++) { this.tone(466, t + i * 0.5, 0.38, 'sawtooth'); this.tone(587, t + i * 0.5, 0.38, 'sawtooth') }
    else if (id === 'drumroll') { for (let i = 0; i < 40; i++) this.noise(t + i * 0.055, 0.05, 1800); this.noise(t + 2.25, 0.7, 4000) }
    else if (id === 'slow-clap') [0, 0.9, 1.7, 2.4, 3.0].forEach((d) => this.noise(t + d, 0.12, 900))
    else if (id === 'record-scratch') { this.noise(t, 0.35, 1500); this.tone(900, t, 0.35, 'sawtooth', 180) }
    else if (id === 'rimshot') { this.noise(t, 0.08, 1200); this.noise(t + 0.18, 0.08, 1200); this.noise(t + 0.42, 0.9, 5000) }
    else if (id === 'dramatic-boom') { this.tone(70, t, 1.8, 'sine', 32); this.noise(t, 0.4, 120) }
    else if (id === 'crickets') for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) this.tone(4200, t + i * 0.42 + k * 0.05, 0.035, 'sine')
    else if (id === 'sad-trombone') [[392, 0], [370, 0.55], [349, 1.1], [330, 1.65]].forEach(([f, d], i) => this.tone(f, t + d, i === 3 ? 1.2 : 0.5, 'sawtooth', i === 3 ? 300 : undefined))
    else if (id === 'correct-ding') { this.tone(880, t, 0.35, 'sine'); this.tone(1320, t + 0.18, 0.9, 'sine') }
    else if (id === 'wrong-buzzer') this.tone(140, t, 0.9, 'square')
    else if (id === 'cash-register') { this.noise(t, 0.12, 2500); this.tone(2093, t + 0.15, 0.9, 'sine'); this.tone(2637, t + 0.15, 0.9, 'sine') }
    else if (id === 'level-up') [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + i * 0.11, i === 4 ? 0.6 : 0.12, 'square'))
    else if (id.startsWith('voice')) for (let i = 0; i < 20; i++) this.tone(115 + (i % 5) * 24, t + i * 0.55, 0.38, i % 2 ? 'triangle' : 'sine', 135 + (i % 4) * 30)
    else this.tone(260, t, Math.min(2, this.state.duration), 'sine', 320)
  }
}

export const audioController = new AudioController()

export function useAudio() {
  const state = useSyncExternalStore(audioController.subscribe, audioController.getSnapshot, audioController.getSnapshot)
  return { state, play: (clip: Clip) => void audioController.play(clip), stop: (message?: string) => audioController.stop(message) }
}
