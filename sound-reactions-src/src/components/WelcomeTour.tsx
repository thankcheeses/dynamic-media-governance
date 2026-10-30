import { useEffect, useRef, useState } from 'react'
import { X as XIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const PROPOSAL = '../'

interface Step {
  title: string
  body: React.ReactNode
  /** Element to highlight while this step is open. */
  spot?: string
  action?: { label: string; to?: string; href?: string }
}

const STEPS: Step[] = [
  {
    title: 'Welcome! This is a pretend X',
    body: <>Everything here is fake and safe to tap. It shows how two new features could work: <b>moving GIF banners</b> on profiles and <b>sound reactions</b> on posts.</>,
  },
  {
    title: 'Sound reactions',
    body: <>See the round <b>▶</b> buttons under posts? Tap one to hear a short sound. <b>Nothing ever plays by itself</b>, and the words underneath say what it sounds like.</>,
    spot: '.x-reaction',
    action: { label: 'Show me the feed', to: '/' },
  },
  {
    title: 'Moving banners',
    body: <>Tap <b>anyone’s name</b> to open their profile. Their banner is a real GIF that was checked for flashing first, and it stops while you scroll. The <b>⏸</b> button stops it any time.</>,
    action: { label: 'Open Dee’s profile', to: '/u/deesaysso' },
  },
  {
    title: 'Try your own GIF',
    body: <>On your profile, tap <b>Edit profile</b>. Upload a GIF or search GIPHY. It gets checked for dangerous flashing first: <b>pass</b>, <b>warning</b> or <b>blocked</b>.</>,
    action: { label: 'Open my profile', to: '/profile' },
  },
  {
    title: 'Want the details?',
    body: <>Tap <b>ⓘ</b> on any banner to see exactly how it was checked. The full plan is in <b>tab 1, The proposal</b>, at the top of the page.</>,
    action: { label: 'Read the proposal', href: PROPOSAL },
  },
]

/** A plain-language, five-step tour. Opens on the first visit and from the Tour button. */
export function WelcomeTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const nextRef = useRef<HTMLButtonElement>(null)
  const current = STEPS[step]

  useEffect(() => { nextRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    if (!current.spot) return
    const el = document.querySelector(current.spot)
    if (!el) return
    el.classList.add('tour-spot')
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return () => el.classList.remove('tour-spot')
  }, [current.spot])

  const last = step === STEPS.length - 1
  return <section className="welcome-tour" role="dialog" aria-labelledby="welcome-tour-title">
    <div className="welcome-tour-top">
      <span>Step {step + 1} of {STEPS.length}</span>
      <button type="button" className="icon-button" onClick={onClose} aria-label="Close tour"><XIcon size={18} /></button>
    </div>
    <h2 id="welcome-tour-title">{current.title}</h2>
    <p aria-live="polite">{current.body}</p>
    <div className="welcome-tour-nav">
      <span className="tour-dots" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</span>
      <span className="welcome-tour-buttons">
        {step > 0 && <button type="button" className="x-outline-pill" onClick={() => setStep(step - 1)}>Back</button>}
        {current.action && (current.action.href
          ? <a className="welcome-tour-action" href={current.action.href}>{current.action.label}</a>
          : <button type="button" className="welcome-tour-action" onClick={() => navigate(current.action!.to!)}>{current.action.label}</button>)}
        <button ref={nextRef} type="button" className="x-follow-cta" onClick={() => (last ? onClose() : setStep(step + 1))}>{last ? 'Done' : 'Next'}</button>
      </span>
    </div>
  </section>
}
