import type { Clip, GovernanceConfig, PreflightCheck, PreflightResult } from './types'

/** Generated library files carry loudness measured at build time; synth and live recordings do not. */
function measuredLoudness(clip: Clip) {
  return Boolean(clip.audioUrl && !clip.audioUrl.startsWith('blob:'))
}

export function runPreflight(clip: Clip, config: GovernanceConfig, rateCount = 0): PreflightResult {
  const durationLimit = clip.kind === 'voice' ? config.voiceDurationLimit : config.durationLimit
  const definitions: Array<Omit<PreflightCheck, 'policy'>> = [
    { key: 'duration', label: `${clip.kind === 'voice' ? 'Voice post' : 'Reaction'} duration ≤ ${durationLimit} s`, passed: clip.duration <= durationLimit, simulated: false, detail: `${clip.duration}s submitted` },
    { key: 'size', label: `File size ≤ ${config.sizeLimit} KB`, passed: clip.sizeKb <= config.sizeLimit, simulated: false, detail: `${clip.sizeKb} KB submitted` },
    { key: 'transcript', label: 'Transcript or sound description present', passed: Boolean(clip.transcript.trim() || clip.description.trim()), simulated: false, detail: clip.transcript.trim() ? 'Text alternative supplied' : 'No transcript supplied' },
    { key: 'loudness', label: `Loudness ${config.loudnessMin} to ${config.loudnessMax} LUFS (max momentary)`, passed: clip.lufs >= config.loudnessMin && clip.lufs <= config.loudnessMax, simulated: false, detail: measuredLoudness(clip) ? `${clip.lufs} LUFS, measured with ffmpeg EBU R128 at build time (not certified)` : `${clip.lufs} LUFS metadata; synthesized or recorded audio is not measured` },
    { key: 'rate', label: `Rate limit ≤ ${config.rateLimit} per post / hour`, passed: rateCount < config.rateLimit, simulated: false, detail: `${rateCount} prior reactions in this demo window` },
    { key: 'abuse', label: 'SIMULATED abuse keyword / flag', passed: !clip.abuse, simulated: true, detail: clip.abuse ? 'SIMULATED abusive-content flag' : 'SIMULATED: no abuse flag' },
    { key: 'copyright', label: 'SIMULATED copyright fingerprint', passed: !clip.copyright, simulated: true, detail: clip.copyright ? 'SIMULATED fingerprint match' : 'SIMULATED: no fingerprint match' },
    { key: 'synthetic', label: 'AI / cloned voice label when declared', passed: !clip.aiDeclared || clip.aiLabel, simulated: false, detail: clip.aiDeclared ? (clip.aiLabel ? 'AI label present' : 'Declared AI, label missing') : 'Not declared as AI-generated' },
  ]
  const checks = definitions.map((check) => ({ ...check, policy: config.policies[check.key] }))
  const failed = checks.filter((check) => !check.passed)
  const decision = failed.some((check) => check.policy === 'BLOCK') ? 'BLOCK' : failed.length ? 'REVIEW' : 'PASS'
  return {
    decision,
    outcome: decision === 'PASS' ? 'PUBLISHED' : decision === 'REVIEW' ? 'HOLD' : 'BLOCKED',
    reasonCodes: failed.map((check) => `${check.key.toUpperCase()}_${check.policy}`),
    checks,
  }
}

export function decisionCopy(result: PreflightResult): string {
  if (result.decision === 'PASS') return 'All checks passed. Ready to publish locally.'
  if (result.decision === 'REVIEW') return 'Held for simulated human review. Not published.'
  return 'Blocked by configured policy. Not published.'
}

export const GOVERNANCE_MAPPING: Array<{ control: string; origin: string; implementation: string }> = [
  { control: 'Pre-publication analysis gate', origin: 'Framework 03.1 · reused', implementation: 'Every composer submission runs eight deterministic checks before local publishing.' },
  { control: 'Provisional publish + review', origin: 'Framework 03.1 · reused', implementation: 'REVIEW holds in this prototype; BLOCK is reserved for configured severe rules.' },
  { control: 'Flash-safe visualizer', origin: 'Framework 03.1 · adapted', implementation: 'No strobing; transform-only bars, reduced-motion alternative. Audio itself cannot flash.' },
  { control: '8 s duration / 256 KB size', origin: 'New proposal', implementation: 'Editable reaction thresholds. Video controls are not reused.' },
  { control: 'Auto-pause', origin: 'Framework 03.2 · adapted', implementation: 'Stops on scroll-away, hidden tab and the explicit low-power toggle.' },
  { control: 'No autoplay / visible alternatives', origin: 'WCAG 1.4.2 / 1.2.1', implementation: 'Gesture-only playback and persistent text descriptions.' },
  { control: 'Report + statement of reasons', origin: 'DSA Arts. 16, 17, 20', implementation: 'Separate reaction reporting, review actions and reason statements.' },
  { control: 'AI / cloned voice label', origin: 'EU AI Act Art. 50', implementation: 'Required when AI generation is declared. No Art. 14 claim.' },
  { control: 'Biometric ID anchor', origin: 'Framework 03.3 · not applied', implementation: 'Deliberately omitted as disproportionate for 8-second reactions.' },
]
