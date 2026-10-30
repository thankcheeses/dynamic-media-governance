import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_CONFIG, DEFAULT_SETTINGS, SEED_POSTS } from './data'
import type { AppSettings, AuditEvent, Clip, GovernanceConfig, MediaKind, Post, PreflightResult, Submission } from './types'

const isSessionAudio = (url?: string) => Boolean(url?.startsWith('blob:'))
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const now = () => new Date().toISOString()

const safeStorage: Storage = {
  getItem: (key) => { try { return window.localStorage.getItem(key) } catch { return null } },
  setItem: (key, value) => { try { window.localStorage.setItem(key, value) } catch { /* storage may be unavailable */ } },
  removeItem: (key) => { try { window.localStorage.removeItem(key) } catch { /* storage may be unavailable */ } },
  clear: () => { try { window.localStorage.clear() } catch { /* storage may be unavailable */ } },
  key: (index) => { try { return window.localStorage.key(index) } catch { return null } },
  get length() { try { return window.localStorage.length } catch { return 0 } },
}

interface AppState {
  settings: AppSettings
  config: GovernanceConfig
  posts: Post[]
  submissions: Submission[]
  audits: AuditEvent[]
  liked: string[]
  reposted: string[]
  bookmarked: string[]
  favorites: string[]
  toggleFavorite: (soundId: string) => void
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  setConfig: (config: GovernanceConfig) => void
  addAudit: (type: string, subjectId: string, detail: string) => void
  publish: (clip: Clip, postText: string, kind: MediaKind, result: PreflightResult) => string
  addReaction: (postId: string, clip: Clip, result: PreflightResult) => void
  reportReaction: (postId: string, reason: string) => void
  moderate: (submissionId: string, action: 'approve' | 'remove' | 'escalate') => void
  togglePostAction: (postId: string, action: 'like' | 'repost' | 'bookmark') => void
  resetDemo: () => void
}

