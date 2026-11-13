import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, CalendarDays, Check, FolderArchive, Link2, Loader2, MapPin, MoreHorizontal, Search, ShieldCheck, Upload, X as XIcon } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { DynamicHeader, HeaderThumb } from '../components/DynamicHeader'
import { PostCard, Verified } from '../components/PostCard'
import { avatarContent, avatarStyle } from '../avatar'
import { resolveBanner, type Banner } from '../banner'
import { GiphyPanel } from '../components/GiphyPanel'
import { BIO_MAX, HANDLE_MAX, NAME_MAX, initialsOf, normalizeHandle, squarePhoto, useIdentity } from '../identity'
import { HEADER_LIMITS, HEADER_PRESETS, headerPreset, isPublishable, type HeaderScan } from '../headers'
import { hostedScanState, scanHosted, scanSource, useHostedScanStates, type HeaderSource, type ScannedHeader } from '../headerScan'
import { useAppStore } from '../store'
import { useImport } from '../importStore'
import { ImportArchive } from '../components/ImportArchive'
import { compactCount, profileFor, type MetaRow, type ProfileModel } from '../profileView'

const decisionLabel: Record<HeaderScan['decision'], string> = {
  PASS: 'PASS',
  PROVISIONAL: 'PROVISIONAL PUBLISH',
  BLOCK: 'HARD BLOCK',
  REJECTED: 'REJECTED AT UPLOAD',
}

/** Simulated scan time for samples. The framework budgets 10–20 seconds for a real PEA scan. */
const SCAN_MS = 1400

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

/** A file picked here (device or GIPHY) becomes a session-only upload; a sample or hosted pick is published by id. */
const isFileSource = (source: HeaderSource | null) => source?.kind === 'device' || source?.kind === 'giphy'

