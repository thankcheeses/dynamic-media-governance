import { forwardRef, useEffect, useRef, useState } from 'react'
import { Captions, Flag, Copy, MoreHorizontal, Pause, Play, Square } from 'lucide-react'
import { toast } from 'sonner'
import { audioController, useAudio } from '../audio'
import { emojiBurst, landPill, motionAllowed, takeLanding } from '../motion'
import { useAppStore } from '../store'
import type { Post, Reaction } from '../types'
import { Modal } from './Modal'
import { avatarContent, avatarStyle } from '../avatar'

// Fixed bar heights so the resting waveform is a stable, recognizable shape.
const bars = [6, 11, 8, 15, 10, 17, 7, 13, 9, 16, 6, 12, 17, 8, 13, 5, 10, 14, 7, 11]

/**
 * Drives bar heights (and optional pulse targets) from the live analyser while
 * this clip plays. Writes styles directly in a rAF loop, so React never
 * re-renders per frame. Only transforms change; no large luminance swings, so
 * it stays clear of WCAG 2.3.1 flash thresholds. Off under reduced motion.
 */
function useLiveAudio(active: boolean, wave: React.RefObject<HTMLElement | null>, pulse?: React.RefObject<HTMLElement | null>, halo?: React.RefObject<HTMLElement | null>) {
  const reduced = useAppStore((state) => state.settings.reducedMotion)
  useEffect(() => {
    if (!active || reduced || !motionAllowed()) return
    const bars = Array.from(wave.current?.querySelectorAll<HTMLElement>('i') ?? [])
    const pulseEl = pulse?.current ?? null
    const haloEl = halo?.current ?? null
    const levels = new Float32Array(bars.length || 1)
    let frame = 0
    const tick = () => {
      if (audioController.readLevels(levels)) {
        let sum = 0
        bars.forEach((bar, index) => {
          const value = levels[index]
          sum += value
          bar.style.transform = `scaleY(${(0.22 + value * 1.05).toFixed(3)})`
        })
        const avg = bars.length ? sum / bars.length : audioController.readLevel()
        if (pulseEl) pulseEl.style.transform = `scale(${(1 + avg * 0.45).toFixed(3)}) rotate(${((avg - 0.2) * 14).toFixed(1)}deg)`
        if (haloEl) {
          haloEl.style.transform = `scale(${(1 + avg * 0.7).toFixed(3)})`
          haloEl.style.opacity = Math.min(0.85, avg * 1.6).toFixed(2)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      bars.forEach((bar) => { bar.style.transform = '' })
      if (pulseEl) pulseEl.style.transform = ''
      if (haloEl) { haloEl.style.transform = ''; haloEl.style.opacity = '' }
    }
  }, [active, reduced, wave, pulse, halo])
}

const Waveform = forwardRef<HTMLSpanElement, { playing: boolean; count?: number; className?: string }>(function Waveform({ playing, count = 12, className = '' }, ref) {
  return <span ref={ref} className={`x-wave ${playing ? 'is-playing' : ''} ${className}`} aria-hidden="true">
    {bars.slice(0, count).map((height, index) => <i key={index} style={{ height }} />)}
  </span>
})

function useScrollPause(playing: boolean, stop: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!playing || !ref.current || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) stop() }, { threshold: 0.05 })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [playing, stop])
  return ref
}

function Progress({ clipId, duration, tone }: { clipId: string; duration: number; tone: 'reaction' | 'voice' }) {
  const { state } = useAudio()
  const active = state.clipId === clipId
  const elapsed = active ? state.elapsed : 0
  return <div className={`x-progress ${tone}`}>
    <div className="x-progress-track" role="progressbar" aria-label="Playback progress" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.round(elapsed)}>
      <span style={{ transform: `scaleX(${Math.min(1, elapsed / duration)})` }} />
    </div>
    <span className="x-time-code">{formatTime(elapsed)} / {formatTime(duration)}</span>
  </div>
}

