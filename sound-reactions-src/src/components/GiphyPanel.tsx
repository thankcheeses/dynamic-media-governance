import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, Search } from 'lucide-react'
import { activeKey, buildKey, saveKey, searchGiphy, storedKey, type GiphyGif } from '../giphy'

/**
 * GIPHY search inside the header studio. Results show still frames only:
 * a GIF animates on the profile only after it has been scanned and passed.
 */
export function GiphyPanel({ onPick, disabled }: { onPick: (gif: GiphyGif) => void; disabled: boolean }) {
  const [key, setKey] = useState(activeKey)
  const [draftKey, setDraftKey] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GiphyGif[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  const run = async (q: string, withKey = key) => {
    controller.current?.abort()
    const abort = new AbortController(); controller.current = abort
    setLoading(true); setError('')
    try {
      setResults(await searchGiphy(q, withKey, abort.signal))
      setSearched(q.trim() || 'Trending')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(err instanceof Error ? err.message : 'GIPHY search failed')
    } finally {
      if (controller.current === abort) setLoading(false)
    }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void run(query) }
  const saveDraft = (event: FormEvent) => {
    event.preventDefault()
    const next = draftKey.trim()
    if (!next) return
    saveKey(next); setKey(next); setDraftKey('')
    void run('', next)
  }
  const forget = () => { saveKey(''); setKey(buildKey()); setResults([]); setSearched('') }

  return <section className="giphy-panel" aria-labelledby="giphy-title">
    <div className="giphy-head">
      <h3 id="giphy-title" className="studio-subhead">Search GIPHY</h3>
      <a className="giphy-attribution" href="https://giphy.com" target="_blank" rel="noreferrer">Powered by GIPHY</a>
    </div>
    {!key ? <form className="giphy-key" onSubmit={saveDraft}>
      <p className="fine-print">Add your GIPHY API key to search. It is saved only in this browser. Get a free key at <a href="https://developers.giphy.com/dashboard/" target="_blank" rel="noreferrer">developers.giphy.com</a>.</p>
      <div className="giphy-row">
        <input type="password" autoComplete="off" spellCheck={false} aria-label="GIPHY API key" placeholder="GIPHY API key" value={draftKey} onChange={(event) => setDraftKey(event.target.value)} />
        <button type="submit" className="x-outline-pill" disabled={!draftKey.trim()}>Save key</button>
      </div>
    </form> : <>
      <form className="giphy-row" onSubmit={submit} role="search">
        <span className="giphy-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search GIPHY" placeholder="Search GIFs, or leave empty for trending" value={query} onChange={(event) => setQuery(event.target.value)} /></span>
        <button type="submit" className="x-outline-pill" disabled={loading}>{loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : 'Search'}</button>
      </form>
      <p className="fine-print">Rated PG. Results are still frames; a GIF plays only after it passes the scan.{storedKey() && <> <button type="button" className="text-button" onClick={forget}>Remove saved key</button></>}</p>
    </>}
    <div aria-live="polite">
      {error && <p className="scan-blocked" role="alert">{error}</p>}
      {searched && !error && <p className="sr-only">{results.length} results for {searched}</p>}
    </div>
    {results.length > 0 && <div className="giphy-grid">
      {results.map((gif) => <button key={gif.id} type="button" className="giphy-item" disabled={disabled} onClick={() => onPick(gif)} aria-label={`Scan ${gif.title}`}>
        <img src={gif.still} alt="" loading="lazy" decoding="async" />
      </button>)}
    </div>}
  </section>
}