function HeaderStudio({ onDone }: { onDone: () => void }) {
  const { profileHeader, pickPreset, pickUpload, addAudit } = useAppStore()
  const [selected, setSelected] = useState(profileHeader.kind === 'preset' ? profileHeader.presetId : HEADER_PRESETS[0].id)
  const [scanning, setScanning] = useState(false)
  const [source, setSource] = useState<HeaderSource | null>(null)
  const [result, setResult] = useState<ScannedHeader | null>(null)
  const [error, setError] = useState('')
  const token = useRef(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => () => { token.current++ }, [])
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onDone() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDone])

  const preset = result?.preset ?? headerPreset(selected)
  const fileResult = isFileSource(source) ? result : null

  /** Every scan in the studio goes through the one entry point; a hosted pick shares the banner's per-tab cache. */
  const run = async (next: HeaderSource) => {
    const mine = ++token.current
    setSource(next); setResult(null); setError(''); setScanning(true)
    try {
      const scanned = next.kind === 'hosted' ? await scanHosted(next.preset, { audit: addAudit }) : await scanSource(next, { audit: addAudit, fixtureDelayMs: SCAN_MS })
      if (mine === token.current) setResult(scanned)
    } catch (err) {
      if (mine === token.current) setError(err instanceof Error ? err.message : 'That file couldn’t be read')
    } finally {
      if (mine === token.current) setScanning(false)
    }
  }
  const choose = (id: string) => {
    token.current++
    setSelected(id); setSource(null); setResult(null); setError(''); setScanning(false)
    // A hosted sample with no measurements is fetched and scanned for real, like a GIPHY pick.
    const sample = headerPreset(id)
    if (sample.scanInBrowser) void run({ kind: 'hosted', preset: sample })
  }
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void run({ kind: 'device', file })
  }
  const publish = () => {
    if (!result || !source || !isPublishable(result.scan.decision)) return
    if (isFileSource(source) && result.analysis) pickUpload(result.analysis.media, result.scan.decision)
    else pickPreset(selected, result.scan.decision)
    addAudit(result.scan.decision === 'PASS' ? 'header_published' : 'header_published_provisional', preset.id, result.scan.decision === 'PASS' ? `${preset.name} is live` : `${preset.name} is live behind a warning label; manual review due within 24 hours`)
    toast.success(result.scan.decision === 'PASS' ? 'Header updated' : 'Header published with a warning label')
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
      <GiphyPanel disabled={scanning} onPick={(gif) => void run({ kind: 'giphy', gif })} />
      {error && <p className="scan-blocked" role="alert">{error}</p>}
      {fileResult?.analysis && <div className="studio-upload-preview"><img src={fileResult.analysis.media.poster} alt="" /><span><strong>{fileResult.analysis.media.name}</strong><small>Still frame. Nothing plays until it passes.{fileResult.analysis.media.source === 'giphy' && <> · <a href={fileResult.analysis.media.sourceUrl} target="_blank" rel="noreferrer">Via GIPHY</a></>}</small></span></div>}

      <h3 className="studio-subhead">Or try a sample</h3>
      <div className="studio-grid" role="radiogroup" aria-label="Sample headers">
        {HEADER_PRESETS.map((item) => <button key={item.id} type="button" role="radio" aria-checked={!fileResult && item.id === selected} className={`studio-card ${!fileResult && item.id === selected ? 'selected' : ''}`} onClick={() => choose(item.id)}>
          <HeaderThumb preset={item} />
          <span className="studio-card-body"><strong>{item.name}</strong><small>{item.scanInBrowser ? 'Scanned in your browser when picked' : `${item.fps} fps · ${item.loopSeconds} s · ${item.sizeMB} MB`}</small><small className={item.measured || item.scanInBrowser ? 'measured' : ''}>{item.hosted ? `Real GIF · via ${item.hosted.provider}${item.measured ? ' · measured' : ''}` : item.measured ? 'Real GIF · measured' : 'Sample · fixture values'}</small></span>
        </button>)}
      </div>
      {!fileResult && <>
        <p className="studio-desc"><strong>{preset.name}:</strong> {preset.description}</p>
        <div className="studio-actions">
          <button type="button" className="x-pill-button" onClick={() => void run({ kind: 'fixture', preset: headerPreset(selected) })} disabled={scanning}>
            {scanning ? <><Loader2 size={16} className="spin" aria-hidden="true" /> Scanning…</> : <><ShieldCheck size={16} aria-hidden="true" /> Run PEA scan</>}
          </button>
          <span className="fine-print">{preset.measured ? 'Numbers measured from the GIF by the prototype’s analyzer (a simplified WCAG 2.3.1 screen, not a certified tool).' : 'Simulated: flash counts are fixture values.'} A real scan takes 10–20 seconds.</span>
        </div>
      </>}
      <div aria-live="polite">
        {scanning && !fileResult && <p className="scan-note"><Loader2 size={14} className="spin" aria-hidden="true" /> Scanning frames…</p>}
        {result && <ScanResult scan={result.scan} notes={result.notes} onPublish={publish} />}
      </div>
    </section>
  </div>
}

