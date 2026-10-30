import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AudioLines, BadgeCheck, BarChart2, Bookmark, Copy, EyeOff, Heart, MessageCircle, MoreHorizontal, Plus, Repeat2, Share } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { burstRing, popIcon, rollCount } from '../motion'
import { useAppStore } from '../store'
import type { Post, QuotedPost } from '../types'
import { avatarStyle } from '../avatar'
import { SoundReactionChip, VoicePostPlayer } from './AudioClip'
import { ReactionPicker } from './ReactionPicker'

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

/** A count that rolls up or down when it changes, like X's engagement numbers. */
function Count({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)
  useEffect(() => {
    if (value !== previous.current) rollCount(ref.current, value > previous.current ? 1 : -1)
    previous.current = value
  }, [value])
  return <span className="x-count"><span ref={ref}>{value > 0 ? compact.format(value) : ''}</span></span>
}

function Action({ className = '', label, onClick, to, children, pressed }: { className?: string; label: string; onClick?: () => void; to?: string; children: ReactNode; pressed?: boolean }) {
  if (to) return <Link to={to} className={`x-action ${className}`} aria-label={label}>{children}</Link>
  return <button className={`x-action ${className}`} onClick={onClick} aria-label={label} aria-pressed={pressed}>{children}</button>
}

/** Generic verification check (not X's asset); fictional accounts only. */
export function Verified() {
  return <span className="x-verified"><BadgeCheck size={17} fill="var(--accent)" color="var(--bg)" aria-hidden="true" /><span className="sr-only">Verified account</span></span>
}

function QuoteCard({ quote }: { quote: QuotedPost }) {
  return <div className="x-quote">
    <header className="x-post-byline">
      <span className="avatar tiny" aria-hidden="true" style={avatarStyle(quote.initials)}>{quote.initials}</span>
      <strong>{quote.author}</strong>{quote.verified && <Verified />}
      <span className="x-handle">{quote.handle}</span><span aria-hidden="true">·</span><span>{quote.timestamp}</span>
    </header>
    <p className="x-post-text">{quote.body}</p>
  </div>
}

function PostMenu({ post, onMute }: { post: Post; onMute?: (handle: string) => void }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])
  const copy = async () => {
    setOpen(false)
    try { await navigator.clipboard.writeText(post.body); toast('Post text copied') }
    catch { toast('Copying is unavailable here') }
  }
  return <div className="x-menu-wrap x-post-more">
    <button className="x-mini-button" onClick={(event) => { event.stopPropagation(); setOpen(!open) }} aria-label={`More options for ${post.handle} post`} aria-expanded={open}><MoreHorizontal size={18} /></button>
    {open && <div className="x-menu" onClick={(event) => event.stopPropagation()}>
      <button onClick={() => void copy()}><Copy size={17} /> Copy post text</button>
      {onMute && <button onClick={() => { setOpen(false); onMute(post.handle) }}><EyeOff size={17} /> Mute {post.handle}</button>}
    </div>}
  </div>
}

export function PostCard({ post, embedded = false, onMute }: { post: Post; embedded?: boolean; onMute?: (handle: string) => void }) {
  const [picker, setPicker] = useState(false)
  const { liked, reposted, bookmarked, togglePostAction } = useAppStore()
  const isLiked = liked.includes(post.id)
  const isReposted = reposted.includes(post.id)
  const isBookmarked = bookmarked.includes(post.id)
  const heartRef = useRef<HTMLSpanElement>(null)
  const ringRef = useRef<HTMLSpanElement>(null)
  const repostRef = useRef<HTMLSpanElement>(null)
  const bookmarkRef = useRef<HTMLSpanElement>(null)

  const like = () => {
    togglePostAction(post.id, 'like')
    popIcon(heartRef.current)
    if (!isLiked) burstRing(ringRef.current)
  }
  const repost = () => { togglePostAction(post.id, 'repost'); popIcon(repostRef.current) }
  const bookmark = () => {
    togglePostAction(post.id, 'bookmark')
    popIcon(bookmarkRef.current)
    toast(isBookmarked ? 'Removed from Bookmarks' : 'Added to your Bookmarks (saved locally)')
  }
  const share = async () => {
    try { await navigator.clipboard.writeText(`${post.author}: ${post.body}`); toast('Copied to clipboard') }
    catch { toast('Sharing is unavailable here; nothing was sent') }
  }

  return (
    <article className={`x-post ${embedded ? 'embedded' : ''}`} aria-label={`Post by ${post.author}`}>
      <div className="avatar" aria-hidden="true" style={avatarStyle(post.initials)}>{post.initials}</div>
      <div className="x-post-main">
        <header className="x-post-byline">
          <strong>{post.author}</strong>{post.verified && <Verified />}
          <span className="x-handle">{post.handle}</span>
          <span aria-hidden="true">·</span>
          <span className="x-time">{post.timestamp}</span>
          {!embedded && <PostMenu post={post} onMute={onMute} />}
        </header>
        <p className="x-post-text">{post.body}</p>
        {post.quote && <QuoteCard quote={post.quote} />}
        {post.voice && <VoicePostPlayer clip={post.voice} handle={post.handle} initials={post.initials} />}
        {post.reaction && <SoundReactionChip reaction={post.reaction} post={post} />}
        <div className="x-actions">
          <Action to="/compose" className="reply" label={`Reply to ${post.handle}, ${post.replyCount} replies`}>
            <span className="x-action-icon"><MessageCircle size={18} /></span><Count value={post.replyCount} />
          </Action>
          <Action className={`repost ${isReposted ? 'active' : ''}`} onClick={repost} pressed={isReposted} label={`${isReposted ? 'Undo repost' : 'Repost'} ${post.handle}, ${post.repostCount} reposts`}>
            <span className="x-action-icon" ref={repostRef}><Repeat2 size={19} /></span><Count value={post.repostCount} />
          </Action>
          <Action className={`like ${isLiked ? 'active' : ''}`} onClick={like} pressed={isLiked} label={`${isLiked ? 'Unlike' : 'Like'} ${post.handle}, ${post.likeCount} likes`}>
            <span className="x-action-icon"><span className="x-like-ring" ref={ringRef} aria-hidden="true" /><span ref={heartRef} className="x-heart"><Heart size={18} fill={isLiked ? 'currentColor' : 'none'} /></span></span><Count value={post.likeCount} />
          </Action>
          {!embedded && <Action className="sound" onClick={() => setPicker(true)} label="Add sound reaction">
            <span className="x-action-icon x-sound-add"><AudioLines size={18} /><Plus size={10} strokeWidth={3} /></span>
          </Action>}
          <span className="x-action views">
            <span className="sr-only">{post.viewCount} views</span>
            <span className="x-action-icon" aria-hidden="true"><BarChart2 size={18} /></span><span aria-hidden="true"><Count value={post.viewCount} /></span>
          </span>
          <span className="x-actions-end">
            <Action className={`bookmark ${isBookmarked ? 'active' : ''}`} onClick={bookmark} pressed={isBookmarked} label={`${isBookmarked ? 'Remove bookmark for' : 'Bookmark'} ${post.handle}`}>
              <span className="x-action-icon" ref={bookmarkRef}><Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} /></span>
            </Action>
            <Action className="share" onClick={() => void share()} label={`Share ${post.handle} post`}>
              <span className="x-action-icon"><Share size={18} /></span>
            </Action>
          </span>
        </div>
      </div>
      {picker && <ReactionPicker post={post} onClose={() => setPicker(false)} />}
    </article>
  )
}