const baseState = {
  settings: DEFAULT_SETTINGS,
  config: DEFAULT_CONFIG,
  posts: SEED_POSTS,
  submissions: [] as Submission[],
  audits: [] as AuditEvent[],
  liked: [] as string[],
  reposted: [] as string[],
  bookmarked: [] as string[],
  favorites: [] as string[],
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
  ...baseState,
  setSetting: (key, value) => set((state) => ({ settings: { ...state.settings, [key]: value } })),
  setConfig: (config) => set({ config }),
  addAudit: (type, subjectId, detail) => set((state) => ({
    audits: [...state.audits, { id: uid('evt'), timestamp: now(), type, actor: 'local-demo-user', subjectId, detail }],
  })),
  publish: (clip, postText, kind, result) => {
    const submissionId = uid('sub')
    const postId = uid('post')
    const submission: Submission = {
      id: submissionId, submittedAt: now(), clip, postText, postId,
      decision: result.decision, status: result.outcome, reasonCodes: result.reasonCodes, checks: result.checks,
      statementOfReasons: result.decision === 'PASS' ? 'Published locally after all configured preflight checks passed.' : `Submission ${result.outcome === 'HOLD' ? 'held' : 'blocked'} by deterministic preflight. Automated checks are disclosed; no AI moderation was used.`,
    }
    const events: AuditEvent[] = [
      { id: uid('evt'), timestamp: now(), type: 'media_submitted', actor: 'local-demo-user', subjectId: submissionId, detail: `${kind} submitted: ${clip.name}` },
      { id: uid('evt'), timestamp: now(), type: 'preflight_started', actor: 'local-demo-user', subjectId: submissionId, detail: 'Eight configured checks started' },
      ...result.checks.map((check) => ({ id: uid('evt'), timestamp: now(), type: 'check_completed', actor: 'preflight-engine', subjectId: submissionId, detail: `${check.label}: ${check.passed ? 'PASS' : check.policy}` })),
      ...(result.decision !== 'PASS' ? [{ id: uid('evt'), timestamp: now(), type: 'flagged', actor: 'preflight-engine', subjectId: submissionId, detail: result.reasonCodes.join(', ') }] : []),
      ...(result.decision === 'REVIEW' ? [{ id: uid('evt'), timestamp: now(), type: 'review_requested', actor: 'preflight-engine', subjectId: submissionId, detail: result.reasonCodes.join(', ') }] : []),
      { id: uid('evt'), timestamp: now(), type: 'decision_recorded', actor: 'preflight-engine', subjectId: submissionId, detail: `${result.decision}: ${result.reasonCodes.join(', ') || 'all checks passed'}` },
    ]
    set((state) => {
      const newPost: Post = {
        id: postId, author: 'B. Baynard-Malone', handle: '@baynardmalone', initials: 'BB', timestamp: 'now',
        body: postText || `Shared a ${kind === 'voice' ? 'voice post' : `${clip.name} sound reaction`}.`,
        voice: kind === 'voice' ? { ...clip, id: `${clip.id}-${postId}` } : undefined,
        reaction: kind === 'reaction' ? { ...clip, id: `${clip.id}-${postId}`, count: 1 } : undefined,
        replyCount: 0, repostCount: 0, likeCount: 0, viewCount: 1, following: true,
      }
      return {
        submissions: [submission, ...state.submissions], audits: [...state.audits, ...events],
        posts: result.decision === 'PASS' ? [newPost, ...state.posts] : state.posts,
      }
    })
    return submissionId
  },
  addReaction: (postId, clip, result) => {
    const submissionId = uid('sub')
    const submission: Submission = {
      id: submissionId, submittedAt: now(), clip, postText: `Reaction to ${postId}`, postId,
      decision: result.decision, status: result.outcome, reasonCodes: result.reasonCodes, checks: result.checks,
    }
    set((state) => ({
      submissions: [submission, ...state.submissions],
      posts: result.decision === 'PASS' ? state.posts.map((post) => post.id === postId ? { ...post, reaction: { ...clip, id: `${clip.id}-${postId}`, count: (post.reaction?.count ?? 0) + 1 } } : post) : state.posts,
      audits: [...state.audits,
        { id: uid('evt'), timestamp: now(), type: 'media_submitted', actor: 'local-demo-user', subjectId: submissionId, detail: `Reaction added to ${postId}` },
        { id: uid('evt'), timestamp: now(), type: 'preflight_started', actor: 'preflight-engine', subjectId: submissionId, detail: 'Eight configured checks started' },
        ...result.checks.map((check) => ({ id: uid('evt'), timestamp: now(), type: 'check_completed', actor: 'preflight-engine', subjectId: submissionId, detail: `${check.label}: ${check.passed ? 'PASS' : check.policy}` })),
        ...(result.decision !== 'PASS' ? [{ id: uid('evt'), timestamp: now(), type: 'flagged', actor: 'preflight-engine', subjectId: submissionId, detail: result.reasonCodes.join(', ') }] : []),
        ...(result.decision === 'REVIEW' ? [{ id: uid('evt'), timestamp: now(), type: 'review_requested', actor: 'preflight-engine', subjectId: submissionId, detail: result.reasonCodes.join(', ') }] : []),
        { id: uid('evt'), timestamp: now(), type: 'decision_recorded', actor: 'preflight-engine', subjectId: submissionId, detail: `${result.decision}: ${result.reasonCodes.join(', ') || 'all checks passed'}` },
      ],
    }))
  },
  reportReaction: (postId, reason) => {
    const post = get().posts.find((item) => item.id === postId)
    if (!post?.reaction) return
    const submissionId = uid('report')
    const submission: Submission = {
      id: submissionId, submittedAt: now(), clip: post.reaction, postText: post.body, postId,
      decision: 'REVIEW', status: 'REPORTED', reasonCodes: ['USER_REPORT'], checks: [], reportReason: reason,
      statementOfReasons: 'Report received under the simulated DSA notice-and-action flow. No moderation decision has yet been made.',
    }
    set((state) => ({
      submissions: [submission, ...state.submissions],
      audits: [...state.audits, { id: uid('evt'), timestamp: now(), type: 'reaction_reported', actor: 'local-demo-user', subjectId: submissionId, detail: `${postId}: ${reason}` }],
    }))
  },
  moderate: (submissionId, action) => set((state) => {
    const target = state.submissions.find((item) => item.id === submissionId)
    if (!target) return state
    const status = action === 'approve' ? 'PUBLISHED' : action === 'remove' ? 'REMOVED' : 'ESCALATED'
    const publishHeld = action === 'approve' && target.status === 'HOLD' && Boolean(target.postId) && !state.posts.some((post) => post.id === target.postId)
    const statement = action === 'approve'
      ? `Approved after simulated human review. ${publishHeld ? 'The submission was published into the local feed.' : 'The reaction may remain visible.'} This was a reviewer decision following disclosed automated preflight checks.`
      : action === 'remove'
        ? `Removed after simulated human review. Grounds: ${target.reportReason || target.reasonCodes.join(', ') || 'policy review'}. Automated preflight signals were disclosed and were not the sole basis for this demo decision.`
        : 'Escalated to a second simulated reviewer. No final restriction has been applied.'
    const approvedPost: Post | null = publishHeld && target.postId ? {
      id: target.postId, author: 'B. Baynard-Malone', handle: '@baynardmalone', initials: 'BB', timestamp: 'now',
      body: target.postText || `Shared a ${target.clip.kind === 'voice' ? 'voice post' : `${target.clip.name} sound reaction`}.`,
      voice: target.clip.kind === 'voice' ? { ...target.clip, id: `${target.clip.id}-${target.postId}` } : undefined,
      reaction: target.clip.kind === 'reaction' ? { ...target.clip, id: `${target.clip.id}-${target.postId}`, count: 1 } : undefined,
      replyCount: 0, repostCount: 0, likeCount: 0, viewCount: 1, following: true,
    } : null
    return {
      submissions: state.submissions.map((item) => item.id === submissionId ? { ...item, status, statementOfReasons: statement } : item),
      posts: approvedPost ? [approvedPost, ...state.posts] : action === 'remove' && target.postId ? state.posts.map((post) => post.id === target.postId && post.reaction ? { ...post, reaction: { ...post.reaction, removed: true } } : post) : state.posts,
      audits: [...state.audits, { id: uid('evt'), timestamp: now(), type: 'moderation_action', actor: 'simulated-reviewer', subjectId: submissionId, detail: `${action.toUpperCase()}: ${statement}` }],
    }
  }),
  togglePostAction: (postId, action) => set((state) => {
    const key = action === 'like' ? 'liked' : action === 'repost' ? 'reposted' : 'bookmarked'
    const active = state[key].includes(postId)
    return {
      [key]: active ? state[key].filter((id) => id !== postId) : [...state[key], postId],
      posts: action === 'bookmark' ? state.posts : state.posts.map((post) => {
        if (post.id !== postId) return post
        return action === 'like' ? { ...post, likeCount: post.likeCount + (active ? -1 : 1) } : { ...post, repostCount: post.repostCount + (active ? -1 : 1) }
      }),
    }
  }),
  toggleFavorite: (soundId) => set((state) => ({ favorites: state.favorites.includes(soundId) ? state.favorites.filter((id) => id !== soundId) : [...state.favorites, soundId] })),
  resetDemo: () => set({ ...baseState, settings: get().settings, config: DEFAULT_CONFIG }),
}), {
  name: 'sound-reactions-demo-v3',
  storage: createJSONStorage(() => safeStorage),
  version: 1,
  partialize: (state) => ({
    ...state,
    // Only live microphone recordings (blob: URLs) are session-only. Generated
    // library sounds are static files and persist like any other post.
    posts: state.posts.filter((post) => !isSessionAudio(post.voice?.audioUrl) && !isSessionAudio(post.reaction?.audioUrl)),
    submissions: state.submissions.filter((submission) => !isSessionAudio(submission.clip.audioUrl)),
  }),
}))
