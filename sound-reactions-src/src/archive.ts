/**
 * Reads a person's own X data archive in the browser so they can preview the
 * prototype with their real profile and posts. Nothing here touches the
 * network: the zip (or its data/*.js files) is parsed locally, images come
 * from the archive's own media folders, and X's CDN is never contacted. The
 * result lives in memory for the life of the tab (see src/importStore.ts).
 *
 * Archive layout (as X exports it): data/account.js, data/profile.js,
 * data/tweets.js (older archives: tweet.js; large ones split into
 * tweets-part1.js…), data/like.js, data/verified.js, data/follower.js,
 * data/following.js, data/profile_media/<accountId>-<file> and
 * data/tweets_media/<tweetId>-<file>. Each .js file is
 * `window.YTD.<name>.part0 = [ … ]`.
 */
import { Unzip, UnzipInflate } from 'fflate'
import type { Post, PostMedia } from './types'

export const ARCHIVE_LIMITS = {
  /** Newest posts kept; older ones are counted but not shown. */
  posts: 2000,
  /** Per-image cap and total image budget, so a large archive cannot exhaust memory. */
  imageBytes: 10 * 1024 * 1024,
  totalImageBytes: 150 * 1024 * 1024,
  /** Individual data file cap (tweets.js can be large but not this large). */
  dataFileBytes: 200 * 1024 * 1024,
}

export interface ImportedAccount {
  handle: string
  name: string
  initials: string
  bio: string
  location: string
  website: string
  joined: string
  verified: boolean
  followers: number | null
  following: number | null
  /** Object URL of the avatar from data/profile_media, when the archive had it. */
  photo?: string
  /** Object URL of the header image from data/profile_media, when present. */
  headerStill?: string
}

export interface ImportedLike {
  id: string
  text: string
  url?: string
}

export interface ArchiveImport {
  account: ImportedAccount
  posts: Post[]
  likes: ImportedLike[]
  /** Counts of things seen in the archive, including anything not shown. */
  stats: { posts: number; shown: number; replies: number; reposts: number; withMedia: number; likes: number; imagesLoaded: number; videosSkipped: number; imagesSkipped: number }
  /** Plain-language notes about what was and was not imported. */
  notes: string[]
  /** Object URLs to revoke when the import is cleared. */
  objectUrls: string[]
}

type Json = Record<string, unknown>

/** Strips the `window.YTD.x.part0 = ` prefix and parses the JSON array that follows. */
export function parseYtd(text: string): unknown[] {
  const eq = text.indexOf('=')
  const start = text.indexOf('[', eq < 0 ? 0 : eq)
  if (start < 0) throw new Error('Not an X archive data file')
  const parsed: unknown = JSON.parse(text.slice(start).replace(/;?\s*$/, ''))
  if (!Array.isArray(parsed)) throw new Error('Not an X archive data file')
  return parsed
}

