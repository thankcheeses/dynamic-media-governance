/**
 * GIPHY search for dynamic headers.
 *
 * GIPHY hosts the files and licenses them for display in apps through its API,
 * which is why the prototype searches GIPHY instead of copying GIFs into the
 * repository. Results are filtered to rating "pg" and must show GIPHY
 * attribution. Picked GIFs are scanned like any upload before they can play,
 * and the grid shows still frames only.
 *
 * The API key is the viewer's own: typed into the header studio and kept in
 * this browser's localStorage. A key can also be baked into a build with
 * VITE_GIPHY_API_KEY, in which case it is visible to anyone who views the page.
 */

const STORAGE_KEY = 'sound-reactions-giphy-key'
const API = 'https://api.giphy.com/v1/gifs'

export interface GiphyGif {
  id: string
  title: string
  /** Page on giphy.com, for attribution. */
  url: string
  /** Still image for the results grid. Nothing animates before it is scanned. */
  still: string
  /** Animated GIF to scan and play: GIPHY's "downsized" rendition (under 2 MB) when present. */
  gif: string
  width: number
  height: number
}

interface GiphyImage { url?: string; width?: string; height?: string }
interface GiphyResult {
  id: string
  title?: string
  url: string
  images: Record<string, GiphyImage | undefined>
}

export function buildKey(): string {
  return (import.meta.env.VITE_GIPHY_API_KEY as string | undefined)?.trim() ?? ''
}

export function storedKey(): string {
  try { return window.localStorage.getItem(STORAGE_KEY) ?? '' } catch { return '' }
}

export function saveKey(key: string) {
  try {
    if (key) window.localStorage.setItem(STORAGE_KEY, key)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch { /* storage may be unavailable; the key then lasts for this page only */ }
}

export function activeKey(): string {
  return storedKey() || buildKey()
}

function toGif(item: GiphyResult): GiphyGif | null {
  const pick = item.images.downsized?.url ? item.images.downsized : item.images.original
  const still = item.images.fixed_width_still?.url ?? item.images.downsized_still?.url ?? item.images.original_still?.url
  if (!pick?.url || !still) return null
  return {
    id: item.id,
    title: item.title?.trim() || 'Untitled GIF',
    url: item.url,
    still,
    gif: pick.url,
    width: Number(pick.width) || 0,
    height: Number(pick.height) || 0,
  }
}

export class GiphyError extends Error {}

/** Search GIPHY, or list trending GIFs when the query is empty. */
export async function searchGiphy(query: string, key: string, signal?: AbortSignal): Promise<GiphyGif[]> {
  const params = new URLSearchParams({ api_key: key, limit: '24', rating: 'pg', lang: 'en' })
  const q = query.trim()
  if (q) params.set('q', q)
  const response = await fetch(`${API}/${q ? 'search' : 'trending'}?${params}`, { signal })
  if (response.status === 401 || response.status === 403) throw new GiphyError('GIPHY didn’t accept that API key. Check it on developers.giphy.com.')
  if (response.status === 429) throw new GiphyError('GIPHY’s rate limit was reached for this key. Try again in a little while.')
  if (!response.ok) throw new GiphyError(`GIPHY search failed (HTTP ${response.status}).`)
  const body = await response.json() as { data?: GiphyResult[] }
  return (body.data ?? []).map(toGif).filter((gif): gif is GiphyGif => gif !== null)
}

/** Download a picked GIF so it can be scanned and transcoded like an upload. */
export async function fetchGiphyFile(gif: GiphyGif): Promise<File> {
  const response = await fetch(gif.gif)
  if (!response.ok) throw new GiphyError(`Couldn’t download that GIF from GIPHY (HTTP ${response.status}).`)
  const blob = await response.blob()
  const name = `${gif.title.replace(/[^\w .-]+/g, '').slice(0, 60) || 'giphy'}.gif`
  return new File([blob], name, { type: 'image/gif' })
}
