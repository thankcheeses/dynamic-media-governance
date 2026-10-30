import { AlertTriangle, ArrowUpRight, Check, Download, FileWarning, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GOVERNANCE_MAPPING } from '../governance'
import { useAppStore } from '../store'
import type { CheckKey, FailurePolicy } from '../types'

const policyLabels: Record<CheckKey, string> = { duration: 'Duration failure', size: 'Size failure', transcript: 'Missing description', loudness: 'Loudness failure', rate: 'Rate-limit failure', abuse: 'SIMULATED abuse flag', copyright: 'SIMULATED copyright match', synthetic: 'Missing AI label' }

export default function Governance() {
  const { config, setConfig, submissions, audits, moderate } = useAppStore()
  const queue = submissions.filter((item) => ['HOLD', 'REPORTED', 'ESCALATED'].includes(item.status))
  const published = submissions.filter((item) => item.status === 'PUBLISHED').length
  const numeric = (key: 'durationLimit' | 'voiceDurationLimit' | 'sizeLimit' | 'loudnessMin' | 'loudnessMax' | 'rateLimit', value: number) => setConfig({ ...config, [key]: value })
  const exportQueue = () => {
    const blob = new Blob([JSON.stringify(submissions, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'sound-reactions-submissions.json'; anchor.click(); URL.revokeObjectURL(url)
  }
  return <div className="page-wrap governance-page"><header className="page-header"><span className="eyebrow">DYNAMIC MEDIA GOVERNANCE · ADAPTED</span><h1>Governance workspace</h1><p>Deterministic controls and simulated review—not real AI moderation, legal compliance or certification.</p></header>
    <section className="metric-grid" aria-label="Submission metrics"><div><span>Submissions</span><strong>{submissions.length}</strong><small>Local demo total</small></div><div><span>Published</span><strong>{published}</strong><small>Passed preflight</small></div><div><span>Needs review</span><strong>{queue.length}</strong><small>Holds + reports</small></div><div><span>Audit events</span><strong>{audits.length}</strong><small>Append-only in UI</small></div></section>
    <div className="governance-notice"><ShieldCheck size={21} /><p><strong>Pipeline</strong> SUBMIT → PREFLIGHT → REVIEW IF FLAGGED → PUBLISH / HOLD / BLOCK → AUDIT. REVIEW is held rather than provisionally published in this prototype.</p></div>
    <section className="workspace-section"><div className="section-title-row"><div><span className="eyebrow">LIVE POLICY</span><h2>Thresholds</h2></div><Link to="/compose" className="text-link">Test in composer <ArrowUpRight size={15} /></Link></div><div className="threshold-grid">
      <label>Reaction duration limit (s)<input type="number" min="1" value={config.durationLimit} onChange={(event) => numeric('durationLimit', Number(event.target.value))} /></label>
      <label>Voice duration limit (s)<input type="number" min="1" value={config.voiceDurationLimit} onChange={(event) => numeric('voiceDurationLimit', Number(event.target.value))} /></label>
      <label>File-size limit (KB)<input type="number" min="1" value={config.sizeLimit} onChange={(event) => numeric('sizeLimit', Number(event.target.value))} /></label>
      <label>Rate limit / post / hour<input type="number" min="1" value={config.rateLimit} onChange={(event) => numeric('rateLimit', Number(event.target.value))} /></label>
      <label>Minimum LUFS<input type="number" max="0" value={config.loudnessMin} onChange={(event) => numeric('loudnessMin', Number(event.target.value))} /></label>
      <label>Maximum LUFS<input type="number" max="0" value={config.loudnessMax} onChange={(event) => numeric('loudnessMax', Number(event.target.value))} /></label>
    </div><p className="fine-print">Demo loudness is metadata plus a gain-table approximation, not measured LUFS or true-peak certification. Target: −18 LUFS speech / −16 LUFS music, −1 dBTP ceiling.</p></section>
    <section className="workspace-section"><h2>Failure policy</h2><div className="policy-grid">{Object.entries(policyLabels).map(([key, label]) => <label key={key}>{label}<select value={config.policies[key as CheckKey]} onChange={(event) => setConfig({ ...config, policies: { ...config.policies, [key]: event.target.value as FailurePolicy } })}><option value="REVIEW">REVIEW · hold</option><option value="BLOCK">BLOCK</option></select></label>)}</div></section>
    <section className="workspace-section"><div className="section-title-row"><div><span className="eyebrow">SIMULATED HUMAN REVIEW</span><h2>Moderation queue</h2></div><button className="icon-button" onClick={exportQueue} aria-label="Export submissions as JSON"><Download size={19} /></button></div>
      {queue.length === 0 ? <div className="empty-state"><Check size={28} /><h3>Queue is clear</h3><p>Submit a flagged composer scenario or report a sound reaction from the feed.</p><Link to="/compose" className="secondary-button">Open composer</Link></div> : <div className="review-list">{queue.map((item) => <article key={item.id} className="review-item"><header><div><span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status}</span><strong>{item.clip.name}</strong><small>{item.id} · {new Date(item.submittedAt).toLocaleString()}</small></div><AlertTriangle size={20} /></header><p>{item.postText}</p><div className="reason-codes">{item.reportReason ? `Report: ${item.reportReason}` : item.reasonCodes.join(' · ')}</div><p className="statement">{item.statementOfReasons}</p><div className="review-actions"><button onClick={() => moderate(item.id, 'approve')}><Check size={16} /> Approve</button><button onClick={() => moderate(item.id, 'remove')}>Remove reaction</button><button onClick={() => moderate(item.id, 'escalate')}>Escalate</button></div></article>)}</div>}
    </section>
    <section className="workspace-section"><h2>Decision history</h2>{submissions.length === 0 ? <p className="muted">No submissions yet. The audit trail begins with your first local action.</p> : <div className="submission-table" tabIndex={0} role="region" aria-label="Submission decision history"><div className="table-row table-head"><span>Clip</span><span>Decision</span><span>Status</span><span>Reasons</span></div>{submissions.map((item) => <div className="table-row" key={item.id}><span>{item.clip.name}</span><strong>{item.decision}</strong><span>{item.status}</span><span>{item.reasonCodes.join(', ') || '—'}</span></div>)}</div>}</section>
    <section className="workspace-section"><div className="section-title-row"><div><span className="eyebrow">CONTROL PROVENANCE</span><h2>Governance mapping</h2></div><FileWarning size={22} /></div><div className="mapping-list">{GOVERNANCE_MAPPING.map((row) => <div key={row.control}><strong>{row.control}</strong><span>{row.origin}</span><p>{row.implementation}</p></div>)}</div>
      <div className="legal-note"><strong>Corrected legal mapping</strong><p>WCAG 2.2 AA is the design target. ADA Title II is not claimed to bind X. DSA Arts. 16 / 17 / 20 cover notices, reasons and complaints; Arts. 34 / 35 cover systemic risk. EU AI Act Art. 50 informs synthetic-audio labels; no Art. 14 obligation is claimed.</p></div>
    </section>
  </div>
}
