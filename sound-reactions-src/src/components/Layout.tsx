import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AudioLines, FileClock, GitCompareArrows, Home, MoreHorizontal, PenLine, Presentation, Search, Settings, ShieldCheck, UserRound, Volume2, VolumeX } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Toaster } from 'sonner'
import { audioController, useAudio } from '../audio'
import { useAppStore } from '../store'
import { HAS_GENERATED_AUDIO } from '../data'
import { avatarContent, avatarStyle } from '../avatar'
import { Verified } from './PostCard'
import { profilePath } from '../accounts'
import { WelcomeTour } from './WelcomeTour'

const TOUR_KEY = 'sound-reactions-tour-seen'
const tourSeen = () => { try { return window.localStorage.getItem(TOUR_KEY) === '1' } catch { return false } }
const markTourSeen = () => { try { window.localStorage.setItem(TOUR_KEY, '1') } catch { /* storage may be unavailable */ } }

const navigation = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/compare', label: 'Compare', icon: GitCompareArrows },
  { to: '/governance', label: 'Governance', icon: ShieldCheck },
  { to: '/audit', label: 'Audit log', icon: FileClock },
  { to: '/presentation', label: 'Presentation', icon: Presentation },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const mobileTabs = navigation.filter((item) => item.to !== '/settings')

// Fictional trends. Each one opens the part of the prototype it describes.
const trends = [
  { context: 'Design · Trending', topic: 'Silent by default', meta: 'How playback starts only on a tap', to: '/settings' },
  { context: 'Trust & Safety · Trending', topic: '#PreflightCheck', meta: '8 checks before a sound goes live', to: '/governance' },
  { context: 'Accessibility · Trending', topic: 'Voice posts vs. reactions', meta: 'Side-by-side comparison', to: '/compare' },
  { context: 'Product · Trending', topic: 'Staged rollout', meta: '8-slide proposal deck', to: '/presentation' },
]

const suggestions = [
  { name: 'Maya Chen', handle: '@mayamakes', initials: 'MC', verified: true },
  { name: 'Kiara Vibes', handle: '@kiaravibes', initials: 'KV', verified: true },
  { name: 'Sam Okoye', handle: '@samoko', initials: 'SO', verified: false },
]

function SearchBox() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const q = value.trim()
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/')
  }
  return <form className="x-search" role="search" onSubmit={submit}>
    <Search size={18} aria-hidden="true" />
    <label htmlFor="feed-search" className="sr-only">Search posts</label>
    <input id="feed-search" type="search" placeholder="Search" value={value} onChange={(event) => setValue(event.target.value)} />
  </form>
}

