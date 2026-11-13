/**
 * What the main store writes to localStorage, and how older saves are read.
 *
 * Persistence is an allow-list: each slice below is named and filtered on
 * purpose. Anything not named stays in the tab. Ephemerality is carried by a
 * flag (`post.ephemeral`, `event.ephemeral`, a submission about an ephemeral
 * post), never by matching free text.
 *
 * Settings are stored as the viewer's *preferences*: only the keys they changed
 * from the product defaults. A product default can then change in a release
 * without a migration, and a viewer's explicit choice still wins.
 */
import { DEFAULT_SETTINGS } from './data'
import { DEFAULT_PICK, type HeaderPick } from './banner'
import { DEFAULT_HEADER_ID } from './headers'
import { isEphemeralPostId } from './ledger'
import type { AppSettings, AuditEvent, GovernanceConfig, Post, Submission } from './types'

export const STORAGE_KEY = 'sound-reactions-demo-v3'
export const STORAGE_VERSION = 3

/** The slices that survive a reload. */
export interface PersistedState {
  preferences: Partial<AppSettings>
  config: GovernanceConfig
  posts: Post[]
  submissions: Submission[]
  audits: AuditEvent[]
  liked: string[]
  reposted: string[]
  bookmarked: string[]
  favorites: string[]
  highlights: string[]
  profileHeader: HeaderPick
}

export interface PersistableState extends Omit<PersistedState, 'preferences'> { settings: AppSettings }

/** Live microphone recordings and sounds picked in this tab are blob: URLs, which die with the tab. */
export const isSessionAudio = (url?: string) => Boolean(url?.startsWith('blob:'))

/** The keys of `settings` that differ from the shipped defaults. */
export function preferencesOf(settings: AppSettings): Partial<AppSettings> {
  const out: Partial<AppSettings> = {}
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    if (settings[key] !== DEFAULT_SETTINGS[key]) (out as Record<string, unknown>)[key] = settings[key]
  }
  return out
}

export const settingsFrom = (preferences: Partial<AppSettings> | undefined): AppSettings => ({ ...DEFAULT_SETTINGS, ...preferences })

export function partializeState(state: PersistableState): PersistedState {
  const ephemeralSubmissions = new Set(state.submissions.filter((sub) => isEphemeralPostId(sub.postId)).map((sub) => sub.id))
  return {
    preferences: preferencesOf(state.settings),
    config: state.config,
    posts: state.posts.filter((post) => !post.ephemeral && !isSessionAudio(post.voice?.audioUrl) && !isSessionAudio(post.reaction?.audioUrl)),
    submissions: state.submissions.filter((sub) => !isSessionAudio(sub.clip.audioUrl) && !ephemeralSubmissions.has(sub.id)),
    audits: state.audits.filter((event) => !event.ephemeral && !ephemeralSubmissions.has(event.subjectId)),
    liked: state.liked, reposted: state.reposted, bookmarked: state.bookmarked, favorites: state.favorites,
    // Pins on imported posts die with the import; pins on the owner demo's posts stay on this device.
    highlights: state.highlights.filter((id) => !isEphemeralPostId(id)),
    // An uploaded header's frames are never stored, so a saved upload pick falls back to the default preset.
    profileHeader: state.profileHeader.kind === 'upload' ? DEFAULT_PICK : state.profileHeader,
  }
}

/** Shapes older saves had. */
interface LegacyState {
  settings?: Partial<AppSettings>
  preferences?: Partial<AppSettings>
  profileHeader?: { presetId?: string; decision?: HeaderPick['decision']; kind?: string; chosen?: boolean }
  highlights?: string[]
  [key: string]: unknown
}

/**
 * v1 → v2: Lights out is the only theme that ships black, so a saved Dim choice was reset once. Low-power mode was
 * reset too: before the fix in src/audio.ts, turning it on blanked the app, so a saved "on" was never a working choice.
 * v2 → v3: settings become preferences (only the keys that differ from the defaults); the header pick becomes a tagged
 * value, with `chosen` inferred from whether it still pointed at the default.
 */
export function migrateState(persisted: unknown, version: number): PersistedState {
  const state = (persisted ?? {}) as LegacyState
  let settings: Partial<AppSettings> = state.preferences ?? state.settings ?? {}
  if (version < 2) settings = { ...settings, theme: 'lights-out', lowPower: false }
  const legacyPick = state.profileHeader
  const profileHeader: HeaderPick = legacyPick?.kind === 'preset' || legacyPick?.kind === 'upload'
    ? (legacyPick as HeaderPick)
    : legacyPick?.presetId && legacyPick.presetId !== 'upload'
      ? { kind: 'preset', presetId: legacyPick.presetId, decision: legacyPick.decision ?? 'PASS', chosen: legacyPick.presetId !== DEFAULT_HEADER_ID }
      : DEFAULT_PICK
  const rest = Object.fromEntries(Object.entries(state).filter(([key]) => !['settings', 'preferences', 'profileHeader', 'highlights'].includes(key)))
  return { ...(rest as Omit<PersistedState, 'preferences' | 'profileHeader' | 'highlights'>), preferences: preferencesOf(settingsFrom(settings)), highlights: state.highlights ?? [], profileHeader }
}
