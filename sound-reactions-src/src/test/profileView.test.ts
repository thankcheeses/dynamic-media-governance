import { describe, expect, it } from 'vitest'
import type { ImportedAccount } from '../archive'
import { SEED_POSTS } from '../data'
import { displayAuthor, profileFor } from '../profileView'

const identity = { name: 'Sam Visitor', handle: '@samv', bio: 'mine', photo: 'data:,me' }
const imported: ImportedAccount = { handle: '@realme', name: 'Real Me', initials: 'RM', verified: false, bio: 'from the archive', following: null, followers: 120, photo: undefined, headerStill: 'blob:h', location: 'Houston', website: 'https://example.com', joined: 'May 2012' }
const base = { imported: false, identity: null, importAccount: null, importStats: null, posts: SEED_POSTS, highlights: [] as string[] }

describe('profile view-model', () => {
  it('the owner demo is verified and shows the prototype link', () => {
    const r = profileFor({ ...base, handle: '@baynardmalone' })
    expect(r.kind).toBe('profile')
    if (r.kind !== 'profile') return
    expect(r.model).toMatchObject({ isOwner: true, mine: true, actions: 'owner', account: { verified: true }, shownHandle: '@baynardmalone', followsNote: '(the prototype’s fictional accounts)' })
    expect(r.model.meta.map((m) => m.icon)).toEqual(['link', 'calendar'])
    expect(r.model.meta[1].text).toBe('Prototype profile · October 2026')
  })

  it('a custom identity relabels the owner and is never verified', () => {
    const r = profileFor({ ...base, handle: '@baynardmalone', identity })
    if (r.kind !== 'profile') throw new Error('expected a profile')
    expect(r.model.account).toMatchObject({ name: 'Sam Visitor', verified: false, photo: 'data:,me', handle: '@baynardmalone' })
    expect(r.model.shownHandle).toBe('@samv')
    expect(r.model.customIdentity).toBe(true)
    expect(r.model.meta[1].text).toBe('Your profile, on this device only')
    expect(displayAuthor(SEED_POSTS[0], identity)).toEqual({ author: 'Sam Visitor', handle: '@samv', initials: 'SV', verified: false, photo: 'data:,me' })
    expect(displayAuthor(SEED_POSTS[0], null).verified).toBe(true)
  })

  it('an imported account hides an unknown Following count and shows archive metadata', () => {
    const r = profileFor({ ...base, handle: '@realme', importAccount: imported, importStats: { posts: 3210 } })
    if (r.kind !== 'profile') throw new Error('expected a profile')
    expect(r.model).toMatchObject({ isImported: true, mine: true, actions: 'imported', following: null, followers: 120, postCount: '3,210 posts' })
    expect(r.model.meta.map((m) => m.text)).toEqual(['Houston', 'example.com', 'Joined May 2012', 'From your X archive · on this device only'])
    expect(r.model.empty.highlights).toMatch(/^X does not include Highlights in the archive\. Open ···/)
    expect(r.model.empty.likes).toBeNull()
    expect(r.model.account.headerStill).toBe('blob:h')
  })

  it('/me with nothing imported shows the landing; an unknown handle is missing', () => {
    expect(profileFor({ ...base, imported: true })).toEqual({ kind: 'import-landing' })
    expect(profileFor({ ...base, handle: '@nobody' })).toEqual({ kind: 'missing' })
  })

  it('a fictional account gets Follow, fictional metadata and the demo empty copy', () => {
    const r = profileFor({ ...base, handle: 'mayamakes' })
    if (r.kind !== 'profile') throw new Error('expected a profile')
    expect(r.model).toMatchObject({ actions: 'other', mine: false, account: { fictional: true, headerId: 'neon-cats' } })
    expect(r.model.meta[0].text).toBe('Fictional account')
    expect(r.model.empty.highlights).toBe('This demo account has no highlights.')
    expect(r.model.empty.likes?.body).toBe('This demo account’s likes are not shown.')
  })

  it('splits posts into tabs and honours pins', () => {
    const ownerPosts = SEED_POSTS.filter((p) => p.handle === '@baynardmalone')
    const r = profileFor({ ...base, handle: '@baynardmalone', highlights: [ownerPosts[0].id] })
    if (r.kind !== 'profile') throw new Error('expected a profile')
    expect(r.model.own).toEqual(ownerPosts)
    expect(r.model.highlighted).toEqual([ownerPosts[0]])
    expect(r.model.topLevel.every((p) => !p.replyTo)).toBe(true)
  })
})
