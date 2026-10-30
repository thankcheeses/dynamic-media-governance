import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, CalendarDays, Check, Link2, Loader2, MoreHorizontal, Search, ShieldCheck, Upload, X as XIcon } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { DynamicHeader, HeaderThumb } from '../components/DynamicHeader'
import { PostCard, Verified } from '../components/PostCard'
import { avatarContent, avatarStyle } from '../avatar'
import { OWNER_HANDLE, accountFor, type Account } from '../accounts'
import { analyzeUpload, type UploadAnalysis } from '../analyze'
import { GiphyPanel } from '../components/GiphyPanel'
import { fetchGiphyFile } from '../giphy'
import { fetchHostedFile, scanHosted } from '../hostedScan'
import { BIO_MAX, HANDLE_MAX, NAME_MAX, initialsOf, normalizeHandle, ownerLook, squarePhoto, useIdentity } from '../identity'
import { DEFAULT_HEADER_ID, HEADER_LIMITS, HEADER_PRESETS, headerPreset, isPublishable, scanHeader, type HeaderDecision, type HeaderPreset, type HeaderScan } from '../headers'
import { useAppStore } from '../store'

const decisionLabel: Record<HeaderScan['decision'], string> = {
  PASS: 'PASS',
  PROVISIONAL: 'PROVISIONAL PUBLISH',
  BLOCK: 'HARD BLOCK',
  REJECTED: 'REJECTED AT UPLOAD',
}

/** Simulated scan time for samples. The framework budgets 10–20 seconds for a real PEA scan. */
const SCAN_MS = 1400

/** A synthetic preset describing an uploaded file, so it can share the scan and player. */
function uploadPreset(analysis: UploadAnalysis): HeaderPreset {
  const m = analysis.measurement
  return { id: 'upload', name: analysis.media.name, description: `Uploaded header: ${analysis.media.name}`, style: 'upload', fps: m.fps, loopSeconds: m.loopSeconds, sizeMB: m.sizeMB, flashesPerSecond: m.flashesPerSecond, redFlash: m.redFlash, measured: true }
}

function ScanResult({ scan, notes, onPublish }: { scan: HeaderScan; notes?: string[]; onPublish: () => void }) {
  return <div className={`scan-result decision-${scan.decision.toLowerCase()}`}>
    <div className="scan-decision"><span className="status-badge">{decisionLabel[scan.decision]}</span><p>{scan.summary}</p></div>
    <ul className="scan-checks">
      {scan.checks.map((check) => <li key={check.key} className={check.pass ? 'pass' : 'fail'}>
        {check.pass ? <Check size={15} aria-hidden="true" /> : <XIcon size={15} aria-hidden="true" />}
        <span><strong>{check.label}</strong> {check.detail}</span>
        <span className="sr-only">{check.pass ? 'passed' : 'failed'}</span>
      </li>)}
    </ul>
    {notes?.map((note) => <p key={note} className="scan-note">{note}</p>)}
    {isPublishable(scan.decision)
      ? <button type="button" className="x-pill-button" onClick={onPublish}>{scan.decision === 'PASS' ? 'Use this header' : 'Publish with warning label'}</button>
      : <p className="scan-blocked">This header can’t be published. Your current header stays live.</p>}
  </div>
}

