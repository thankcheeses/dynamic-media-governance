import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { UploadedMedia } from './analyze'
import { DEFAULT_PICK, type HeaderPick } from './banner'
import { DEFAULT_CONFIG, DEFAULT_SETTINGS, SEED_POSTS } from './data'
import { isEphemeralPostId, ownerPost, recordDecision, textPost, type LedgerClock } from './ledger'
import { migrateState, partializeState, settingsFrom, STORAGE_KEY, STORAGE_VERSION, type PersistedState } from './persistence'
import type { AppSettings, AuditEvent, Clip, GovernanceConfig, MediaKind, Post, PreflightResult, Submission } from './types'

export { EPHEMERAL_PREFIX } from './ledger'

const clock: LedgerClock = {
  id: (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  now: () => new Date().toISOString(),
}

const safeStorage: Storage = {
  getItem: (key) => { try { return window.localStorage.getItem(key) } catch { return null } },
  setItem: (key, value) => { try { window.localStorage.setItem(key, value) } catch { /* storage may be unavailable */ } },
  removeItem: (key) => { try { window.localStorage.removeItem(key) } catch { /* storage may be unavailable */ } },
  clear: () => { try { window.localStorage.clear() } catch { /* storage may be unavailable */ } },
  key: (index) => { try { return window.localStorage.key(index) } catch { return null } },
  get length() { try { return window.localStorage.length } catch { return 0 } },
}

export interface AppState {
  settings: AppSettings
  config: GovernanceConfig
  posts: Post[]
  submissions: Submission[]
  audits: AuditEvent[]
  liked: string[]
  reposted: string[]
  bookmarked: string[]
  favorites: string[]
  /** Post ids pinned to the Highlights tab: the owner demo's posts persist, imported posts' pins die with the import. */
  highlights: string[]
  /** The viewer's live header pick. Only PASS or PROVISIONAL headers can be set. */
  profileHeader: HeaderPick
  /** Publishes a preset the viewer scanned and chose in the studio. */
  pickPreset: (presetId: string, decision: HeaderPick['decision']) => void
  /** Publishes a file scanned in this tab. Its frames are session-only: they are never written to storage. */
  pickUpload: (media: UploadedMedia, decision: HeaderPick['decision']) => void
  uploadedHeader: UploadedMedia | null
  toggleFavorite: (soundId: string) => void
  toggleHighlight: (postId: string) => void
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  setConfig: (config: GovernanceConfig) => void
  addAudit: (type: string, subjectId: string, detail: string) => void
  publish: (clip: Clip, postText: string, kind: MediaKind, result: PreflightResult) => string
  /** Publishes a text-only post to the local feed. Returns its id, or null when the text is empty. */
  postText: (text: string) => string | null
  addReaction: (postId: string, clip: Clip, result: PreflightResult) => void
  reportReaction: (postId: string, reason: string) => void
  moderate: (submissionId: string, action: 'approve' | 'remove' | 'escalate') => void
  togglePostAction: (postId: string, action: 'like' | 'repost' | 'bookmark') => void
  /** Adds posts to the top of the feed (used for an imported archive; such posts are flagged ephemeral). */
  addPosts: (posts: Post[]) => void
  /** Drops ephemeral posts and every submission, audit entry or pin about them. */
  removeEphemeral: () => void
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
  highlights: [] as string[],
  profileHeader: DEFAULT_PICK,
  uploadedHeader: null as UploadedMedia | null,
}

const toggle = (list: string[], id: string, toFront = false) => (list.includes(id) ? list.filter((item) => item !== id) : toFront ? [id, ...list] : [...list, id])

export const useAppStore = create<AppState>()(persist((set, get) => ({
  ...baseState,
  setSetting: (key, value) => set((state) => ({ settings: { ...state.settings, [key]: value } })),
  setConfig: (config) => set({ config }),
  pickPreset: (presetId, decision) => set({ profileHeader: { kind: 'preset', presetId, decision, chosen: true }, uploadedHeader: null }),
  pickUpload: (media, decision) => set({ profileHeader: { kind: 'upload', decision }, uploadedHeader: media }),
  addAudit: (type, subjectId, detail) => set((state) => ({
    audits: [...state.audits, { id: clock.id('evt'), timestamp: clock.now(), type, actor: 'local-demo-user', subjectId, detail, ...(isEphemeralPostId(subjectId) ? { ephemeral: true } : {}) }],
  })),
  publish: (clip, postText, kind, result) => {
    const { submission, events, post } = recordDecision({ kind: 'publish', clip, postText, mediaKind: kind, result }, clock)
    set((state) => ({ submissions: [submission, ...state.submissions], audits: [...state.audits, ...events], posts: post ? [post, ...state.posts] : state.posts }))
    return submission.id
  },
  postText: (text) => {
    if (!text.trim()) return null
    const post = textPost(clock.id('post'), text)
    set((state) => ({
      posts: [post, ...state.posts],
      audits: [...state.audits, { id: clock.id('evt'), timestamp: clock.now(), type: 'text_post_published', actor: 'local-demo-user', subjectId: post.id, detail: 'Text post published locally; no sound attached, so no preflight ran' }],
    }))
    return post.id
  },
  addReaction: (postId, clip, result) => {
    const { submission, events } = recordDecision({ kind: 'reaction', clip, postId, result }, clock)
    set((state) => ({
      submissions: [submission, ...state.submissions],
      audits: [...state.audits, ...events],
      posts: result.decision === 'PASS' ? state.posts.map((post) => post.id === postId ? { ...post, reaction: { ...clip, id: `${clip.id}-${postId}`, count: (post.reaction?.count ?? 0) + 1 } } : post) : state.posts,
    }))
  },
  reportReaction: (postId, reason) => {
    const post = get().posts.find((item) => item.id === postId)
    if (!post?.reaction) return
    const submissionId = clock.id('report')
    const submission: Submission = {
      id: submissionId, submittedAt: clock.now(), clip: post.reaction, postText: post.body, postId,
      decision: 'REVIEW', status: 'REPORTED', reasonCodes: ['USER_REPORT'], checks: [], reportReason: reason,
      statementOfReasons: 'Report received under the simulated DSA notice-and-action flow. No moderation decision has yet been made.',
    }
    const ephemeral = isEphemeralPostId(postId)
    set((state) => ({
      submissions: [submission, ...state.submissions],
      audits: [...state.audits, { id: clock.id('evt'), timestamp: clock.now(), type: 'reaction_reported', actor: 'local-demo-user', subjectId: submissionId, detail: `${postId}: ${reason}`, ...(ephemeral ? { ephemeral: true } : {}) }],
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
    const approvedPost = publishHeld && target.postId ? ownerPost(target.postId, target.clip, target.postText) : null
    const ephemeral = isEphemeralPostId(target.postId)
    return {
      submissions: state.submissions.map((item) => item.id === submissionId ? { ...item, status, statementOfReasons: statement } : item),
      posts: approvedPost ? [approvedPost, ...state.posts] : action === 'remove' && target.postId ? state.posts.map((post) => post.id === target.postId && post.reaction ? { ...post, reaction: { ...post.reaction, removed: true } } : post) : state.posts,
      audits: [...state.audits, { id: clock.id('evt'), timestamp: clock.now(), type: 'moderation_action', actor: 'simulated-reviewer', subjectId: submissionId, detail: `${action.toUpperCase()}: ${statement}`, ...(ephemeral ? { ephemeral: true } : {}) }],
    }
  }),
  togglePostAction: (postId, action) => set((state) => {
    const key = action === 'like' ? 'liked' : action === 'repost' ? 'reposted' : 'bookmarked'
    const active = state[key].includes(postId)
    return {
      [key]: toggle(state[key], postId),
      posts: action === 'bookmark' ? state.posts : state.posts.map((post) => {
        if (post.id !== postId) return post
        return action === 'like' ? { ...post, likeCount: post.likeCount + (active ? -1 : 1) } : { ...post, repostCount: post.repostCount + (active ? -1 : 1) }
      }),
    }
  }),
  toggleFavorite: (soundId) => set((state) => ({ favorites: toggle(state.favorites, soundId) })),
  toggleHighlight: (postId) => set((state) => ({ highlights: toggle(state.highlights, postId, true) })),
  addPosts: (posts) => set((state) => ({ posts: [...posts, ...state.posts.filter((post) => !posts.some((p) => p.id === post.id))] })),
  removeEphemeral: () => set((state) => {
    const gone = new Set(state.submissions.filter((sub) => isEphemeralPostId(sub.postId)).map((sub) => sub.id))
    return {
      posts: state.posts.filter((post) => !post.ephemeral),
      submissions: state.submissions.filter((sub) => !gone.has(sub.id)),
      audits: state.audits.filter((event) => !event.ephemeral && !gone.has(event.subjectId)),
      highlights: state.highlights.filter((id) => !isEphemeralPostId(id)),
    }
  }),
  resetDemo: () => set({ ...baseState, settings: get().settings, config: DEFAULT_CONFIG }),
}), {
  name: STORAGE_KEY,
  storage: createJSONStorage(() => safeStorage),
  version: STORAGE_VERSION,
  migrate: (persisted, version) => migrateState(persisted, version),
  partialize: (state) => partializeState(state),
  merge: (persisted, current) => {
    const { preferences, ...rest } = (persisted ?? {}) as Partial<PersistedState>
    return { ...current, ...rest, settings: settingsFrom(preferences), uploadedHeader: null }
  },
}))
