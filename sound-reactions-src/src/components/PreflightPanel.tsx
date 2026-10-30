import { AlertTriangle, Ban, Check, FlaskConical } from 'lucide-react'
import { decisionCopy } from '../governance'
import type { PreflightResult } from '../types'

export function PreflightPanel({ result }: { result: PreflightResult }) {
  const Icon = result.decision === 'PASS' ? Check : result.decision === 'REVIEW' ? AlertTriangle : Ban
  return (
    <section className={`preflight preflight-${result.decision.toLowerCase()}`} aria-labelledby="preflight-heading">
      <div className="preflight-summary">
        <Icon size={22} aria-hidden="true" />
        <div><span className="eyebrow">LIVE GOVERNANCE PREFLIGHT</span><h3 id="preflight-heading">{result.decision} · {result.outcome}</h3><p>{decisionCopy(result)}</p></div>
      </div>
      {result.reasonCodes.length > 0 && <div className="reason-codes">Reason codes: {result.reasonCodes.join(', ')}</div>}
      <ul className="check-list">
        {result.checks.map((check) => <li key={check.key}>
          <span className={`check-icon ${check.passed ? 'passed' : 'failed'}`}>{check.passed ? <Check size={15} /> : <AlertTriangle size={15} />}</span>
          <div><strong>{check.label}</strong><small>{check.detail}</small></div>
          <span className="check-outcome">{check.passed ? 'PASS' : check.policy}</span>
        </li>)}
      </ul>
      <p className="fine-print"><FlaskConical size={14} /> Deterministic demo logic. SIMULATED detectors are not AI moderation, legal compliance, or certification.</p>
    </section>
  )
}