function HeaderStudio({ onDone }: { onDone: () => void }) {
  const { profileHeader, setProfileHeader, setUploadedHeader, addAudit } = useAppStore()
  const [selected, setSelected] = useState(profileHeader.presetId === 'upload' ? HEADER_PRESETS[0].id : profileHeader.presetId)
  const [scanning, setScanning] = useState(false)
  const [scan, setScan] = useState<HeaderScan | null>(null)
  const [upload, setUpload] = useState<UploadAnalysis | null>(null)
  const [uploadError, setUploadError] = useState('')
  const timer = useRef<number | undefined>(undefined)
  const closeRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onDone() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDone])

  const preset = upload ? uploadPreset(upload) : headerPreset(selected)
  const choose = (id: string) => {
    setSelected(id); setUpload(null); setScan(null); setScanning(false); setUploadError(''); window.clearTimeout(timer.current)
    // A hosted sample with no measurements is fetched and scanned for real, like a GIPHY pick.
    const sample = headerPreset(id)
    if (sample.scanInBrowser) void scanFile(() => fetchHostedFile(sample), `hosted:${sample.id}`, { source: 'giphy', sourceUrl: sample.hosted?.pageUrl })
  }
  const runScan = () => {
    setScanning(true); setScan(null)
    timer.current = window.setTimeout(() => {
      const result = scanHeader(preset)
      setScan(result); setScanning(false)
      addAudit('header_scanned', preset.id, `${preset.name}: ${result.decision}. ${result.checks.filter((c) => !c.pass).map((c) => c.label).join(', ') || 'All checks passed'}`)
    }, SCAN_MS)
  }
  const scanFile = async (load: () => Promise<File>, source: string, origin?: { source: 'device' | 'giphy'; sourceUrl?: string }) => {
    window.clearTimeout(timer.current)
    setUploadError(''); setScan(null); setUpload(null); setScanning(true)
    try {
      const file = await load()
      const analysis = await analyzeUpload(file, origin)
      const result = scanHeader(uploadPreset(analysis))
      setUpload(analysis); setScan(result)
      const m = analysis.measurement
      addAudit('header_scanned', source, `${file.name}: ${result.decision}. ${m.flashesPerSecond} flashes/s, ${m.fps} fps, ${m.loopSeconds} s, ${m.sizeMB} MB`)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'That file couldn’t be read')
    } finally {
      setScanning(false)
    }
  }
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void scanFile(async () => file, 'upload', { source: 'device' })
  }
  const publish = () => {
    if (!scan || !isPublishable(scan.decision)) return
    if (upload) setUploadedHeader(upload.media)
    setProfileHeader(upload ? 'upload' : preset.id, scan.decision)
    addAudit(scan.decision === 'PASS' ? 'header_published' : 'header_published_provisional', preset.id, scan.decision === 'PASS' ? `${preset.name} is live` : `${preset.name} is live behind a warning label; manual review due within 24 hours`)
    toast.success(scan.decision === 'PASS' ? 'Header updated' : 'Header published with a warning label')
    onDone()
  }

  return <div className="x-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onDone() }}>
    <section className="header-studio" role="dialog" aria-modal="true" aria-labelledby="studio-title">
      <div className="studio-head">
        <button ref={closeRef} type="button" className="icon-button" onClick={onDone} aria-label="Close"><XIcon size={19} /></button>
        <h2 id="studio-title">Edit profile · header</h2>
      </div>
      <p className="studio-intro">Headers can be a GIF or a short video. Every file must be {HEADER_LIMITS.sizeMB} MB or less and loop in {HEADER_LIMITS.loopSeconds} seconds or less. It plays at up to {HEADER_LIMITS.fps} fps with no sound, and it is scanned for flashing before it can go live.</p>

      <div className="studio-upload">
        <input ref={fileRef} type="file" accept="image/gif,video/mp4,video/webm,video/quicktime" onChange={onFile} hidden data-testid="header-upload" />
        <button type="button" className="x-outline-pill" onClick={() => fileRef.current?.click()} disabled={scanning}><Upload size={16} aria-hidden="true" /> Upload a GIF or video</button>
        <span className="fine-print">Checked in your browser. Nothing is uploaded anywhere, and it is gone when you close the tab.</span>
      </div>
      <GiphyPanel disabled={scanning} onPick={(gif) => void scanFile(() => fetchGiphyFile(gif), `giphy:${gif.id}`, { source: 'giphy', sourceUrl: gif.url })} />
      {uploadError && <p className="scan-blocked" role="alert">{uploadError}</p>}
      {upload && <div className="studio-upload-preview"><img src={upload.media.poster} alt="" /><span><strong>{upload.media.name}</strong><small>Still frame. Nothing plays until it passes.{upload.media.source === 'giphy' && <> · <a href={upload.media.sourceUrl} target="_blank" rel="noreferrer">Via GIPHY</a></>}</small></span></div>}

      <h3 className="studio-subhead">Or try a sample</h3>
      <div className="studio-grid" role="radiogroup" aria-label="Sample headers">
        {HEADER_PRESETS.map((item) => <button key={item.id} type="button" role="radio" aria-checked={!upload && item.id === selected} className={`studio-card ${!upload && item.id === selected ? 'selected' : ''}`} onClick={() => choose(item.id)}>
          <HeaderThumb preset={item} />
          <span className="studio-card-body"><strong>{item.name}</strong><small>{item.scanInBrowser ? 'Scanned in your browser when picked' : `${item.fps} fps · ${item.loopSeconds} s · ${item.sizeMB} MB`}</small><small className={item.measured || item.scanInBrowser ? 'measured' : ''}>{item.hosted ? `Real GIF · via ${item.hosted.provider}${item.measured ? ' · measured' : ''}` : item.measured ? 'Real GIF · measured' : 'Sample · fixture values'}</small></span>
        </button>)}
      </div>
      {!upload && <>
        <p className="studio-desc"><strong>{preset.name}:</strong> {preset.description}</p>
        <div className="studio-actions">
          <button type="button" className="x-pill-button" onClick={runScan} disabled={scanning}>
            {scanning ? <><Loader2 size={16} className="spin" aria-hidden="true" /> Scanning…</> : <><ShieldCheck size={16} aria-hidden="true" /> Run PEA scan</>}
          </button>
          <span className="fine-print">{preset.measured ? 'Numbers measured from the GIF by the prototype’s analyzer (a simplified WCAG 2.3.1 screen, not a certified tool).' : 'Simulated: flash counts are fixture values.'} A real scan takes 10–20 seconds.</span>
        </div>
      </>}
      <div aria-live="polite">
        {scanning && !upload && <p className="scan-note"><Loader2 size={14} className="spin" aria-hidden="true" /> Scanning frames…</p>}
        {scan && <ScanResult scan={scan} notes={upload?.notes} onPublish={publish} />}
      </div>
    </section>
  </div>
}

