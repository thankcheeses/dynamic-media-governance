/**
 * Who a profile page is about and what it shows, decided once. The page takes
 * the handle in the URL, the visitor's "Make it yours" identity and the imported
 * archive, and gets back display fields, metadata rows, the actions on offer and
 * the empty-state copy per tab. The JSX renders; it does not branch on who the
 * profile is.
 */
import { OWNER_HANDLE, accountFor, type Account } from './accounts'
import type { ImportedAccount } from './archive'
import type { HeaderDecision } from './headers'
import { ownerLook, type Identity } from './identity'
import type { Post } from './types'

export interface ProfileAccount {
  handle: string
  name: string
  initials: string
  verified: boolean
  bio: string
  photo?: string
  headerId: string | null
  headerDecision?: HeaderDecision
  headerStill?: string
  fictional: boolean
}

export type ProfileActions = 'imported' | 'owner' | 'other'

export interface MetaRow { icon: 'link' | 'pin' | 'calendar' | 'archive'; text: string; href?: string }

export interface ProfileModel {
  account: ProfileAccount
  /** The handle shown on the page: the visitor's own when they relabelled the owner account. */
  shownHandle: string
  isOwner: boolean
  isImported: boolean
  /** The viewer's own profile: the owner demo or their imported archive. Both use the viewer's header pick. */
  mine: boolean
  customIdentity: boolean
  actions: ProfileActions
  postCount: string
  meta: MetaRow[]
  /** null hides the count: X's archive does not always include it. */
  following: number | null
  followers: number | null
  followsNote: string | null
  own: Post[]
  topLevel: Post[]
  replies: Post[]
  withMedia: Post[]
  highlighted: Post[]
  empty: { replies: string; highlights: string; media: string; likes: { title: string; body: string } | null }
}

export interface ProfileInput {
  handle?: string
  /** The /me route: the viewer's imported archive. */
  imported: boolean
  identity: Identity | null
  importAccount: ImportedAccount | null
  importStats: { posts: number } | null
  posts: Post[]
  highlights: string[]
}

export type ProfileResolution = { kind: 'profile'; model: ProfileModel } | { kind: 'import-landing' } | { kind: 'missing' }

/** True when this handle is the viewer's imported account. */
export function isImportedHandle(handle: string | undefined, account: ImportedAccount | null): boolean {
  return !!account && !!handle && handle.toLowerCase() === account.handle.toLowerCase()
}

/**
 * How a post's author is shown. The owner's posts take the visitor's "Make it
 * yours" name and photo; the handle inside the post stays the owner's so
 * profile links and searches keep working. A relabelled account is never shown
 * as verified: the badge belongs to the fictional demo owner, not the visitor.
 */
export function displayAuthor(post: Pick<Post, 'author' | 'handle' | 'initials' | 'verified' | 'photo'>, identity: Identity | null) {
  const me = post.handle === OWNER_HANDLE && identity ? ownerLook(identity) : null
  return { author: me?.name ?? post.author, handle: me?.handle ?? post.handle, initials: me?.initials ?? post.initials, verified: me ? false : Boolean(post.verified), photo: me?.photo ?? post.photo }
}

const compact = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : n.toLocaleString())
export const compactCount = compact

function importedAccount(imp: ImportedAccount): ProfileAccount {
  return { handle: imp.handle, name: imp.name, initials: imp.initials, verified: Boolean(imp.verified), bio: imp.bio, photo: imp.photo, headerId: null, headerStill: imp.headerStill, fictional: false }
}

function ownerAccount(found: Account, identity: Identity | null): { account: ProfileAccount; shownHandle: string; custom: boolean } {
  const me = ownerLook(identity)
  return {
    account: { handle: found.handle, name: me.name, initials: me.initials, verified: !me.custom, bio: me.bio, photo: me.photo, headerId: found.headerId, headerDecision: found.headerDecision, fictional: false },
    shownHandle: me.handle,
    custom: me.custom,
  }
}

export function profileFor(input: ProfileInput): ProfileResolution {
  const { handle, imported, identity, importAccount, importStats, posts, highlights } = input
  const isImported = imported || isImportedHandle(handle, importAccount)
  if (isImported && !importAccount) return imported ? { kind: 'import-landing' } : { kind: 'missing' }
  const found = isImported ? null : accountFor(handle ?? OWNER_HANDLE)
  if (!isImported && !found) return { kind: 'missing' }

  const isOwner = !isImported && found!.handle === OWNER_HANDLE
  const owner = isOwner ? ownerAccount(found!, identity) : null
  const account: ProfileAccount = isImported
    ? importedAccount(importAccount!)
    : owner?.account ?? { handle: found!.handle, name: found!.name, initials: found!.initials, verified: Boolean(found!.verified), bio: found!.bio, headerId: found!.headerId, headerDecision: found!.headerDecision, fictional: found!.fictional }
  const mine = isOwner || isImported
  const own = posts.filter((post) => post.handle === account.handle)
  const custom = owner?.custom ?? false

  const meta: MetaRow[] = []
  if (isOwner) meta.push({ icon: 'link', text: 'thankcheeses.github.io/dynamic-media-governance', href: 'https://thankcheeses.github.io/dynamic-media-governance/' })
  if (isImported) {
    const imp = importAccount!
    if (imp.location) meta.push({ icon: 'pin', text: imp.location })
    if (imp.website) meta.push({ icon: 'link', text: imp.website.replace(/^https?:\/\//, ''), href: imp.website })
    if (imp.joined) meta.push({ icon: 'calendar', text: `Joined ${imp.joined}` })
    meta.push({ icon: 'archive', text: 'From your X archive · on this device only' })
  } else {
    meta.push({ icon: 'calendar', text: account.fictional ? 'Fictional account' : custom ? 'Your profile, on this device only' : 'Prototype profile · October 2026' })
  }

  const following = isImported ? importAccount!.following ?? null : found!.following
  const followers = isImported ? importAccount!.followers ?? null : found!.followers

  return {
    kind: 'profile',
    model: {
      account,
      shownHandle: owner?.shownHandle ?? account.handle,
      isOwner, isImported, mine, customIdentity: custom,
      actions: isImported ? 'imported' : isOwner ? 'owner' : 'other',
      postCount: isImported && importStats ? `${importStats.posts.toLocaleString()} posts` : `${own.length} ${own.length === 1 ? 'post' : 'posts'}`,
      meta,
      following, followers,
      followsNote: isOwner ? '(the prototype’s fictional accounts)' : null,
      own,
      topLevel: own.filter((post) => !post.replyTo),
      replies: own.filter((post) => post.replyTo),
      withMedia: own.filter((post) => post.media?.some((item) => item.kind === 'image')),
      highlighted: own.filter((post) => highlights.includes(post.id)),
      empty: {
        replies: isImported ? 'Your archive had no replies among the posts shown.' : 'This demo account has no replies.',
        highlights: `${isImported ? 'X does not include Highlights in the archive. ' : ''}${mine ? 'Open ··· on one of your posts and choose Add to Highlights. Pins stay on this device.' : 'This demo account has no highlights.'}`,
        media: isImported ? 'No images were found in what you imported. Pick the whole zip to include them.' : 'This demo account has no photos or videos.',
        likes: isImported ? null : { title: 'Likes are private here', body: mine ? 'The demo keeps likes on the posts themselves; use your X archive to see your own.' : 'This demo account’s likes are not shown.' },
      },
    },
  }
}
