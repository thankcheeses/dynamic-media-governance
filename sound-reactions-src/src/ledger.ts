/**
 * The submission ledger: one function turns a preflight decision into the
 * submission record, its audit trail and, when it passes, the owner's post.
 * `publish`, `addReaction` and `moderate` in the store all go through here, so
 * the six-event audit sequence and the shape of an owner post exist once.
 *
 * Pure: it takes ids and timestamps from its caller and returns plain values.
 */
import { ACCOUNTS, OWNER_HANDLE } from './accounts'
import type { AuditEvent, Clip, MediaKind, Post, PreflightResult, Submission } from './types'

export interface LedgerClock { id: (prefix: string) => string; now: () => string }

/** Id prefix of posts imported from the viewer's own archive. Anything about them is ephemeral. */
export const EPHEMERAL_PREFIX = 'x-'
export const isEphemeralPostId = (postId: string | undefined) => Boolean(postId?.startsWith(EPHEMERAL_PREFIX))

export type Decision =
  | { kind: 'publish'; clip: Clip; postText: string; mediaKind: MediaKind; result: PreflightResult }
  | { kind: 'reaction'; clip: Clip; postId: string; result: PreflightResult }

export interface Recorded {
  submission: Submission
  events: AuditEvent[]
  /** The owner's new post, only when a publish decision passed. */
  post: Post | null
}

/** The owner account's post, as the feed shows it. Used by publish and by moderation when a held post is approved. */
export function ownerPost(postId: string, clip: Clip, postText: string): Post {
  const owner = ACCOUNTS.find((account) => account.handle === OWNER_HANDLE)!
  const kind: MediaKind = clip.kind
  return {
    id: postId, author: owner.name, handle: owner.handle, initials: owner.initials, timestamp: 'now',
    body: postText || `Shared a ${kind === 'voice' ? 'voice post' : `${clip.name} sound reaction`}.`,
    voice: kind === 'voice' ? { ...clip, id: `${clip.id}-${postId}` } : undefined,
    reaction: kind === 'reaction' ? { ...clip, id: `${clip.id}-${postId}`, count: 1 } : undefined,
    replyCount: 0, repostCount: 0, likeCount: 0, viewCount: 1, following: true,
  }
}

/** The audit trail every preflight produces: submitted, started, one line per check, flagged/review when needed, decided. */
export function preflightTrail(clock: LedgerClock, submissionId: string, submitted: string, result: PreflightResult, ephemeral: boolean): AuditEvent[] {
  const event = (type: string, actor: string, detail: string): AuditEvent => ({ id: clock.id('evt'), timestamp: clock.now(), type, actor, subjectId: submissionId, detail, ...(ephemeral ? { ephemeral: true } : {}) })
  return [
    event('media_submitted', 'local-demo-user', submitted),
    event('preflight_started', 'preflight-engine', 'Eight configured checks started'),
    ...result.checks.map((check) => event('check_completed', 'preflight-engine', `${check.label}: ${check.passed ? 'PASS' : check.policy}`)),
    ...(result.decision !== 'PASS' ? [event('flagged', 'preflight-engine', result.reasonCodes.join(', '))] : []),
    ...(result.decision === 'REVIEW' ? [event('review_requested', 'preflight-engine', result.reasonCodes.join(', '))] : []),
    event('decision_recorded', 'preflight-engine', `${result.decision}: ${result.reasonCodes.join(', ') || 'all checks passed'}`),
  ]
}

export function recordDecision(decision: Decision, clock: LedgerClock): Recorded {
  const { clip, result } = decision
  const submissionId = clock.id('sub')
  const postId = decision.kind === 'publish' ? clock.id('post') : decision.postId
  const ephemeral = isEphemeralPostId(postId)
  const base = { id: submissionId, submittedAt: clock.now(), clip, postId, decision: result.decision, status: result.outcome, reasonCodes: result.reasonCodes, checks: result.checks }
  if (decision.kind === 'publish') {
    const submission: Submission = {
      ...base, postText: decision.postText,
      statementOfReasons: result.decision === 'PASS'
        ? 'Published locally after all configured preflight checks passed.'
        : `Submission ${result.outcome === 'HOLD' ? 'held' : 'blocked'} by deterministic preflight. Automated checks are disclosed; no AI moderation was used.`,
    }
    const events = preflightTrail(clock, submissionId, `${decision.mediaKind} submitted: ${clip.name}`, result, ephemeral)
    return { submission, events, post: result.decision === 'PASS' ? ownerPost(postId, clip, decision.postText) : null }
  }
  const submission: Submission = { ...base, postText: `Reaction to ${postId}` }
  return { submission, events: preflightTrail(clock, submissionId, `Reaction added to ${postId}`, result, ephemeral), post: null }
}
