/**
 * The one way a header gets scanned. Every caller (the header studio, the
 * profile banner) hands over a source and gets back the same shape: the preset
 * to play, the scan decision, the analysis when a file was measured, and the
 * notes. Behind this interface: which loader fetches the file, how a scan result
 * becomes a preset, the per-tab cache for hosted GIFs, and the audit entry.
 *
 * Nothing here is stored or sent anywhere: a fetched GIF lives in memory for the
 * life of the tab and a failed fetch is forgotten so it can be retried.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { analyzeUpload, type MediaOrigin, type UploadAnalysis, type UploadedMedia } from './analyze'
import { fetchGiphyFile, type GiphyGif } from './giphy'
import { scanHeader, type HeaderPreset, type HeaderScan } from './headers'

export type HeaderSource =
  /** A sample with fixture numbers: scanned from its declared values, no file involved. */
  | { kind: 'fixture'; preset: HeaderPreset }
  /** A hosted GIF (GIPHY or Tenor) fetched and measured in the browser. */
  | { kind: 'hosted'; preset: HeaderPreset }
  /** A GIF picked in the GIPHY panel. */
  | { kind: 'giphy'; gif: GiphyGif }
  /** A file picked from the device. */
  | { kind: 'device'; file: File }

export interface ScannedHeader {
  /** The preset to play. For a measured file its numbers are the measured ones and `fps` is the playback rate. */
  preset: HeaderPreset
  scan: HeaderScan
  /** The decoded frames and poster, when a file was measured; null for a fixture. */
  analysis: UploadAnalysis | null
  notes: string[]
}

export interface ScanDeps {
  analyze: (file: File, origin?: MediaOrigin) => Promise<UploadAnalysis>
  fetch: typeof fetch
  audit: (type: string, subjectId: string, detail: string) => void
  /** Simulated scan time for fixture samples, so the studio can show the framework's 10–20 s budget. */
  fixtureDelayMs: number
}

/** The id a synthetic preset gets when it describes a file rather than a sample. */
export const UPLOAD_PRESET_ID = 'upload'

/** How the audit log names a scan's subject. */
export function scanSubject(source: HeaderSource): string {
  switch (source.kind) {
    case 'fixture': return source.preset.id
    case 'hosted': return `hosted:${source.preset.id}`
    case 'giphy': return `giphy:${source.gif.id}`
    case 'device': return UPLOAD_PRESET_ID
  }
}

/** Where a source's file comes from, as the player and the ⓘ panel state it. */
export function originOf(source: HeaderSource): MediaOrigin | undefined {
  switch (source.kind) {
    case 'hosted': return { source: 'hosted', provider: source.preset.hosted?.provider, sourceUrl: source.preset.hosted?.pageUrl }
    case 'giphy': return { source: 'giphy', provider: 'GIPHY', sourceUrl: source.gif.url }
    case 'device': return { source: 'device' }
    case 'fixture': return undefined
  }
}

/**
 * The one rule for turning a measured file into a preset: the measured numbers
 * replace the declared ones and `fps` is the rate the player will use (the
 * native rate capped at the framework limit), so the status line, the ⓘ panel
 * and the player agree.
 */
export function presetFromMedia(base: Pick<HeaderPreset, 'id' | 'name' | 'description' | 'hosted'>, media: Pick<UploadedMedia, 'measurement' | 'frameMs'>): HeaderPreset {
  return {
    ...base,
    style: base.hosted ? 'video' : 'upload',
    ...media.measurement,
    fps: Math.round(1000 / media.frameMs),
    measured: true,
    scanInBrowser: false,
  }
}

export const presetFromAnalysis = (base: Pick<HeaderPreset, 'id' | 'name' | 'description' | 'hosted'>, analysis: UploadAnalysis) => presetFromMedia(base, analysis.media)

/** The synthetic preset for a file scanned in this tab. */
export const uploadPreset = (media: Pick<UploadedMedia, 'name' | 'measurement' | 'frameMs'>) =>
  presetFromMedia({ id: UPLOAD_PRESET_ID, name: media.name, description: `Uploaded header: ${media.name}`, hosted: undefined }, media)

async function fetchFile(fetchImpl: typeof fetch, url: string, name: string, type: string, who: string): Promise<File> {
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`${who} answered ${response.status}`)
  const blob = await response.blob()
  return new File([blob], name, { type: blob.type || type })
}

