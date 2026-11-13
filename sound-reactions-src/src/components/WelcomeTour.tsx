import { useEffect, useRef } from 'react'
import { ArrowRight, X as XIcon } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { nextStop } from '../journey'
import { TOUR_STEPS } from './tourSteps'

const PROPOSAL = '../'

/**
 * A plain-language tour that drives: each step opens the page it talks about.
 * It opens on the first visit, from the Tour button, and from the tour pill,
 * and it resumes at the step where it was closed.
 */
export function WelcomeTour({ step, onStep, onClose }: { step: number; onStep: (step: number) => void; onClose: (finished: boolean) => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const nextRef = useRef<HTMLButtonElement>(null)
  const current = TOUR_STEPS[step]
  const last = step === TOUR_STEPS.length - 1

  useEffect(() => { nextRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  // Take the visitor to the page this step is about.
  useEffect(() => { if (current.to && current.to !== pathname) navigate(current.to) }, [current.to]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!current.spot || (current.to && current.to !== pathname)) return
    let el: Element | null = null
    // Wait a beat so the page this step opened has rendered and settled at the top.
    const timer = window.setTimeout(() => {
      el = document.querySelector(current.spot!)
      el?.classList.add('tour-spot')
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 150)
    return () => { window.clearTimeout(timer); el?.classList.remove('tour-spot') }
  }, [current.spot, current.to, pathname])

  return <section className="welcome-tour" role="dialog" aria-labelledby="welcome-tour-title">
    <div className="welcome-tour-top">
      <span>Step {step + 1} of {TOUR_STEPS.length}</span>
      <button type="button" className="icon-button" onClick={() => onClose(false)} aria-label="Close tour"><XIcon size={18} /></button>
    </div>
    <h2 id="welcome-tour-title">{current.title}</h2>
    <p aria-live="polite">{current.body}</p>
    <div className="welcome-tour-nav">
      <span className="tour-dots" aria-hidden="true">{TOUR_STEPS.map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</span>
      <span className="welcome-tour-buttons">
        {step > 0 && <button type="button" className="x-outline-pill" onClick={() => onStep(step - 1)}>Back</button>}
        {last && <a className="welcome-tour-action" href={PROPOSAL}>Read the proposal</a>}
        <button ref={nextRef} type="button" className="x-follow-cta" onClick={() => (last ? onClose(true) : onStep(step + 1))}>{last ? 'Done' : 'Next'}</button>
      </span>
    </div>
  </section>
}

/** The foot of every page: where to go next. One line, one link. */
export function NextStopCard() {
  const { pathname } = useLocation()
  const next = nextStop(pathname)
  const label = next.kind === 'rejoin' ? 'Walkthrough' : `Stop ${next.position} of ${next.total} · Next`
  const body = <><span className="next-stop-label">{label}</span><strong>{next.invite}</strong><span className="next-stop-go">{next.go} <ArrowRight size={16} aria-hidden="true" /></span></>
  return <nav className="next-stop" aria-label="Next in the walkthrough">
    {next.kind === 'finish' ? <a href={next.href}>{body}</a> : <Link to={next.to}>{body}</Link>}
  </nav>
}