/** Renders whatever the banner resolver decided. The still-frame states carry their reason on the banner itself. */
function ProfileBanner({ banner }: { banner: Banner }) {
  switch (banner.kind) {
    case 'none': return <div className="dynamic-header plain-header" role="img" aria-label="No header image" />
    case 'archive-still': return <div className="dynamic-header"><img className="still" src={banner.src} alt="Your X header image, from your archive" /></div>
    case 'playable': return <DynamicHeader key={banner.key} preset={banner.preset} decision={banner.decision} upload={banner.upload} credit={banner.credit} provenance={banner.provenance} />
    default: {
      const { preset, still, credit } = banner
      const note = banner.kind === 'blocked' ? 'Blocked by the scan, so it stays a still frame'
        : banner.kind === 'failed' ? `Couldn’t scan it (${banner.reason}), so it stays a still frame`
        : 'Scanning for flashing before it plays…'
      return <div className="dynamic-header">
        {still
          ? <img className="still" src={still} alt={`Profile header, still frame: ${preset.description}`} />
          : <div className="still" role="img" aria-label={`Profile header, not yet playing: ${preset.description}`} />}
        <span className="header-scan-note" role="status">{banner.kind === 'scanning' && <Loader2 size={13} className="spin" aria-hidden="true" />} {note}</span>
        <div className="header-controls"><a className="header-credit" href={credit.pageUrl} target="_blank" rel="noreferrer">via {credit.provider}</a></div>
      </div>
    }
  }
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

const TABS = ['Posts', 'Replies', 'Highlights', 'Media', 'Likes'] as const

const META_ICONS = { link: Link2, pin: MapPin, calendar: CalendarDays, archive: FolderArchive } as const
function Meta({ row }: { row: MetaRow }) {
  const Icon = META_ICONS[row.icon]
  if (row.href) return <a href={row.href}><Icon size={16} aria-hidden="true" />{row.text}</a>
  return <span><Icon size={16} aria-hidden="true" />{row.text}</span>
}

/** /me before anything is imported: explains the preview and opens the importer. */
function ImportLanding() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return <div className="x-profile import-landing">
    <div className="x-profile-bar"><div><strong>Preview with your X archive</strong><span>Your profile, on this device only</span></div></div>
    <section className="import-landing-body">
      <FolderArchive size={40} aria-hidden="true" />
      <h1>See this with your own posts</h1>
      <p>Pick the data archive X gives you and the prototype shows <strong>your</strong> profile and timeline with a moving banner and sound reactions. It is read in your browser: nothing is uploaded, there is no login, and nothing changes on X.</p>
      <button type="button" className="x-follow-cta" onClick={() => setOpen(true)} aria-haspopup="dialog">Preview with my X archive</button>
      <p className="fine-print">Not ready? <Link to="/profile">Try the demo profile</Link> instead, or read the <Link to="/privacy">privacy notice</Link>.</p>
    </section>
    {open && <ImportArchive onDone={close} />}
  </div>
}