/**
 * A hosted GIF nobody measured ahead of time. It shows its still frame while the
 * browser fetches and scans it, then plays its scanned frames if it passes. A
 * failed or blocked scan leaves the still frame up.
 */
function ScannedHostedHeader({ preset }: { preset: HeaderPreset }) {
  const [analysis, setAnalysis] = useState<UploadAnalysis | null>(null)
  const [error, setError] = useState('')
  // The parent keys this component by preset, so a new preset starts with fresh state.
  useEffect(() => {
    let live = true
    scanHosted(preset).then((result) => { if (live) setAnalysis(result) }).catch((err: unknown) => { if (live) setError(err instanceof Error ? err.message : 'the scan failed') })
    return () => { live = false }
  }, [preset])
  const hosted = preset.hosted!
  const scan = analysis ? scanHeader(analysis.measurement) : null
  if (analysis && scan && isPublishable(scan.decision)) {
    const scanned: HeaderPreset = { ...preset, ...analysis.measurement, fps: Math.round(1000 / analysis.media.frameMs), measured: true, scanInBrowser: false }
    return <DynamicHeader preset={scanned} decision={scan.decision} upload={analysis.media} />
  }
  const note = scan ? 'Blocked by the scan, so it stays a still frame'
    : error ? `Couldn’t scan it (${error}), so it stays a still frame`
    : 'Scanning for flashing before it plays…'
  return <div className="dynamic-header">
    <img className="still" src={hosted.still} alt={`Profile header, still frame: ${preset.description}`} />
    <span className="header-scan-note" role="status">{!scan && !error && <Loader2 size={13} className="spin" aria-hidden="true" />} {note}</span>
    <div className="header-controls"><a className="header-credit" href={hosted.pageUrl} target="_blank" rel="noreferrer">via {hosted.provider}</a></div>
  </div>
}

/**
 * "Make it yours": the visitor puts their own name, handle, bio and photo on
 * the owner account so the demo reads as their profile. It is saved only in
 * this browser; the photo is shrunk to a small square first and never uploaded.
 */