function formatTime(seconds: number) {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function SoundReactionChip({ reaction, post }: { reaction: Reaction; post: Post }) {
  const { state, play, stop } = useAudio()
  const [menu, setMenu] = useState(false)
  const [report, setReport] = useState(false)
  const [reason, setReason] = useState('Harassment or abusive content')
  const reportReaction = useAppStore((state) => state.reportReaction)
  const captions = useAppStore((state) => state.settings.captions)
  const active = state.clipId === reaction.id
  const playing = active && state.status === 'playing'
  const ref = useScrollPause(playing, () => stop('Paused because the reaction scrolled out of view'))
  const waveRef = useRef<HTMLSpanElement>(null)
  const emojiRef = useRef<HTMLSpanElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  useLiveAudio(playing, waveRef, emojiRef)
  // A reaction you just added pops in with confetti. Never on page load.
  useEffect(() => {
    if (!takeLanding(post.id)) return
    landPill(pillRef.current)
    emojiBurst(emojiRef.current, reaction.emoji, 9)
  }, [post.id, reaction.id, reaction.count, reaction.emoji])
  const label = `${playing ? 'Pause' : 'Play'} ${reaction.name} sound reaction, ${reaction.duration} s`

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menu])

  if (reaction.removed) return <div className="x-reaction-removed">This sound reaction was removed after review. The post stays up.</div>

  return (
    <div className={`x-reaction ${active ? 'is-active' : ''}`} ref={ref}>
      <div className="x-reaction-pill" ref={pillRef}>
        <button className="x-reaction-play" onClick={() => { if (!playing) emojiBurst(emojiRef.current, reaction.emoji, 5); play(reaction) }} aria-label={label}>
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <span className="x-reaction-emoji" aria-hidden="true" ref={emojiRef}>{reaction.emoji}</span>
        <span className="x-reaction-name"><strong>{reaction.name}</strong><span>Sound reaction · {reaction.duration}s</span></span>
        <Waveform ref={waveRef} playing={playing} count={10} className="x-reaction-wave" />
        <span className="x-reaction-count"><span className="sr-only">Used </span>{reaction.count}<span className="sr-only"> times</span></span>
        {active && <button className="x-mini-button" onClick={() => { stop(); toast('Playback stopped') }} aria-label={`Stop ${reaction.name} sound reaction`}><Square size={13} fill="currentColor" /></button>}
        <div className="x-menu-wrap">
          <button className="x-mini-button" onClick={(event) => { event.stopPropagation(); setMenu(!menu) }} aria-label="More sound reaction actions" aria-expanded={menu}><MoreHorizontal size={17} /></button>
          {menu && <div className="x-menu" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => { setReport(true); setMenu(false) }}><Flag size={17} /> Report this sound reaction</button>
            <button onClick={() => { void navigator.clipboard?.writeText(reaction.description).catch(() => undefined); setMenu(false); toast('Description copied') }}><Copy size={17} /> Copy description</button>
          </div>}
        </div>
      </div>
      {active && <Progress clipId={reaction.id} duration={reaction.duration} tone="reaction" />}
      <p className="x-reaction-text">{reaction.description}</p>
      {captions && reaction.transcript && <p className="x-reaction-text x-reaction-caption"><Captions size={14} aria-hidden="true" /><span className="sr-only">Caption: </span>{reaction.transcript}</p>}
      {reaction.aiLabel && <span className="x-ai-label">AI-generated audio</span>}
      {report && <Modal title="Report this sound reaction" onClose={() => setReport(false)}>
        <p className="muted">This reports only the sound reaction, not {post.handle}’s post. It goes to a local, simulated review queue.</p>
        <label className="field-label" htmlFor="report-reason">Reason</label>
        <select id="report-reason" value={reason} onChange={(event) => setReason(event.target.value)}><option>Harassment or abusive content</option><option>Copyright concern</option><option>Missing accessibility description</option><option>Synthetic or cloned voice concern</option><option>Other</option></select>
        <div className="legal-note"><strong>Simulated DSA flow</strong><p>Notice and action (Art. 16), statement of reasons (Art. 17), and complaint routing (Art. 20). No real report is sent.</p></div>
        <button className="primary-button full" onClick={() => { reportReaction(post.id, reason); setReport(false); toast('Report added to the local moderation queue') }}>Submit local report</button>
      </Modal>}
    </div>
  )
}

export function VoicePostPlayer({ clip, handle, initials = 'MC' }: { clip: NonNullable<Post['voice']>; handle: string; initials?: string }) {
  const { state, play, stop } = useAudio()
  const captions = useAppStore((state) => state.settings.captions)
  const active = state.clipId === clip.id
  const playing = active && state.status === 'playing'
  const ref = useScrollPause(playing, () => stop('Paused because the voice post scrolled out of view'))
  const waveRef = useRef<HTMLSpanElement>(null)
  const avatarRef = useRef<HTMLSpanElement>(null)
  const haloRef = useRef<HTMLSpanElement>(null)
  useLiveAudio(playing, waveRef, avatarRef, haloRef)
  return (
    <div className={`x-voice ${playing ? 'is-playing' : ''}`} ref={ref}>
      <div className="x-voice-stage">
        <span className="x-voice-badge">Voice post</span>
        <span className="x-voice-avatar-wrap" aria-hidden="true"><span className="x-voice-halo" ref={haloRef} /><span className="x-voice-avatar" ref={avatarRef} style={avatarStyle(initials)}>{avatarContent(initials)}</span></span>
        <Waveform ref={waveRef} playing={playing} count={20} className="x-voice-wave" />
      </div>
      <div className="x-voice-controls">
        <button className="x-voice-play" onClick={() => play(clip)} aria-label={`${playing ? 'Pause' : 'Play'} voice post by ${handle}`}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
        <Progress clipId={clip.id} duration={clip.duration} tone="voice" />
        <button className="x-mini-button" onClick={() => stop()} aria-label={`Stop voice post by ${handle}`} disabled={!active}><Square size={13} fill="currentColor" /></button>
      </div>
      <div className="x-voice-transcript">
        <strong>{captions ? 'Transcript' : 'Description'}</strong>
        <p>{captions ? clip.transcript : clip.description}</p>
        {clip.aiLabel && <span className="x-ai-label">AI-generated audio · labeled</span>}
      </div>
    </div>
  )
}