function ProfileView({ handle, imported = false }: { handle?: string; imported?: boolean }) {
  const navigate = useNavigate()
  const { posts, profileHeader, uploadedHeader, highlights, addAudit } = useAppStore()
  const importState = useImport()
  const identity = useIdentity((state) => state.identity)
  const [editing, setEditing] = useState(false)
  const [personalizing, setPersonalizing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [following, setFollowing] = useState(false)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Posts')
  const close = useCallback(() => setEditing(false), [])
  const closePersonalize = useCallback(() => setPersonalizing(false), [])
  const closeImport = useCallback(() => setImporting(false), [])
  useEffect(() => { window.scrollTo(0, 0) }, [])

  const resolution = profileFor({ handle, imported, identity, importAccount: importState.account, importStats: importState.stats, posts, highlights })
  const model: ProfileModel | null = resolution.kind === 'profile' ? resolution.model : null
  // The banner follows the hosted-scan cache: a change there re-renders this page.
  useHostedScanStates()
  const banner: Banner = model
    ? resolveBanner({ account: model.account, mine: model.mine, isImported: model.isImported, pick: profileHeader, uploadedHeader, hostedScan: hostedScanState })
    : { kind: 'none' }
  const pendingHosted = banner.kind === 'scanning' ? banner.preset : null
  useEffect(() => {
    if (pendingHosted && hostedScanState(pendingHosted.id).status === 'idle') void scanHosted(pendingHosted, { audit: addAudit }).catch(() => undefined)
  }, [pendingHosted, addAudit])

  if (resolution.kind === 'import-landing') return <ImportLanding />
  if (!model) return <Navigate to="/" replace />
  const { account, shownHandle, actions, meta, empty } = model

  const clearImport = () => { importState.clear(); toast('Your import was cleared from this device'); navigate('/profile') }
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))
  const share = async () => {
    const url = window.location.href
    try { await navigator.clipboard.writeText(url); toast.success('Profile link copied') } catch { toast.info(url) }
  }

  return <div className="x-profile">
    <div className="x-profile-bar">
      <button type="button" className="icon-button" onClick={back} aria-label="Back"><ArrowLeft size={20} /></button>
      <div><strong>{account.name} {account.verified && <Verified />}</strong><span>{model.postCount}</span></div>
    </div>
    <div className="x-profile-banner">
      <ProfileBanner banner={banner} />
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
      {actions === 'imported'
        ? <div className="x-profile-buttons">
            <button type="button" className="x-edit-profile x-share" onClick={clearImport}>Clear my import</button>
            <button type="button" className="x-edit-profile" onClick={() => setEditing(true)} aria-haspopup="dialog">Edit profile</button>
          </div>
        : actions === 'owner'
        ? <div className="x-profile-buttons">
            <button type="button" className="x-edit-profile x-share" onClick={share}>Share</button>
            <button type="button" className="x-edit-profile" onClick={() => setPersonalizing(true)} aria-haspopup="dialog">{model.customIdentity ? 'Edit my details' : 'Make it yours'}</button>
            <button type="button" className="x-edit-profile" onClick={() => setImporting(true)} aria-haspopup="dialog">Use my X archive</button>
            <button type="button" className="x-edit-profile" onClick={() => setEditing(true)} aria-haspopup="dialog">Edit profile</button>
          </div>
        : <button type="button" className={`x-follow-cta ${following ? 'on' : ''}`} aria-pressed={following} onClick={() => setFollowing(!following)} aria-label={`${following ? 'Unfollow' : 'Follow'} ${account.handle} (fictional, local only)`}>{following ? 'Following' : 'Follow'}</button>}
    </div>
    <div className="x-profile-info">
      <h1>{account.name} {account.verified && <Verified />}</h1>
      <span className="x-handle">{shownHandle}</span>
      <p className="x-profile-bio">{account.bio}</p>
      <div className="x-profile-meta">{meta.map((row) => <Meta key={`${row.icon}-${row.text}`} row={row} />)}</div>
      <div className="x-profile-follows">
        {model.following !== null && <span><strong>{compactCount(model.following)}</strong> Following</span>}
        {model.followers !== null && <span><strong>{compactCount(model.followers + (following ? 1 : 0))}</strong> Followers</span>}
        {model.followsNote && <small>{model.followsNote}</small>}
      </div>
    </div>
    <div className="x-tabs x-profile-tabs" role="tablist" aria-label="Profile sections">
      {TABS.map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}><span>{name}</span></button>)}
    </div>
    <div role="tabpanel" aria-label={tab}>
      {tab === 'Posts' && (model.topLevel.length === 0 ? <div className="profile-empty"><h3>No posts yet</h3></div> : model.topLevel.map((post) => <PostCard key={post.id} post={post} />))}
      {tab === 'Replies' && (model.replies.length === 0
        ? <div className="profile-empty"><h3>No replies</h3><p className="muted">{empty.replies}</p></div>
        : model.replies.map((post) => <PostCard key={post.id} post={post} />))}
      {tab === 'Highlights' && (model.highlighted.length === 0
        ? <div className="profile-empty"><h3>No highlights yet</h3><p className="muted">{empty.highlights}</p></div>
        : model.highlighted.map((post) => <PostCard key={post.id} post={post} />))}
      {tab === 'Media' && (model.withMedia.length === 0
        ? <div className="profile-empty"><h3>No media</h3><p className="muted">{empty.media}</p></div>
        : model.withMedia.map((post) => <PostCard key={post.id} post={post} />))}
      {tab === 'Likes' && (empty.likes
        ? <div className="profile-empty"><h3>{empty.likes.title}</h3><p className="muted">{empty.likes.body}</p></div>
        : importState.likes.length === 0
          ? <div className="profile-empty"><h3>No likes</h3><p className="muted">No like.js was in what you imported.</p></div>
          : <>
              <p className="x-likes-note muted">{importState.likes.length.toLocaleString()} liked posts from your archive. X exports the text and a link, not who wrote them.</p>
              {importState.likes.slice(0, 200).map((like) => <article key={like.id} className="x-post x-like" aria-label="Liked post">
                <div className="x-post-main"><p className="x-post-text">{like.text || '(no text in the archive)'}</p>{like.url && <a className="x-like-link" href={like.url} target="_blank" rel="noreferrer">View on X</a>}</div>
              </article>)}
            </>)}
    </div>
    {editing && <HeaderStudio onDone={close} />}
    {personalizing && <MakeItYours onDone={closePersonalize} />}
    {importing && <ImportArchive onDone={closeImport} />}
  </div>
}

/** Keyed by handle so moving between profiles starts each one fresh. */
export default function Profile({ me = false }: { me?: boolean }) {
  const { handle } = useParams()
  return <ProfileView key={me ? 'imported' : handle ?? 'owner'} handle={handle} imported={me} />
}