function MakeItYours({ onDone }: { onDone: () => void }) {
  const { identity, setIdentity } = useIdentity()
  const [name, setName] = useState(identity?.name ?? '')
  const [handle, setHandle] = useState(identity?.handle.replace(/^@/, '') ?? '')
  const [bio, setBio] = useState(identity?.bio ?? '')
  const [photo, setPhoto] = useState(identity?.photo)
  const [photoError, setPhotoError] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onDone() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDone])

  const cleanName = name.trim().slice(0, NAME_MAX)
  const cleanHandle = normalizeHandle(handle)
  const canSave = cleanName.length > 0 && cleanHandle.length > 1
  const initials = initialsOf(cleanName || 'Me')
  const onPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoError('')
    try { setPhoto(await squarePhoto(file)) } catch { setPhotoError('That photo couldn’t be read. Try a JPG or PNG.') }
  }
  const save = () => {
    if (!canSave) return
    setIdentity({ name: cleanName, handle: cleanHandle, bio: bio.trim().slice(0, BIO_MAX), photo })
    toast.success('This profile is yours now. It stays on this device.')
    onDone()
  }
  const reset = () => { setIdentity(null); toast.success('Back to the demo owner’s profile'); onDone() }

  return <div className="x-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onDone() }}>
    <section className="header-studio" role="dialog" aria-modal="true" aria-labelledby="yours-title">
      <div className="studio-head">
        <button ref={closeRef} type="button" className="icon-button" onClick={onDone} aria-label="Close"><XIcon size={19} /></button>
        <h2 id="yours-title">Make it yours</h2>
      </div>
      <p className="studio-intro">Put your own name and photo on this profile so the demo looks like you. Everything stays on this device: nothing is uploaded, and there is no account.</p>
      <form className="identity-form" onSubmit={(event) => { event.preventDefault(); save() }}>
        <div className="identity-photo">
          <span className="avatar" aria-hidden="true" style={avatarStyle(initials)}>{avatarContent(initials, photo)}</span>
          <span>
            <input ref={fileRef} type="file" accept="image/*" onChange={(event) => void onPhoto(event)} hidden data-testid="identity-photo" />
            <button type="button" className="x-outline-pill" onClick={() => fileRef.current?.click()}><Upload size={16} aria-hidden="true" /> {photo ? 'Change photo' : 'Add a photo'}</button>
            {photo && <> <button type="button" className="text-button" onClick={() => setPhoto(undefined)}>Remove</button></>}
          </span>
        </div>
        {photoError && <p className="scan-blocked" role="alert">{photoError}</p>}
        <label>Name<input value={name} maxLength={NAME_MAX} autoComplete="name" onChange={(event) => setName(event.target.value)} required /></label>
        <label>Handle<input value={handle} maxLength={HANDLE_MAX} autoComplete="off" spellCheck={false} placeholder="yourname" onChange={(event) => setHandle(event.target.value)} required /><span className="fine-print">Shown as {cleanHandle || '@yourname'}. Letters, numbers and underscores.</span></label>
        <label>Bio<textarea value={bio} maxLength={BIO_MAX} onChange={(event) => setBio(event.target.value)} /><span className="identity-count">{bio.length}/{BIO_MAX}</span></label>
        <div className="identity-actions">
          <button type="submit" className="x-pill-button" disabled={!canSave}>Save</button>
          {identity && <button type="button" className="x-outline-pill" onClick={reset}>Use the demo owner again</button>}
        </div>
      </form>
    </section>
  </div>
}

function headerFor(account: Account, own: { presetId: string; decision: HeaderDecision }): { preset: HeaderPreset; decision: HeaderDecision } | null {
  if (account.handle === OWNER_HANDLE) return { preset: headerPreset(own.presetId === 'upload' ? DEFAULT_HEADER_ID : own.presetId), decision: own.presetId === 'upload' ? 'PASS' : own.decision }
  return account.headerId ? { preset: headerPreset(account.headerId), decision: account.headerDecision ?? 'PASS' } : null
}

const TABS = ['Posts', 'Replies', 'Highlights', 'Media', 'Likes'] as const
const compact = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : n.toLocaleString())

