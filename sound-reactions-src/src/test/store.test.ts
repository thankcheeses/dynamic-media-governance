import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PICK } from '../banner'
import { DEFAULT_HEADER_ID } from '../headers'
import { DEFAULT_CONFIG, DEFAULT_SETTINGS, SOUND_LIBRARY } from '../data'
import { runPreflight } from '../governance'
import { recordDecision } from '../ledger'
import { migrateState, partializeState, preferencesOf, settingsFrom } from '../persistence'
import { useAppStore } from '../store'

const clip = () => ({ ...SOUND_LIBRARY[0] })
const clock = { id: (prefix: string) => `${prefix}-1`, now: () => '2026-11-08T00:00:00.000Z' }

beforeEach(() => { useAppStore.getState().resetDemo(); useAppStore.setState({ settings: DEFAULT_SETTINGS, highlights: [], audits: [], submissions: [] }) })

describe('submission ledger', () => {
  it('records the six-event trail and the owner post for a passing publish', () => {
    const result = runPreflight(clip(), DEFAULT_CONFIG)
    const { submission, events, post } = recordDecision({ kind: 'publish', clip: clip(), postText: 'hi', mediaKind: 'reaction', result }, clock)
    expect(submission).toMatchObject({ id: 'sub-1', postId: 'post-1', decision: 'PASS', status: 'PUBLISHED' })
    expect(events.map((e) => e.type)).toEqual(['media_submitted', 'preflight_started', ...result.checks.map(() => 'check_completed'), 'decision_recorded'])
    expect(post).toMatchObject({ id: 'post-1', handle: '@baynardmalone', author: 'B. Baynard-Malone', body: 'hi', following: true })
    expect(post?.reaction?.count).toBe(1)
  })

  it('emits flagged and review_requested for a REVIEW decision and no post', () => {
    const result = runPreflight({ ...clip(), transcript: '', description: '' }, DEFAULT_CONFIG)
    const { events, post } = recordDecision({ kind: 'publish', clip: clip(), postText: '', mediaKind: 'reaction', result }, clock)
    expect(events.map((e) => e.type)).toContain('flagged')
    expect(events.map((e) => e.type)).toContain('review_requested')
    expect(post).toBeNull()
  })

  it('flags everything about an imported post as ephemeral', () => {
    const result = runPreflight(clip(), DEFAULT_CONFIG)
    const { submission, events } = recordDecision({ kind: 'reaction', clip: clip(), postId: 'x-123', result }, clock)
    expect(submission.postText).toBe('Reaction to x-123')
    expect(events.every((e) => e.ephemeral)).toBe(true)
  })

  it('publish and moderate-approve of a held post produce the same owner post', () => {
    const store = useAppStore.getState()
    const held = runPreflight({ ...clip(), transcript: '', description: '' }, DEFAULT_CONFIG)
    const submissionId = store.publish(clip(), 'held one', 'reaction', held)
    expect(useAppStore.getState().posts.some((p) => p.body === 'held one')).toBe(false)
    useAppStore.getState().moderate(submissionId, 'approve')
    const approved = useAppStore.getState().posts.find((p) => p.body === 'held one')
    const passed = runPreflight(clip(), DEFAULT_CONFIG)
    useAppStore.getState().publish(clip(), 'passed one', 'reaction', passed)
    const published = useAppStore.getState().posts.find((p) => p.body === 'passed one')
    const shape = (p: typeof approved) => p && { author: p.author, handle: p.handle, initials: p.initials, following: p.following, count: p.reaction?.count, voice: p.voice }
    expect(shape(approved)).toEqual(shape(published))
  })
})

describe('persistence policy', () => {
  it('keeps an audit whose free text contains "x-" and drops audits flagged ephemeral', () => {
    const state = useAppStore.getState()
    state.addAudit('header_scanned', 'upload', 'Relax-time.gif: PASS')
    state.addAudit('reaction_reported', 'x-42', 'imported post report')
    const saved = partializeState(useAppStore.getState())
    expect(saved.audits.map((e) => e.detail)).toEqual(['Relax-time.gif: PASS'])
  })

  it('drops submissions and audits about imported posts, and pins on them, but keeps owner pins', () => {
    const state = useAppStore.getState()
    state.addReaction('x-9', clip(), runPreflight(clip(), DEFAULT_CONFIG))
    state.toggleHighlight('x-9'); state.toggleHighlight('post-1')
    const saved = partializeState(useAppStore.getState())
    expect(saved.submissions).toEqual([])
    expect(saved.audits.filter((e) => e.subjectId === 'sub-1' || e.ephemeral)).toEqual([])
    expect(saved.highlights).toEqual(['post-1'])
  })

  it('stores only the settings the viewer changed, so a new product default wins unless they chose otherwise', () => {
    expect(preferencesOf(DEFAULT_SETTINGS)).toEqual({})
    expect(preferencesOf({ ...DEFAULT_SETTINGS, volume: 0.3 })).toEqual({ volume: 0.3 })
    expect(settingsFrom({ volume: 0.3 })).toEqual({ ...DEFAULT_SETTINGS, volume: 0.3 })
  })

  it('never stores an upload pick: it falls back to the default preset', () => {
    const saved = partializeState({ ...useAppStore.getState(), profileHeader: { kind: 'upload', decision: 'PASS' } })
    expect(saved.profileHeader).toEqual(DEFAULT_PICK)
  })

  it('migrates a v1 save: Dim and low power reset, header pick becomes tagged, chosen inferred', () => {
    const v1 = { settings: { ...DEFAULT_SETTINGS, theme: 'dim', lowPower: true, volume: 0.5 }, profileHeader: { presetId: 'neon-cats', decision: 'PASS' }, posts: [], audits: [] }
    const out = migrateState(v1, 1)
    expect(out.preferences).toEqual({ volume: 0.5 })
    expect(out.profileHeader).toEqual({ kind: 'preset', presetId: 'neon-cats', decision: 'PASS', chosen: true })
    expect(out.highlights).toEqual([])
  })

  it('migrates a v2 save whose pick was the default or an upload to "not yet chosen"', () => {
    expect(migrateState({ settings: DEFAULT_SETTINGS, profileHeader: { presetId: DEFAULT_HEADER_ID, decision: 'PASS' } }, 2).profileHeader).toEqual(DEFAULT_PICK)
    expect(migrateState({ settings: DEFAULT_SETTINGS, profileHeader: { presetId: 'upload', decision: 'PASS' } }, 2).profileHeader).toEqual(DEFAULT_PICK)
  })

  it('resetDemo keeps settings', () => {
    useAppStore.getState().setSetting('volume', 0.2)
    useAppStore.getState().resetDemo()
    expect(useAppStore.getState().settings.volume).toBe(0.2)
  })

  it('removeEphemeral clears imported posts, their submissions, audits and pins', () => {
    const state = useAppStore.getState()
    state.addPosts([{ id: 'x-1', author: 'Me', handle: '@me', initials: 'M', timestamp: 'now', body: 'mine', replyCount: 0, repostCount: 0, likeCount: 0, viewCount: 0, following: false, ephemeral: true }])
    state.addReaction('x-1', clip(), runPreflight(clip(), DEFAULT_CONFIG))
    state.toggleHighlight('x-1')
    useAppStore.getState().removeEphemeral()
    const after = useAppStore.getState()
    expect(after.posts.some((p) => p.id === 'x-1')).toBe(false)
    expect(after.submissions).toEqual([])
    expect(after.audits).toEqual([])
    expect(after.highlights).toEqual([])
  })
})
