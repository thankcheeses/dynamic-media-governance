import { useRef, useState, type ChangeEvent } from 'react'
import { FolderArchive, Loader2, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { importArchive } from '../archive'
import { useImport } from '../importStore'
import { Modal } from './Modal'

const fmtMB = (bytes: number) => `${(bytes / 1048576).toFixed(bytes > 100 * 1048576 ? 0 : 1)} MB`

/**
 * "Preview with your X archive": the person picks the zip X sent them (or the
 * files from its data folder) and the prototype reads it right here. No
 * upload, no account, no network. The explainer doubles as the consent text.
 */
export function ImportArchive({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const apply = useImport((state) => state.apply)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    setBusy(true); setError(''); setProgress(0)
    try {
      const result = await importArchive(files, setProgress)
      apply(result)
      toast.success(`Welcome, ${result.account.name}. This preview stays on this device.`)
      onDone()
      navigate('/me')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The archive could not be read')
    } finally {
      setBusy(false)
    }
  }

  return <Modal title="Preview with your X archive" onClose={onDone}>
    <div className="import-archive">
      <p>See your own profile and posts in this prototype, with a moving banner and sound reactions. It uses the data download X gives you, read <strong>on this device</strong>.</p>
      <ol className="import-steps">
        <li>On X: <strong>Settings → Your account → Download an archive of your data</strong>. X emails you when the zip is ready (it can take a day).</li>
        <li>Come back here and pick that zip. On a phone, pick it from your Files or Downloads.</li>
      </ol>
      <div className="import-privacy"><ShieldCheck size={18} aria-hidden="true" /><div>
        <strong>What happens to it</strong>
        <ul>
          <li>The zip is read in your browser. Nothing is uploaded; there is no account and no server.</li>
          <li>Only your profile, posts, likes and the images inside the zip are used. Your email, messages, contacts and everything else in the archive are never read.</li>
          <li>It is kept in memory only. Closing the tab, reloading, or <strong>Clear my import</strong> removes it.</li>
          <li>Nothing you do here posts to X or changes your X account. <Link to="/privacy" onClick={onDone}>Privacy notice</Link>.</li>
        </ul>
      </div></div>
      <input ref={inputRef} type="file" accept=".zip,.js,image/*" multiple className="sr-only" onChange={(event) => void pick(event)} data-testid="archive-files" disabled={busy} />
      <div className="button-row">
        <button type="button" className="x-follow-cta" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <><Loader2 size={16} className="spin" aria-hidden="true" /> Reading{progress ? ` ${fmtMB(progress)}` : ''}…</> : <><FolderArchive size={16} aria-hidden="true" /> Pick my archive zip</>}
        </button>
        <button type="button" className="x-outline-pill" onClick={onDone} disabled={busy}>Not now</button>
      </div>
      <p className="fine-print">Large archives take a moment; videos are skipped and only the newest 2,000 posts are shown. You can also pick the files from the zip’s <code>data</code> folder (account.js, profile.js, tweets.js, like.js) and any images from its media folders.</p>
      {error && <p className="import-error" role="alert">{error}</p>}
    </div>
  </Modal>
}