function ProfileView({ handle }: { handle?: string }) {
  const navigate = useNavigate()
  const { posts, profileHeader, uploadedHeader } = useAppStore()
  const [editing, setEditing] = useState(false)
  const [personalizing, setPersonalizing] = useState(false)
  const [following, setFollowing] = useState(false)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Posts')
  const close = useCallback(() => setEditing(false), [])
  const closePersonalize = useCallback(() => setPersonalizing(false), [])
  const identity = useIdentity((state) => state.identity)
  const found = accountFor(handle ?? OWNER_HANDLE)
  useEffect(() => { window.scrollTo(0, 0) }, [])
  if (!found) return <Navigate to="/" replace />

  const isOwner = found.handle === OWNER_HANDLE
  // The owner account is shown with the visitor's own identity when they have set one.
  const me = isOwner ? ownerLook(identity) : null
  const account: Account & { photo?: string } = me ? { ...found, name: me.name, bio: me.bio, initials: me.initials, verified: !me.custom, photo: me.photo } : found
  const shownHandle = me?.handle ?? account.handle
  const own = posts.filter((post) => post.handle === account.handle)
  const header = headerFor(account, profileHeader)
  const ownUpload = isOwner && profileHeader.presetId === 'upload' ? uploadedHeader : null
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))
  const share = async () => {
    const url = window.location.href
    try { await navigator.clipboard.writeText(url); toast.success('Profile link copied') } catch { toast.info(url) }
  }

  return <div className="x-profile">
    <div className="x-profile-bar">
      <button type="button" className="icon-button" onClick={back} aria-label="Back"><ArrowLeft size={20} /></button>
      <div><strong>{account.name} {account.verified && <Verified />}</strong><span>{own.length} {own.length === 1 ? 'post' : 'posts'}</span></div>
    </div>
    <div className="x-profile-banner">
      {ownUpload
        ? <DynamicHeader key={`upload-${profileHeader.decision}`} preset={{ id: 'upload', name: ownUpload.name, description: `Uploaded header: ${ownUpload.name}`, style: 'upload', ...ownUpload.measurement, fps: Math.round(1000 / ownUpload.frameMs), measured: true }} decision={profileHeader.decision} upload={ownUpload} />
        : header?.preset.scanInBrowser
          ? <ScannedHostedHeader key={`${account.handle}-${header.preset.id}`} preset={header.preset} />
          : header
          ? <DynamicHeader key={`${account.handle}-${header.preset.id}-${header.decision}`} preset={header.preset} decision={header.decision} />
          : <div className="dynamic-header plain-header" role="img" aria-label="No header image" />}
      <div className="x-banner-actions">
        <button type="button" className="x-banner-button" onClick={back} aria-label="Back"><ArrowLeft size={18} /></button>
        <span>
          <Link to={`/?q=${encodeURIComponent(account.handle)}`} className="x-banner-button" aria-label={`Search posts from ${account.handle}`}><Search size={18} /></Link>
          <button type="button" className="x-banner-button" aria-label="Copy profile link" onClick={share}><MoreHorizontal size={18} /></button>
        </span>
      </div>
    </div>
    <div className="x-profile-head">
      <span className="avatar x-profile-avatar" aria-hidden="true" style={avatarStyle(account.initials)}>{avatarContent(account.initials, account.photo)}</span>
      {isOwner
        ? <div className="x-profile-buttons">
            <button type="button" className="x-edit-profile x-share" onClick={share}>Share</button>
            <button type="button" className="x-edit-profile" onClick={() => setPersonalizing(true)} aria-haspopup="dialog">{me?.custom ? 'Edit my details' : 'Make it yours'}</button>
            <button type="button" className="x-edit-profile" onClick={() => setEditing(true)} aria-haspopup="dialog">Edit profile</button>
          </div>
        : <button type="button" className={`x-follow-cta ${following ? 'on' : ''}`} aria-pressed={following} onClick={() => setFollowing(!following)} aria-label={`${following ? 'Unfollow' : 'Follow'} ${account.handle} (fictional, local only)`}>{following ? 'Following' : 'Follow'}</button>}
    </div>
    <div className="x-profile-info">
      <h1>{account.name} {account.verified && <Verified />}</h1>
      <span className="x-handle">{shownHandle}</span>
      <p className="x-profile-bio">{account.bio}</p>
      <div className="x-profile-meta">
        {isOwner && <a href="https://thankcheeses.github.io/dynamic-media-governance/"><Link2 size={16} aria-hidden="true" />thankcheeses.github.io/dynamic-media-governance</a>}
        <span><CalendarDays size={16} aria-hidden="true" />{account.fictional ? 'Fictional account' : me?.custom ? 'Your profile, on this device only' : 'Prototype profile · October 2026'}</span>
      </div>
      <div className="x-profile-follows">
        <span><strong>{compact(account.following)}</strong> Following</span>
        <span><strong>{compact(account.followers + (following ? 1 : 0))}</strong> Followers</span>
        {isOwner && <small>(the prototype’s fictional accounts)</small>}
      </div>
    </div>
    <div className="x-tabs x-profile-tabs" role="tablist" aria-label="Profile sections">
      {TABS.map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}><span>{name}</span></button>)}
    </div>
    <div role="tabpanel" aria-label={tab}>
      {tab === 'Posts'
        ? (own.length === 0 ? <div className="profile-empty"><h3>No posts yet</h3></div> : own.map((post) => <PostCard key={post.id} post={post} />))
        : <div className="profile-empty"><h3>Nothing here yet</h3><p className="muted">This prototype only fills in Posts.</p></div>}
    </div>
    {editing && <HeaderStudio onDone={close} />}
    {personalizing && <MakeItYours onDone={closePersonalize} />}
  </div>
}

/** Keyed by handle so moving between profiles starts each one fresh. */
export default function Profile() {
  const { handle } = useParams()
  return <ProfileView key={handle ?? 'me'} handle={handle} />
}
