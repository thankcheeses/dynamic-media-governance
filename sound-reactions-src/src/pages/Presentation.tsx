import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, AudioLines, Check, FileSearch, Gauge, ShieldCheck } from 'lucide-react'
import { PostCard } from '../components/PostCard'
import { SEED_POSTS, SOUND_LIBRARY } from '../data'
import { audioController, useAudio } from '../audio'

const SoundOrb = lazy(() => import('../components/SoundOrb'))

/** Title-slide 3D orb plus an explicit "Hear it" button. Sound starts only on that press. */
function HeroVisual() {
  const { state } = useAudio()
  const demo = SOUND_LIBRARY[0]
  const playing = state.clipId === demo.id && state.status === 'playing'
  const icon = <AudioLines size={70} className="x-orb-fallback" />
  // Load the 3D chunk only once the slide is interactive and the browser is idle,
  // so arrow keys and buttons never wait on WebGL setup.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 300))
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const id = idle(() => setReady(true), { timeout: 1200 })
    return () => cancel(id)
  }, [])
  return <div className="x-orb-stage">
    {ready ? <Suspense fallback={icon}><SoundOrb fallback={icon} /></Suspense> : icon}
    <button className="x-orb-play" onClick={() => void audioController.play(demo)} aria-label={playing ? 'Stop the applause demo' : 'Hear the applause sound reaction'}>
      {playing ? 'Stop' : 'Hear it'} <span aria-hidden="true">{demo.emoji}</span>
    </button>
  </div>
}

interface Slide { title: string; kicker: string; content: ReactNode; notes: string }