function WhoToFollow() {
  const [following, setFollowing] = useState<string[]>([])
  return <section className="x-panel" aria-labelledby="follow-title">
    <h2 id="follow-title">Who to follow</h2>
    {suggestions.map((person) => {
      const on = following.includes(person.handle)
      return <div key={person.handle} className="x-follow-row">
        <Link to={profilePath(person.handle)} className="avatar" aria-hidden="true" tabIndex={-1} style={avatarStyle(person.initials)}>{avatarContent(person.initials)}</Link>
        <Link to={profilePath(person.handle)} className="x-follow-name"><span className="x-follow-top"><strong>{person.name}</strong>{person.verified && <Verified />}</span><span>{person.handle}</span></Link>
        <button className={`x-follow-button ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setFollowing(on ? following.filter((h) => h !== person.handle) : [...following, person.handle])} aria-label={`${on ? 'Unfollow' : 'Follow'} ${person.handle} (fictional, local only)`}>{on ? 'Following' : 'Follow'}</button>
      </div>
    })}
  </section>
}

/** Mobile account menu, opened from the avatar at the top left (X's side drawer pattern). */
function AccountDrawer({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const items = [
    { to: '/profile', label: 'Profile', icon: UserRound },
    { to: '/governance', label: 'Governance', icon: ShieldCheck },
    { to: '/audit', label: 'Audit log', icon: FileClock },
    { to: '/compare', label: 'Compare', icon: GitCompareArrows },
    { to: '/presentation', label: 'Presentation', icon: Presentation },
  ]
  return <div className="x-drawer-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <nav className="x-drawer" aria-label="Account menu">
      <Link to="/profile" onClick={onClose} className="avatar x-drawer-avatar" aria-hidden="true" tabIndex={-1} style={avatarStyle('BB')}>{avatarContent('BB')}</Link>
      <Link to="/profile" onClick={onClose} className="x-drawer-name"><strong>B. Baynard-Malone <Verified /></strong><span>@baynardmalone</span></Link>
      <div className="x-drawer-follows"><span><strong>9</strong> Following</span><span><strong>9</strong> Followers</span></div>
      <ul>
        {items.map(({ to, label, icon: Icon }) => <li key={to}><Link to={to} onClick={onClose}><Icon size={24} aria-hidden="true" />{label}</Link></li>)}
      </ul>
      <div className="x-drawer-foot"><Link to="/settings" onClick={onClose}><Settings size={20} aria-hidden="true" />Settings and privacy</Link></div>
    </nav>
  </div>
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const settings = useAppStore((state) => state.settings)
  const setSetting = useAppStore((state) => state.setSetting)
  const { state: playback, stop } = useAudio()
  const isFeed = location.pathname === '/'
  const [drawer, setDrawer] = useState(false)
  const [tour, setTour] = useState(() => !tourSeen())
  const closeTour = useCallback(() => { markTourSeen(); setTour(false) }, [])
  useEffect(() => { audioController.setVolume(settings.volume, settings.muted) }, [settings.volume, settings.muted])
  useEffect(() => {
    const visibility = () => { if (document.hidden) stop('Paused because the tab was hidden') }
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [stop])
  useEffect(() => { if (settings.lowPower) stop('Paused because low-power mode is on') }, [settings.lowPower, stop])
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

  return <div className={`app theme-${settings.theme} ${settings.reducedMotion ? 'reduce-motion' : ''}`}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <div className="concept-banner">
      <span className="concept-label"><strong>CONCEPT PROTOTYPE</strong> · NOT AFFILIATED WITH X</span>
      <nav className="site-tabs" aria-label="Site">
        <a href="../"><b>1</b><span>The proposal</span></a>
        <Link to="/" aria-current="page"><b>2</b><span>Try it: Sound Reactions</span></Link>
      </nav>
      <div className="header-audio">
        <button type="button" className="tour-button" onClick={() => setTour(true)} aria-label="Take the tour"><span aria-hidden="true">?</span><span className="tour-button-label">Tour</span></button>
        <button className="banner-icon" onClick={() => setSetting('muted', !settings.muted)} aria-label={settings.muted ? 'Unmute all audio' : 'Mute all audio'}>{settings.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
        <label htmlFor="header-volume" className="sr-only">Volume</label>
        <input id="header-volume" type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(event) => setSetting('volume', Number(event.target.value))} />
      </div>
    </div>

    <div className="x-mobile-top">
      <button type="button" className="avatar small" style={avatarStyle('BB')} aria-label="Open account menu" aria-haspopup="dialog" onClick={() => setDrawer(true)}>{avatarContent('BB')}</button>
      <Link to="/" className="x-brand" aria-label="Sound Reactions home"><AudioLines size={24} /></Link>
      <Link to="/settings" className="x-icon-link" aria-label="Open settings"><Settings size={20} /></Link>
    </div>
    {drawer && <AccountDrawer onClose={() => setDrawer(false)} />}
    {tour && <WelcomeTour onClose={closeTour} />}

    <div className="x-shell">
      <header className="x-nav">
        <div className="x-nav-inner">
          <Link to="/" className="x-brand" aria-label="Sound Reactions home"><AudioLines size={28} /></Link>
          <nav aria-label="Primary navigation">
            {navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `x-nav-item ${isActive ? 'active' : ''}`}>
              {({ isActive }) => <><Icon size={26} strokeWidth={isActive ? 2.5 : 1.75} aria-hidden="true" /><span>{label}</span></>}
            </NavLink>)}
          </nav>
          <Link to="/compose" className="x-post-button"><PenLine size={22} aria-hidden="true" /><span>Post</span></Link>
          <Link to="/profile" className="x-account" aria-label="B. Baynard-Malone, @baynardmalone. Open profile">
            <span className="avatar" aria-hidden="true" style={avatarStyle('BB')}>{avatarContent('BB')}</span>
            <span className="x-account-name"><strong>B. Baynard-Malone</strong><span>@baynardmalone</span></span>
            <MoreHorizontal size={18} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main id="main-content" className={`x-main ${isFeed ? '' : 'workspace'}`}>{children}</main>

      {isFeed && <aside className="x-aside" aria-label="Trends and suggestions">
        <div className="x-aside-sticky">
          <SearchBox />
          <section className="x-panel x-premium">
            <h2>Silent by default</h2>
            <p>Sounds never autoplay. Every reaction has a text version, and only one clip plays at a time.</p>
            <Link to="/presentation" className="x-pill-button">See the proposal</Link>
          </section>
          <section className="x-panel" aria-labelledby="trends-title">
            <h2 id="trends-title">What’s happening</h2>
            {trends.map((trend) => <Link key={trend.topic} to={trend.to} className="x-trend">
              <span>{trend.context}</span><strong>{trend.topic}</strong><span>{trend.meta}</span>
            </Link>)}
          </section>
          <WhoToFollow />
          <nav className="x-aside-footer" aria-label="Prototype information">
            <Link to="/compare">Voice vs. reactions</Link><span aria-hidden="true">·</span>
            <Link to="/governance">Safety</Link><span aria-hidden="true">·</span>
            <Link to="/settings">Accessibility</Link><span aria-hidden="true">·</span>
            <Link to="/audit">Audit log</Link><span aria-hidden="true">·</span>
            {HAS_GENERATED_AUDIO && <><span>Sounds and voice made with <a href="https://elevenlabs.io" target="_blank" rel="noreferrer">elevenlabs.io</a></span><span aria-hidden="true">·</span></>}
            <span>© 2026 Independent concept · Not affiliated with X · All accounts fictional</span>
          </nav>
        </div>
      </aside>}
    </div>

    <nav className="x-bottom-tabs" aria-label="Mobile navigation">{mobileTabs.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''} aria-label={label}>
      {({ isActive }) => <Icon size={24} strokeWidth={isActive ? 2.5 : 1.75} />}
    </NavLink>)}</nav>
    <Link to="/compose" className="x-fab" aria-label="Compose a new post"><PenLine size={22} /></Link>
    <div className="sr-only" role="status" aria-live="polite">{playback.message}</div>
    <Toaster position="bottom-center" toastOptions={{ className: 'x-toast' }} />
  </div>
}