/** The loader adapters: device file, GIPHY pick, hosted GIF. Fixtures load nothing. */
async function load(source: HeaderSource, deps: ScanDeps): Promise<File> {
  switch (source.kind) {
    case 'device': return source.file
    case 'giphy': return fetchGiphyFile(source.gif, deps.fetch)
    case 'hosted': {
      const hosted = source.preset.hosted
      if (!hosted?.gif) throw new Error('This header has no GIF to scan')
      return fetchFile(deps.fetch, hosted.gif, `${source.preset.id}.gif`, 'image/gif', hosted.provider)
    }
    case 'fixture': throw new Error('A fixture sample has no file')
  }
}

const defaultDeps = (): ScanDeps => ({ analyze: analyzeUpload, fetch: (...args) => fetch(...args), audit: () => undefined, fixtureDelayMs: 0 })

const auditLine = (preset: HeaderPreset, scan: HeaderScan, fixture: boolean) =>
  `${preset.name}: ${scan.decision}. ${preset.flashesPerSecond} flashes/s, ${preset.redFlashesPerSecond} red/s, ${preset.fps} fps, ${preset.loopSeconds} s, ${preset.sizeMB} MB${fixture ? ' (fixture values)' : ''}`

/** Scans one source. Not cached: see `scanHosted` for the per-tab cache hosted GIFs use. */
export async function scanSource(source: HeaderSource, overrides: Partial<ScanDeps> = {}): Promise<ScannedHeader> {
  const deps = { ...defaultDeps(), ...overrides }
  if (source.kind === 'fixture') {
    if (deps.fixtureDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, deps.fixtureDelayMs))
    const scan = scanHeader(source.preset)
    deps.audit('header_scanned', scanSubject(source), auditLine(source.preset, scan, true))
    return { preset: source.preset, scan, analysis: null, notes: [] }
  }
  const file = await load(source, deps)
  const analysis = await deps.analyze(file, originOf(source))
  const preset = source.kind === 'hosted' ? presetFromAnalysis(source.preset, analysis) : uploadPreset(analysis.media)
  const scan = scanHeader(preset)
  deps.audit('header_scanned', scanSubject(source), auditLine(preset, scan, false))
  return { preset, scan, analysis, notes: analysis.notes }
}

/* ---------- Per-tab cache for hosted GIFs, observable from React ---------- */

export type HostedScanState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'done'; result: ScannedHeader }
  | { status: 'failed'; error: string }

const cache = new Map<string, Promise<ScannedHeader>>()
const states = new Map<string, HostedScanState>()
const listeners = new Set<() => void>()
const IDLE: HostedScanState = { status: 'idle' }
let version = 0

function setState(id: string, state: HostedScanState) {
  states.set(id, state)
  version++
  listeners.forEach((listener) => listener())
}

/**
 * Scans a hosted preset once per tab and remembers the result. A failed scan is
 * forgotten so the next caller retries. The studio and the profile banner share
 * this, so a GIF picked in the studio is not fetched again when it goes live.
 */
export function scanHosted(preset: HeaderPreset, overrides: Partial<ScanDeps> = {}): Promise<ScannedHeader> {
  let scan = cache.get(preset.id)
  if (!scan) {
    setState(preset.id, { status: 'pending' })
    scan = scanSource({ kind: 'hosted', preset }, overrides)
    scan.then(
      (result) => setState(preset.id, { status: 'done', result }),
      (err: unknown) => { cache.delete(preset.id); setState(preset.id, { status: 'failed', error: err instanceof Error ? err.message : 'the scan failed' }) },
    )
    cache.set(preset.id, scan)
  }
  return scan
}

export function hostedScanState(presetId: string): HostedScanState { return states.get(presetId) ?? IDLE }
export function subscribeHostedScans(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener) }

/** Test seam: forget every cached scan. */
export function resetHostedScans() { cache.clear(); states.clear(); version++; listeners.forEach((listener) => listener()) }

/** Re-renders the caller whenever any hosted scan changes state; read states with `hostedScanState`. */
export function useHostedScanStates(): typeof hostedScanState {
  useSyncExternalStore(subscribeHostedScans, () => version, () => version)
  return hostedScanState
}

/** The scan state of a hosted preset, starting the scan on first use. */
export function useHostedScan(preset: HeaderPreset | null, overrides?: Partial<ScanDeps>): HostedScanState {
  const state = useSyncExternalStore(subscribeHostedScans, () => (preset ? hostedScanState(preset.id) : IDLE), () => IDLE)
  const idle = state.status === 'idle'
  useEffect(() => { if (preset && idle) void scanHosted(preset, overrides).catch(() => undefined) }, [preset, idle, overrides])
  return state
}
