import { useEffect, useRef, useState } from 'react'
import { AudioLines, ImageIcon, Mic, Smile } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PostCard } from '../components/PostCard'
import { SEED_POSTS } from '../data'
import { staggerIn } from '../motion'
import { useAppStore } from '../store'
import type { Post } from '../types'
import { avatarContent, avatarStyle } from '../avatar'
import { ownerLook, useIdentity } from '../identity'

const TABS = [
  { id: 'for-you', label: 'For you' },
  { id: 'following', label: 'Following' },
  { id: 'sound', label: 'Sound' },
  { id: 'design', label: 'Design' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'safety', label: 'Trust & Safety' },
] as const
type TabId = (typeof TABS)[number]['id']

function matches(post: Post, q: string) {
  const needle = q.toLowerCase()
  return [post.author, post.handle, post.body, post.reaction?.name, post.voice?.transcript].some((field) => field?.toLowerCase().includes(needle))
}

export default function Feed() {
  const posts = useAppStore((state) => state.posts)
  const me = ownerLook(useIdentity((state) => state.identity))
  const [params, setParams] = useSearchParams()
  const query = params.get('q')?.trim() ?? ''
  const [tab, setTab] = useState<TabId>('for-you')
  const [muted, setMuted] = useState<string[]>([])
  const [extra, setExtra] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const base = posts
    .filter((post) => tab === 'for-you' || (tab === 'following' ? post.following : post.topics?.includes(tab)))
    .filter((post) => !muted.includes(post.handle))
  const mute = (handle: string) => {
    setMuted((list) => [...list, handle])
    toast(`You muted ${handle}`, { action: { label: 'Undo', onClick: () => setMuted((list) => list.filter((item) => item !== handle)) } })
  }
  const extras = extra ? SEED_POSTS.slice(0, 3).map((post) => ({ ...post, id: `extra-${post.id}`, timestamp: 'now', body: `New in the demo: ${post.body}` })) : []
  const visible = [...extras, ...base].filter((post) => !query || matches(post, query))

  // New posts arrive at the top of the timeline, staggered, the way a refreshed feed does.
  useEffect(() => {
    if (!extra || !listRef.current) return
    staggerIn(listRef.current.querySelectorAll('[data-new-post]'), { distance: -14, gap: 45 })
  }, [extra])

  return <>
    <header className="x-timeline-header">
      <h1 className="sr-only">Home</h1>
      <div className="x-tabs" role="tablist" aria-label="Timeline">
        {TABS.map(({ id, label }) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
          <span>{label}</span>
        </button>)}
      </div>
    </header>

    {query && <div className="x-search-banner">
      <span>Showing {visible.length} {visible.length === 1 ? 'post' : 'posts'} matching “{query}”</span>
      <button onClick={() => { params.delete('q'); setParams(params) }}>Clear</button>
    </div>}

    <Link to="/compose" className="x-composer-row">
      <span className="avatar" aria-hidden="true" style={avatarStyle(me.initials)}>{avatarContent(me.initials, me.photo)}</span>
      <span className="x-composer-body">
        <span className="x-composer-placeholder">What’s happening?</span>
        <span className="x-composer-tools" aria-hidden="true">
          <Mic size={19} /><AudioLines size={19} /><ImageIcon size={19} /><Smile size={19} />
          <span className="x-composer-post">Post</span>
        </span>
      </span>
    </Link>

    {!extra && !query && <button className="x-show-posts" onClick={() => setExtra(true)}>Show 3 posts</button>}

    <div className="x-feed" ref={listRef}>
      {visible.map((post) => <div key={post.id} data-new-post={post.id.startsWith('extra-') ? '' : undefined}><PostCard post={post} onMute={mute} /></div>)}
      {visible.length === 0 && (query
        ? <div className="x-empty"><strong>No results for “{query}”</strong><p>Try a sound name like Applause, or a handle like @mayamakes.</p></div>
        : <div className="x-empty"><strong>Nothing here yet</strong><p>Posts tagged with this topic will show up here.</p></div>)}
    </div>

    <footer className="x-feed-end">
      <AudioLines size={20} aria-hidden="true" />
      <p>Expressive by design. <strong>Silent by default.</strong></p>
      <span>All accounts, posts, counts and sounds are fictional.</span>
    </footer>
  </>
}