/** The payload object inside each archive row ({ "tweet": {…} } → {…}), whatever the wrapper key is. */
function unwrap(row: unknown, ...keys: string[]): Json | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Json
  for (const key of keys) if (r[key] && typeof r[key] === 'object') return r[key] as Json
  return null
}

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback)
const num = (v: unknown) => { const n = typeof v === 'number' ? v : parseInt(str(v, '0'), 10); return Number.isFinite(n) ? n : 0 }

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
export const decodeEntities = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Parses X's "Wed Oct 10 20:19:24 +0000 2018" (and ISO strings) without relying on Date.parse quirks. */
export function parseXDate(s: string): Date | null {
  const m = /^\w{3} (\w{3}) (\d{1,2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4}) (\d{4})$/.exec(s.trim())
  if (m) {
    const month = MONTHS.indexOf(m[1])
    if (month < 0) return null
    const offsetMin = (parseInt(m[6].slice(1, 3), 10) * 60 + parseInt(m[6].slice(3), 10)) * (m[6][0] === '-' ? -1 : 1)
    return new Date(Date.UTC(parseInt(m[7], 10), month, parseInt(m[2], 10), parseInt(m[3], 10), parseInt(m[4], 10) - offsetMin, parseInt(m[5], 10)))
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** X-style short timestamp: "4h" today, "Oct 10" this year, "Oct 10, 2018" otherwise. */
export function shortDate(d: Date, now = new Date()): string {
  const diff = now.getTime() - d.getTime()
  if (diff >= 0 && diff < 3600_000) return `${Math.max(1, Math.round(diff / 60_000))}m`
  if (diff >= 0 && diff < 86_400_000) return `${Math.round(diff / 3600_000)}h`
  const md = `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return d.getFullYear() === now.getFullYear() ? md : `${md}, ${d.getFullYear()}`
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)).toUpperCase()
}

/** Replaces t.co links with their display text and drops the trailing media link. */
function readableText(tweet: Json): string {
  let text = decodeEntities(str(tweet.full_text ?? tweet.text))
  const entities = (tweet.entities ?? {}) as Json
  for (const u of (Array.isArray(entities.urls) ? entities.urls : []) as Json[]) {
    const short = str(u.url), display = str(u.display_url) || str(u.expanded_url)
    if (short && display) text = text.split(short).join(display)
  }
  for (const m of (Array.isArray(entities.media) ? entities.media : []) as Json[]) {
    const short = str(m.url)
    if (short) text = text.split(short).join('').trimEnd()
  }
  return text.trim()
}

export interface ArchiveEntry { name: string; data: Uint8Array }

interface Raw {
  account: Json | null
  profile: Json | null
  verified: boolean
  tweets: Json[]
  likes: Json[]
  followers: number | null
  following: number | null
  media: Map<string, Uint8Array>
}

const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1)
const isData = (name: string, stem: string) => new RegExp(`(^|/)${stem}(-part\\d+)?\\.js$`).test(name)
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i

/** Which archive entries we want at all; everything else is skipped unread. */
export function wantsEntry(name: string): 'data' | 'image' | 'video' | null {
  if (/(^|\/)(account|profile|tweets?|like|verified|follower|following)(-part\d+)?\.js$/.test(name)) return 'data'
  if (/(^|\/)(profile_media|tweets_media)\//.test(name)) return IMAGE_EXT.test(name) ? 'image' : VIDEO_EXT.test(name) ? 'video' : null
  return null
}

const decoder = new TextDecoder()

/** Turns loose archive entries (from a zip or picked files) into a preview. DOM-free except for object URLs. */
export function buildImport(entries: ArchiveEntry[], makeUrl: (data: Uint8Array, name: string) => string = () => ''): ArchiveImport {
  const raw: Raw = { account: null, profile: null, verified: false, tweets: [], likes: [], followers: null, following: null, media: new Map() }
  const notes: string[] = []
  const stats = { posts: 0, shown: 0, replies: 0, reposts: 0, withMedia: 0, likes: 0, imagesLoaded: 0, videosSkipped: 0, imagesSkipped: 0 }
  let imageBudget = ARCHIVE_LIMITS.totalImageBytes

  for (const entry of entries) {
    const kind = wantsEntry(entry.name)
    if (kind === 'video') { stats.videosSkipped++; continue }
    if (kind === 'image') {
      if (entry.data.byteLength > ARCHIVE_LIMITS.imageBytes || entry.data.byteLength > imageBudget) { stats.imagesSkipped++; continue }
      imageBudget -= entry.data.byteLength
      raw.media.set(basename(entry.name), entry.data)
      continue
    }
    if (kind !== 'data') continue
    if (entry.data.byteLength > ARCHIVE_LIMITS.dataFileBytes) { notes.push(`${basename(entry.name)} is larger than ${ARCHIVE_LIMITS.dataFileBytes / 1048576} MB and was skipped.`); continue }
    let rows: unknown[]
    try { rows = parseYtd(decoder.decode(entry.data)) } catch { notes.push(`${basename(entry.name)} could not be read and was skipped.`); continue }
    if (isData(entry.name, 'account')) raw.account = unwrap(rows[0], 'account')
    else if (isData(entry.name, 'profile')) raw.profile = unwrap(rows[0], 'profile')
    else if (isData(entry.name, 'verified')) raw.verified = unwrap(rows[0], 'verified')?.verified === true
    else if (isData(entry.name, 'follower')) raw.followers = (raw.followers ?? 0) + rows.length
    else if (isData(entry.name, 'following')) raw.following = (raw.following ?? 0) + rows.length
    else if (isData(entry.name, 'like')) raw.likes.push(...rows.map((r) => unwrap(r, 'like')).filter((x): x is Json => !!x))
    else if (isData(entry.name, 'tweets') || isData(entry.name, 'tweet')) raw.tweets.push(...rows.map((r) => unwrap(r, 'tweet', 'tweets')).filter((x): x is Json => !!x))
  }

  if (!raw.account) throw new Error('No account.js found. Pick the whole archive zip, or the files inside its data folder.')
  const username = str(raw.account.username)
  if (!username) throw new Error('account.js has no username; this does not look like an X archive.')
  const name = str(raw.account.accountDisplayName) || username
  const accountId = str(raw.account.accountId)
  const objectUrls: string[] = []
  const urlFor = (data: Uint8Array | undefined, label: string) => {
    if (!data) return undefined
    const url = makeUrl(data, label)
    if (url) objectUrls.push(url)
    return url || undefined
  }
  const profileImage = (mediaUrl: unknown) => {
    const file = basename(str(mediaUrl))
    return file ? raw.media.get(`${accountId}-${file}`) ?? raw.media.get(file) : undefined
  }
  const description = (raw.profile?.description ?? {}) as Json
  const joinedAt = parseXDate(str(raw.account.createdAt))
  const account: ImportedAccount = {
    handle: `@${username}`,
    name,
    initials: initialsOf(name),
    bio: decodeEntities(str(description.bio)),
    location: str(description.location),
    website: str(description.website),
    joined: joinedAt ? `${MONTHS[joinedAt.getMonth()]} ${joinedAt.getFullYear()}` : '',
    verified: raw.verified,
    followers: raw.followers,
    following: raw.following,
    photo: urlFor(profileImage(raw.profile?.avatarMediaUrl), 'avatar'),
    headerStill: urlFor(profileImage(raw.profile?.headerMediaUrl), 'header'),
  }

  const dated = raw.tweets
    .map((t) => ({ t, at: parseXDate(str(t.created_at)) ?? new Date(0) }))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
  stats.posts = dated.length
  const shown = dated.slice(0, ARCHIVE_LIMITS.posts)
  stats.shown = shown.length
  if (dated.length > shown.length) notes.push(`Showing your newest ${shown.length.toLocaleString()} of ${dated.length.toLocaleString()} posts.`)

  const posts: Post[] = shown.map(({ t, at }) => {
    const id = str(t.id_str ?? t.id)
    const replyTo = str(t.in_reply_to_screen_name)
    const text = readableText(t)
    const rt = /^RT @(\w+): /.exec(text)
    const ext = (t.extended_entities ?? t.entities ?? {}) as Json
    const media: PostMedia[] = []
    for (const m of (Array.isArray(ext.media) ? ext.media : []) as Json[]) {
      const type = str(m.type)
      const file = basename(str(m.media_url_https ?? m.media_url))
      if (type === 'photo' || type === 'animated_gif' && raw.media.has(`${id}-${file}`)) {
        const url = urlFor(raw.media.get(`${id}-${file}`), file)
        media.push(url ? { kind: 'image', url, alt: decodeEntities(str(m.ext_alt_text)) || undefined } : { kind: 'missing', note: 'Image not included in what you imported' })
      } else if (type === 'video' || type === 'animated_gif') {
        media.push({ kind: 'missing', note: 'Video not imported (videos are skipped to save memory)' })
      }
    }
    if (replyTo) stats.replies++
    if (rt) stats.reposts++
    if (media.length) stats.withMedia++
    return {
      id: `x-${id}`,
      author: name,
      handle: account.handle,
      initials: account.initials,
      photo: account.photo,
      verified: account.verified,
      timestamp: shortDate(at),
      body: rt ? text.slice(rt[0].length) : text,
      replyTo: replyTo ? `@${replyTo}` : undefined,
      repostOf: rt ? `@${rt[1]}` : undefined,
      media: media.length ? media : undefined,
      replyCount: 0,
      repostCount: num(t.retweet_count),
      likeCount: num(t.favorite_count),
      viewCount: 0,
      following: true,
      ephemeral: true,
    }
  })
  stats.imagesLoaded = objectUrls.length - (account.photo ? 1 : 0) - (account.headerStill ? 1 : 0)

  const likes: ImportedLike[] = raw.likes.map((l) => ({ id: str(l.tweetId), text: decodeEntities(str(l.fullText)), url: str(l.expandedUrl) || undefined })).filter((l) => l.id)
  stats.likes = likes.length

  if (raw.tweets.length === 0) notes.push('No tweets.js was found, so the Posts, Replies and Media tabs are empty.')
  if (raw.likes.length === 0) notes.push('No like.js was found, so the Likes tab is empty.')
  if (stats.videosSkipped) notes.push(`${stats.videosSkipped} video file${stats.videosSkipped === 1 ? '' : 's'} skipped.`)
  if (stats.imagesSkipped) notes.push(`${stats.imagesSkipped} image${stats.imagesSkipped === 1 ? '' : 's'} skipped for size.`)
  if (!account.photo) notes.push('No profile photo was in the import, so your initials are shown.')

  return { account, posts, likes, stats, notes, objectUrls }
}

/** Streams a zip, keeping only the entries the preview needs; everything else is skipped unread. */
export async function entriesFromZip(file: File, onProgress?: (bytes: number) => void): Promise<ArchiveEntry[]> {
  const entries: ArchiveEntry[] = []
  const pending: Promise<void>[] = []
  const unzipper = new Unzip()
  unzipper.register(UnzipInflate)
  unzipper.onfile = (entry) => {
    const kind = wantsEntry(entry.name)
    if (!kind || kind === 'video') { if (kind === 'video') entries.push({ name: entry.name, data: new Uint8Array(0) }); return }
    const chunks: Uint8Array[] = []
    let size = 0
    pending.push(new Promise<void>((resolve, reject) => {
      entry.ondata = (err, chunk, final) => {
        if (err) { reject(err); return }
        chunks.push(chunk); size += chunk.byteLength
        if (final) {
          const data = new Uint8Array(size)
          let offset = 0
          for (const c of chunks) { data.set(c, offset); offset += c.byteLength }
          entries.push({ name: entry.name, data })
          resolve()
        }
      }
    }))
    entry.start()
  }
  const reader = file.stream().getReader()
  let read = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    read += value.byteLength
    unzipper.push(value, false)
    onProgress?.(read)
    // Let the UI breathe between chunks.
    await new Promise((r) => setTimeout(r, 0))
  }
  unzipper.push(new Uint8Array(0), true)
  await Promise.all(pending)
  return entries
}

/** Reads whatever the person picked: one archive zip, or loose data files and media. */
export async function entriesFromFiles(files: File[], onProgress?: (bytes: number) => void): Promise<ArchiveEntry[]> {
  const out: ArchiveEntry[] = []
  for (const file of files) {
    if (/\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
      out.push(...await entriesFromZip(file, onProgress))
    } else if (wantsEntry(file.name) || wantsEntry(`data/${file.name}`) || wantsEntry(`data/tweets_media/${file.name}`)) {
      out.push({ name: wantsEntry(file.name) ? file.name : IMAGE_EXT.test(file.name) ? `data/tweets_media/${file.name}` : `data/${file.name}`, data: new Uint8Array(await file.arrayBuffer()) })
    }
  }
  return out
}

/** Full pipeline for the browser: files in, preview out, with object URLs for images. */
export async function importArchive(files: File[], onProgress?: (bytes: number) => void): Promise<ArchiveImport> {
  const entries = await entriesFromFiles(files, onProgress)
  if (entries.length === 0) throw new Error('Nothing usable was found. Pick the archive zip X sent you, or the files in its data folder.')
  const mime = (name: string) => /\.png$/i.test(name) ? 'image/png' : /\.gif$/i.test(name) ? 'image/gif' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg'
  return buildImport(entries, (data, name) => URL.createObjectURL(new Blob([data as BlobPart], { type: mime(name) })))
}
