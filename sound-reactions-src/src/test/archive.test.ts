import { describe, expect, it } from 'vitest'
import { ARCHIVE_LIMITS, buildImport, parseXDate, parseYtd, shortDate, wantsEntry, type ArchiveEntry } from '../archive'

const enc = new TextEncoder()
const ytd = (name: string, rows: unknown[]) => `window.YTD.${name}.part0 = ${JSON.stringify(rows)}`
const entry = (name: string, body: string | Uint8Array): ArchiveEntry => ({ name, data: typeof body === 'string' ? enc.encode(body) : body })

const tweet = (id: string, text: string, extra: Record<string, unknown> = {}) => ({
  tweet: { id_str: id, full_text: text, created_at: 'Wed Oct 10 20:19:24 +0000 2018', favorite_count: '12', retweet_count: '3', entities: { urls: [], user_mentions: [] }, ...extra },
})

function sampleArchive(): ArchiveEntry[] {
  return [
    entry('data/account.js', ytd('account', [{ account: { email: 'secret@example.com', username: 'samtests', accountId: '42', createdAt: 'Mon Mar 02 10:00:00 +0000 2015', accountDisplayName: 'Sam Tester' } }])),
    entry('data/profile.js', ytd('profile', [{ profile: { description: { bio: 'Testing &amp; tinkering', website: 'https://example.org', location: 'Houston' }, avatarMediaUrl: 'https://pbs.twimg.com/profile_images/1/me.jpg', headerMediaUrl: 'https://pbs.twimg.com/profile_banners/42/1' } }])),
    entry('data/verified.js', ytd('verified', [{ verified: { accountId: '42', verified: false } }])),
    entry('data/follower.js', ytd('follower', [{ follower: { accountId: '1' } }, { follower: { accountId: '2' } }])),
    entry('data/following.js', ytd('following', [{ following: { accountId: '3' } }])),
    entry('data/tweets.js', ytd('tweets', [
      tweet('100', 'Hello world &lt;3 https://t.co/abc', { entities: { urls: [{ url: 'https://t.co/abc', display_url: 'example.org/post', expanded_url: 'https://example.org/post' }] } }),
      tweet('101', '@friend yes exactly', { in_reply_to_screen_name: 'friend', in_reply_to_status_id_str: '99', created_at: 'Thu Oct 11 09:00:00 +0000 2018' }),
      tweet('102', 'RT @someone: a thing worth sharing', { created_at: 'Fri Oct 12 09:00:00 +0000 2018' }),
      tweet('103', 'look at this https://t.co/pic', { created_at: 'Sat Oct 13 09:00:00 +0000 2018', entities: { urls: [], media: [{ url: 'https://t.co/pic' }] }, extended_entities: { media: [{ type: 'photo', media_url_https: 'https://pbs.twimg.com/media/cat.jpg', ext_alt_text: 'A cat' }, { type: 'video', media_url_https: 'https://pbs.twimg.com/media/clip.jpg' }] } }),
    ])),
    entry('data/like.js', ytd('like', [{ like: { tweetId: '7', fullText: 'A liked post', expandedUrl: 'https://x.com/i/web/status/7' } }])),
    entry('data/profile_media/42-me.jpg', new Uint8Array([1, 2, 3])),
    entry('data/tweets_media/103-cat.jpg', new Uint8Array([4, 5, 6])),
    entry('data/tweets_media/103-clip.mp4', new Uint8Array(0)),
    entry('data/direct-messages.js', ytd('direct_messages', [{ dmConversation: { messages: [{ text: 'never read' }] } }])),
  ]
}

