/**
 * Profiles for the accounts in the feed. Everyone except @baynardmalone is
 * fictional. Header assignments show the range a real platform would see:
 * the owner's own GIF picks playing from GIPHY and Tenor, rendered GIF headers,
 * a calm canvas header, one published provisionally behind a warning label, and
 * some accounts with no dynamic header at all.
 */
import type { HeaderDecision } from './headers'

export interface Account {
  handle: string
  name: string
  initials: string
  verified?: boolean
  bio: string
  /** Header preset id, or null for a plain header. */
  headerId: string | null
  headerDecision?: HeaderDecision
  following: number
  followers: number
  fictional: boolean
}

export const OWNER_HANDLE = '@baynardmalone'

export const ACCOUNTS: Account[] = [
  { handle: OWNER_HANDLE, name: 'B. Baynard-Malone', initials: 'BB', verified: true, bio: 'Trust & safety and product policy. Writing the Dynamic Media Governance framework: animated headers and sound reactions that are safe by default.', headerId: null, following: 9, followers: 9, fictional: false },
  { handle: '@mayamakes', name: 'Maya Chen', initials: 'MC', verified: true, bio: 'Product designer. Thinks out loud in voice posts. Pauses are part of the idea.', headerId: 'sea-glass', following: 412, followers: 8930, fictional: true },
  { handle: '@theotypes', name: 'Theo Martins', initials: 'TM', bio: 'Front-end and accessibility. Keyboard first, mouse optional.', headerId: 'spongebob-computer', following: 233, followers: 1204, fictional: true },
  { handle: '@ariexplains', name: 'Ari Okafor', initials: 'AO', bio: 'Explains online safety without the jargon. Disagree with me kindly.', headerId: 'violet-hour', following: 640, followers: 5310, fictional: true },
  { handle: '@deesaysso', name: 'Dee Carter', initials: 'DC', verified: true, bio: 'Group chat historian. Always on time, never believed.', headerId: 'paid-in-full', following: 980, followers: 40210, fictional: true },
  { handle: '@andrewells', name: 'Andre Wells', initials: 'AW', verified: true, bio: 'Comedy, wine and bad decisions, in that order.', headerId: 'confetti', headerDecision: 'PROVISIONAL', following: 311, followers: 2675, fictional: true },
  { handle: '@kiaravibes', name: 'Kiara Vibes', initials: 'KV', verified: true, bio: 'Wine notes, playlists and good energy only.', headerId: 'slow-waves', following: 702, followers: 15800, fictional: true },
  { handle: '@jreyescooks', name: 'Jordan Reyes', initials: 'JR', bio: 'Home cook. Grandma’s recipe cards, one at a time.', headerId: 'citrus', following: 189, followers: 3420, fictional: true },
  { handle: '@samoko', name: 'Sam Okoye', initials: 'SO', bio: 'Captions are the feature. Accessibility lead by day.', headerId: null, following: 521, followers: 12400, fictional: true },
  { handle: '@coachnia', name: 'Coach Nia', initials: 'CN', bio: 'Coaching the Lions. Nervous every game day, every season.', headerId: 'violet-hour', following: 150, followers: 980, fictional: true },
]

export function accountFor(handle: string): Account | undefined {
  const h = handle.startsWith('@') ? handle : `@${handle}`
  return ACCOUNTS.find((account) => account.handle.toLowerCase() === h.toLowerCase())
}

/** Route for a profile: your own at /profile, everyone else at /u/<handle>. */
export function profilePath(handle: string): string {
  return handle === OWNER_HANDLE ? '/profile' : `/u/${handle.replace(/^@/, '')}`
}
