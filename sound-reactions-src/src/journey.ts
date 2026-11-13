/**
 * The journey through the prototype: one ordered list of stops. The welcome
 * tour walks it, and the "Next" card at the foot of every page points to the
 * stop after the one you are on, so nobody has to guess where to go.
 */
export interface Stop {
  /** Route this stop lives on. */
  to: string
  /** Also counts as this stop (any profile is the "moving banner" stop, for example). */
  match?: RegExp
  /** What the Next card calls this stop when it is the one coming up. */
  invite: string
  /** The link text that takes you there. */
  go: string
}

export const STOPS: Stop[] = [
  { to: '/', invite: 'Hear a sound reaction', go: 'Back to the feed' },
  { to: '/u/deesaysso', match: /^\/u\//, invite: 'See a moving banner', go: 'Open Dee’s profile' },
  { to: '/profile', match: /^\/(profile|me)$/, invite: 'Try your own banner', go: 'Open my profile' },
  { to: '/compose', invite: 'Post a sound yourself', go: 'Write a post' },
  { to: '/governance', invite: 'See the safety checks', go: 'Open Governance' },
  { to: '/audit', invite: 'See what got logged', go: 'Open the audit log' },
  { to: '/compare', invite: 'Voice posts vs. reactions', go: 'Compare them' },
  { to: '/presentation', invite: 'The 8-slide walkthrough', go: 'Start the slides' },
]

/** Where the journey ends: the written proposal, outside the prototype. */
export const FINISH = { invite: 'Read the full proposal', go: 'Open the proposal', href: '../' }

export function stopIndex(pathname: string): number {
  return STOPS.findIndex((stop) => stop.to === pathname || stop.match?.test(pathname))
}

export type NextStop =
  | { kind: 'stop'; position: number; total: number; invite: string; go: string; to: string }
  | { kind: 'finish'; position: number; total: number; invite: string; go: string; href: string }
  | { kind: 'rejoin'; invite: string; go: string; to: string }

/** What comes after this page. Pages off the path (Settings, Privacy) point back to the start. */
export function nextStop(pathname: string): NextStop {
  const index = stopIndex(pathname)
  const total = STOPS.length
  if (index < 0) return { kind: 'rejoin', invite: 'Pick the walkthrough back up', go: STOPS[0].go, to: STOPS[0].to }
  const next = STOPS[index + 1]
  if (!next) return { kind: 'finish', position: index + 1, total, ...FINISH }
  return { kind: 'stop', position: index + 1, total, invite: next.invite, go: next.go, to: next.to }
}

/* ---------- Tour progress, remembered on this device ---------- */

const SEEN_KEY = 'sound-reactions-tour-seen'
const STEP_KEY = 'sound-reactions-tour-step'
const HIDE_KEY = 'sound-reactions-tour-pill-hidden'

const read = (key: string) => { try { return window.localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string | null) => {
  try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value) } catch { /* storage may be unavailable */ }
}

export const tourProgress = {
  seen: () => read(SEEN_KEY) === '1',
  markSeen: () => write(SEEN_KEY, '1'),
  /** The step to resume at, or 0. */
  step: (count: number) => { const n = Number(read(STEP_KEY)); return Number.isInteger(n) && n > 0 && n < count ? n : 0 },
  saveStep: (step: number) => write(STEP_KEY, step > 0 ? String(step) : null),
  pillHidden: () => read(HIDE_KEY) === '1',
  hidePill: () => write(HIDE_KEY, '1'),
}