describe('X archive parsing', () => {
  it('reads the window.YTD prefix and only wants the files the preview needs', () => {
    expect(parseYtd('window.YTD.account.part0 = [ {"a":1} ]')).toEqual([{ a: 1 }])
    expect(() => parseYtd('not an archive')).toThrow()
    expect(wantsEntry('data/tweets.js')).toBe('data')
    expect(wantsEntry('data/tweets-part1.js')).toBe('data')
    expect(wantsEntry('data/tweets_media/1-a.png')).toBe('image')
    expect(wantsEntry('data/tweets_media/1-a.mp4')).toBe('video')
    expect(wantsEntry('data/direct-messages.js')).toBeNull()
    expect(wantsEntry('data/ad-impressions.js')).toBeNull()
  })

  it('parses X dates and formats them the way X shows them', () => {
    const d = parseXDate('Wed Oct 10 20:19:24 +0000 2018')!
    expect(d.toISOString()).toBe('2018-10-10T20:19:24.000Z')
    expect(shortDate(d, new Date('2026-11-01T00:00:00Z'))).toBe('Oct 10, 2018')
    expect(shortDate(new Date('2026-11-01T10:00:00Z'), new Date('2026-11-01T12:30:00Z'))).toBe('3h')
    expect(shortDate(new Date('2026-06-01T10:00:00Z'), new Date('2026-11-01T12:30:00Z'))).toBe('Jun 1')
  })

  it('builds the profile, posts, replies, reposts, media and likes, and never carries the email', () => {
    const urls: string[] = []
    const result = buildImport(sampleArchive(), (_data, name) => { const u = `blob:${name}-${urls.length}`; urls.push(u); return u })
    expect(result.account).toMatchObject({ handle: '@samtests', name: 'Sam Tester', initials: 'ST', bio: 'Testing & tinkering', location: 'Houston', website: 'https://example.org', joined: 'Mar 2015', verified: false, followers: 2, following: 1 })
    expect(result.account.photo).toMatch(/^blob:avatar/)
    expect(JSON.stringify(result)).not.toContain('secret@example.com')
    expect(JSON.stringify(result)).not.toContain('never read')

    expect(result.posts.map((p) => p.id)).toEqual(['x-103', 'x-102', 'x-101', 'x-100']) // newest first
    const [withMedia, repost, reply, plain] = result.posts
    expect(plain.body).toBe('Hello world <3 example.org/post')
    expect(plain).toMatchObject({ likeCount: 12, repostCount: 3, ephemeral: true, handle: '@samtests', photo: result.account.photo })
    expect(reply.replyTo).toBe('@friend')
    expect(repost).toMatchObject({ repostOf: '@someone', body: 'a thing worth sharing' })
    expect(withMedia.body).toBe('look at this')
    expect(withMedia.media).toEqual([{ kind: 'image', url: expect.stringMatching(/^blob:cat\.jpg/), alt: 'A cat' }, { kind: 'missing', note: expect.stringMatching(/Video not imported/) }])

    expect(result.likes).toEqual([{ id: '7', text: 'A liked post', url: 'https://x.com/i/web/status/7' }])
    expect(result.stats).toMatchObject({ posts: 4, shown: 4, replies: 1, reposts: 1, withMedia: 1, likes: 1, videosSkipped: 1 })
    expect(result.objectUrls).toHaveLength(2)
    // No post or image URL points at X's servers: everything is local.
    expect(JSON.stringify(result.posts)).not.toContain('pbs.twimg.com')
  })

  it('refuses an import with no account file and caps the number of posts shown', () => {
    expect(() => buildImport([entry('data/tweets.js', ytd('tweets', [tweet('1', 'x')]))])).toThrow(/account\.js/)
    const many = Array.from({ length: ARCHIVE_LIMITS.posts + 5 }, (_, i) => tweet(String(i), `post ${i}`))
    const result = buildImport([
      entry('data/account.js', ytd('account', [{ account: { username: 'big', accountId: '1', accountDisplayName: 'Big Archive' } }])),
      entry('data/tweets.js', ytd('tweets', many)),
    ])
    expect(result.posts).toHaveLength(ARCHIVE_LIMITS.posts)
    expect(result.stats.posts).toBe(ARCHIVE_LIMITS.posts + 5)
    expect(result.notes.join(' ')).toMatch(/newest 2,000 of 2,005/)
  })
})
