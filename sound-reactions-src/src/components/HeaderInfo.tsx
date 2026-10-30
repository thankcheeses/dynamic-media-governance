import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, X as XIcon } from 'lucide-react'
import type { UploadedMedia } from '../analyze'
import { HEADER_LIMITS, type HeaderDecision, type HeaderPreset } from '../headers'

const REPO = 'https://github.com/thankcheeses/dynamic-media-governance/tree/main/sound-reactions-src'
const FRAMEWORK = 'https://thankcheeses.github.io/dynamic-media-governance/'

function sourceOf(preset: HeaderPreset, upload?: UploadedMedia | null): { label: React.ReactNode; measured: boolean } {
  if (upload?.source === 'giphy') return { label: 'A GIF picked from GIPHY', measured: true }
  if (upload) return { label: 'A file uploaded in this browser', measured: true }
  if (preset.hosted) return { label: <>The owner’s own pick, playing from <a href={preset.hosted.pageUrl} target="_blank" rel="noreferrer">{preset.hosted.provider}</a> and measured on the owner’s copy of the clip</>, measured: true }
  if (preset.media) return { label: 'A GIF rendered with three.js for this prototype', measured: true }
  return { label: 'A sample header with fixture values', measured: false }
}

/**
 * A short tour of how a dynamic header was checked and how it plays, opened from
 * the ⓘ button on the banner. The banner itself stays clean; the details live here.
 */
export function HeaderInfo({ preset, decision, upload, status, onClose }: {
  preset: HeaderPreset
  decision: HeaderDecision
  upload?: UploadedMedia | null
  status: string
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const m = upload?.measurement ?? preset
  const source = sourceOf(preset, upload)
  const provisional = decision === 'PROVISIONAL'
  const transcoded = m.fps > HEADER_LIMITS.fps
  const area = m.flashArea !== undefined && m.flashesPerSecond > 0 ? `, covering up to ${Math.round(m.flashArea * 100)}% of the header` : ''

  const steps = [
    {
      title: provisional ? 'Published with a warning' : 'Scanned before it went live',
      body: <>
        <p>{provisional
          ? 'This header flashes more than 3 times a second, but only in a small part of the image. It is live behind a photosensitivity warning, and a person reviews it within 24 hours.'
          : 'Every header is checked for flashing that can trigger seizures before it can play. This one passed.'}</p>
        <dl className="tour-facts">
          <div><dt>Source</dt><dd>{source.label}</dd></div>
          <div><dt>General flashes</dt><dd>{m.flashesPerSecond} per second{area} (limit {HEADER_LIMITS.flashesPerSecond})</dd></div>
          <div><dt>Red flashes</dt><dd>{m.redFlash ? 'Found' : 'None'}</dd></div>
          <div><dt>Result</dt><dd>{provisional ? 'Provisional publish, under review' : 'Passed'}</dd></div>
        </dl>
      </>,
    },
    {
      title: 'Within the limits',
      body: <>
        <p>Headers have hard limits so they stay light and calm. Files over the size or loop limit are rejected at upload.</p>
        <dl className="tour-facts">
          <div><dt>Frame rate</dt><dd>{transcoded ? `${m.fps} fps, played at ${HEADER_LIMITS.fps} fps` : `${m.fps} fps`} (cap {HEADER_LIMITS.fps})</dd></div>
          {m.loopSeconds > 0 && <div><dt>Loop</dt><dd>{m.loopSeconds} s (limit {HEADER_LIMITS.loopSeconds} s)</dd></div>}
          {m.sizeMB > 0 && <div><dt>File size</dt><dd>{m.sizeMB} MB (limit {HEADER_LIMITS.sizeMB} MB)</dd></div>}
          <div><dt>Sound</dt><dd>None. Headers never carry audio.</dd></div>
        </dl>
      </>,
    },
    {
      title: 'How it plays',
      body: <>
        <ul className="tour-list">
          <li>Pauses while you scroll, when it is off-screen and when the tab is hidden.</li>
          <li>Shows a still frame when reduced motion, low-power mode or data saver is on.</li>
          <li>The pause button on the banner stops it at any time.</li>
          {provisional && <li>Stays behind its warning until you choose to play it.</li>}
        </ul>
        <p className="tour-status"><strong>Right now:</strong> {status}</p>
      </>,
    },
    {
      title: 'Under the hood',
      body: <>
        <p>For developers and reviewers. The scan is a simplified version of the WCAG 2.2 flash test (Success Criterion 2.3.1). It is a screening aid for this prototype, not a certified photosensitivity tool.</p>
        <ul className="tour-list">
          <li>A <strong>transition</strong> is a change in relative luminance of 10% or more where the darker state is below 0.80, over more than 21,824 px at a 1024×768 reference.</li>
          <li>A <strong>flash</strong> is a pair of opposing transitions. The scan reports the most flashes in any one-second window, wrapping the loop end back to the start.</li>
          <li>A <strong>red flash</strong> involves saturated red: R / (R + G + B) ≥ 0.8.</li>
          <li><strong>Decisions:</strong> over the size or loop limit is rejected; red flashing, 10+ flashes a second, or over-limit flashing across 25% or more of the header is hard-blocked; smaller over-limit flashing is published behind a warning; the rest passes.</li>
        </ul>
        <p className="tour-links">
          <a href={`${REPO}/src/analyze.ts`} target="_blank" rel="noreferrer">Browser analyzer</a>
          <a href={`${REPO}/scripts/analyze-header.py`} target="_blank" rel="noreferrer">Python analyzer</a>
          <a href={`${REPO}/src/headers.ts`} target="_blank" rel="noreferrer">Decision rules</a>
          <a href={FRAMEWORK} target="_blank" rel="noreferrer">Governance framework</a>
        </p>
      </>,
    },
  ]
  const current = steps[step]

  return createPortal(<div className="x-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="header-tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-head">
        <span className="tour-step">Step {step + 1} of {steps.length}</span>
        <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
      </div>
      <h2 id="tour-title">{current.title}</h2>
      <div className="tour-body">{current.body}</div>
      <div className="tour-nav">
        <span className="tour-dots" aria-hidden="true">{steps.map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</span>
        <span>
          {step > 0 && <button type="button" className="x-outline-pill" onClick={() => setStep(step - 1)}><ArrowLeft size={16} aria-hidden="true" /> Back</button>}
          {step < steps.length - 1
            ? <button type="button" className="x-follow-cta" onClick={() => setStep(step + 1)}>Next <ArrowRight size={16} aria-hidden="true" /></button>
            : <button type="button" className="x-follow-cta" onClick={onClose}>Done</button>}
        </span>
      </div>
    </section>
  </div>, document.body)
}