const slides: Slide[] = [
  { kicker: 'THE CONCEPT', title: 'Expressive by design. Silent by default.', content: <div className="hero-slide"><HeroVisual /><p>Short, described sound reactions add tone to a post without taking over the timeline.</p><div className="principle-pills"><span>No autoplay</span><span>Text equivalent</span><span>One stream</span></div></div>, notes: 'Open with the restraint, not the novelty. The feature succeeds when people can ignore it without losing meaning.' },
  { kicker: 'PROBLEM & EVIDENCE', title: 'Separate what happened from what we hypothesize.', content: <div className="fact-hypothesis"><section><FileSearch size={24} /><h3>Documented facts</h3><ul><li>Voice tweets launched June 17, 2020 on iOS, with 140-second clips.</li><li>Automated captions followed July 15, 2021 after accessibility criticism.</li><li>Accessible refresh chirps arrived in 2022.</li><li>Voice notes returned to X Chat April 9, 2026.</li></ul></section><section><Gauge size={24} /><h3>Hypotheses to validate</h3><ul><li>Short reactions can add tone without increasing timeline fatigue.</li><li>Visible descriptions can make sounds useful without playback.</li><li>Compact governance can catch avoidable publishing failures.</li></ul><p>No sound-reaction feature on X has been documented.</p></section></div>, notes: 'The 2020 launch is the cautionary precedent: audio shipped without captions and drew sustained criticism. Do not present the proposed benefits as established research.' },
  { kicker: 'PROPOSED EXPERIENCE', title: 'A compact reaction, attached—not embedded.', content: <div className="live-slide"><p>This is a live embedded post. Play, pause, stop, read the alternative, or report the reaction.</p><PostCard post={SEED_POSTS[0]} embedded /></div>, notes: 'Demonstrate that the description communicates the sound’s meaning before any audio starts. Reporting applies to the reaction, not the parent post.' },
  { kicker: 'TWO AUDIO FORMATS', title: 'Voice posts and reactions stay unmistakably different.', content: <div className="slide-comparison"><div><span>VOICE POST</span><strong>Primary author content</strong><p>Full-width player · up to 140 s · author-owned · transcript</p></div><div><span>SOUND REACTION</span><strong>Compact response</strong><p>Reaction chip · up to 8 s · post-attached · description + text equivalent</p></div></div>, notes: 'Different accessible names are a hard requirement, not visual garnish. Screen-reader users should know which format and author a control refers to.' },
  { kicker: 'INTERACTION & ACCESSIBILITY', title: 'The safety contract applies to every clip.', content: <div className="slide-checklist">{['Click or key press starts audio', 'Starting B stops A', 'Visible play, pause, stop and progress', 'Global mute + persistent volume', 'Captions and text alternatives on by default', 'Pause on scroll-away, hidden tab and low-power toggle', 'Reduced motion and no audio prefetch in data saver', 'Keyboard operation, visible focus and ≥24 px targets'].map((item) => <p key={item}><Check size={18} />{item}</p>)}</div>, notes: 'There is no reliable web low-power signal, so it is a user toggle. Waveform movement is transform-only and does not strobe; reduced motion removes it.' },
  { kicker: 'GOVERNANCE MAPPING', title: 'Reuse the structure. Correct the claims.', content: <div className="mapping-slide"><section><strong>Framework / adapted</strong><p>Preflight, review pipeline, scroll-away pause, flash-safe visualization and staged rollout.</p></section><section><strong>New proposals</strong><p>8-second cap, 256 KB cap, one active stream and configurable reaction rate limit.</p></section><section><strong>Legal design targets</strong><p>WCAG 2.2 AA; DSA Arts. 16, 17, 20, 34, 35; EU AI Act Art. 50 labels.</p></section><section><strong>Needs research / not applied</strong><p>Real detector performance, measured loudness, review capacity. No biometric anchor.</p></section></div>, notes: 'Red-flash correction: saturated red is ≥0.8 with chromaticity change >0.2. The 10–20s scan time, 24h SLA, savings figures, complaint gate and strike durations are unsourced proposals, not facts.' },
  { kicker: 'RISK & ROLLOUT', title: 'Earn expansion through evidence.', content: <div className="rollout-slide"><div className="rollout-steps"><span>Internal</span><i /><span>Opt-in pilot</span><i /><span>Evaluation</span><i /><span>Expansion</span></div><div className="launch-rollback"><section><ShieldCheck size={22} /><h3>Proposed launch criteria</h3><ul><li>Keyboard and screen-reader journeys pass.</li><li>Descriptions are understood without playback.</li><li>Review capacity matches flagged volume.</li><li>No unresolved flash or autoplay defects.</li></ul></section><section><h3>Proposed rollback triggers</h3><ul><li>Autoplay or audio-only meaning regression.</li><li>Moderation queue exceeds operating capacity.</li><li>Abuse or false-positive rates breach pilot-approved limits.</li><li>Playback harms device performance.</li></ul></section></div></div>, notes: 'These thresholds must be set from pilot evidence. The brief’s <0.5% complaint gate is not sourced and is not used as a factual requirement.' },
  { kicker: 'METRICS & VALIDATION', title: 'Measure comprehension and restraint—not just plays.', content: <div className="metrics-slide"><div><strong>Comprehension</strong><p>Can people identify the reaction’s intent from text alone?</p></div><div><strong>Control</strong><p>Pause/stop success, autoplay defects, single-stream violations.</p></div><div><strong>Quality</strong><p>Preflight false positives, review overturns, time to decision.</p></div><div><strong>Wellbeing</strong><p>Mute use, hides, reports and qualitative fatigue signals.</p></div><p className="validation-plan">Validation plan: moderated accessibility sessions → internal adversarial fixtures → opt-in pilot with pre-registered analysis → independent accessibility review. No metric target is claimed as an established benchmark.</p></div>, notes: 'Close with the research plan. Playback counts alone would reward intrusion; pair them with comprehension, control and wellbeing measures.' },
]

export default function Presentation() {
  const [index, setIndex] = useState(0)
  const previous = () => setIndex((current) => Math.max(0, current - 1))
  const next = () => setIndex((current) => Math.min(slides.length - 1, current + 1))
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches('input, textarea, select')) return
      if (event.key === 'ArrowRight') next()
      if (event.key === 'ArrowLeft') previous()
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [])
  const slide = slides[index]
  return <div className="presentation-page"><header className="presentation-top"><span>Independent proposal · Sound Reactions</span><strong>{index + 1} / {slides.length}</strong></header><section className="slide" aria-labelledby="slide-title" tabIndex={-1}><span className="eyebrow">{slide.kicker}</span><h1 id="slide-title">{slide.title}</h1><div className="slide-content">{slide.content}</div></section><footer className="presentation-controls"><button className="secondary-button" onClick={previous} disabled={index === 0}><ArrowLeft size={18} /> Previous</button><div className="slide-dots" aria-label="Choose slide">{slides.map((item, dot) => <button key={item.title} className={dot === index ? 'active' : ''} onClick={() => setIndex(dot)} aria-label={`Go to slide ${dot + 1}: ${item.title}`} aria-current={dot === index ? 'step' : undefined} />)}</div><button className="primary-button" onClick={next} disabled={index === slides.length - 1}>Next <ArrowRight size={18} /></button></footer><details className="presenter-notes"><summary>Presenter notes</summary><p>{slide.notes}</p></details></div>
}
