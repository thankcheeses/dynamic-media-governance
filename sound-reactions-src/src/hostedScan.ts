/**
 * Hosted GIFs that were not measured ahead of time are scanned in the viewer's
 * browser before they are allowed to animate: the file is fetched from its host
 * and run through the same analyzer as an upload. Nothing is stored or sent
 * anywhere; a scan is kept for the life of the tab so each GIF is measured once.
 */
import { analyzeUpload, type UploadAnalysis } from './analyze'
import type { HeaderPreset } from './headers'

const scans = new Map<string, Promise<UploadAnalysis>>()

/** Fetches the GIF behind a hosted preset as a File, the shape the analyzer takes. */
export async function fetchHostedFile(preset: HeaderPreset): Promise<File> {
  const hosted = preset.hosted
  if (!hosted?.gif) throw new Error('This header has no GIF to scan')
  const response = await fetch(hosted.gif)
  if (!response.ok) throw new Error(`${hosted.provider} answered ${response.status}`)
  const blob = await response.blob()
  return new File([blob], `${preset.id}.gif`, { type: blob.type || 'image/gif' })
}

/** Scans a hosted preset once per tab. A failed scan is forgotten so it can be retried. */
export function scanHosted(preset: HeaderPreset): Promise<UploadAnalysis> {
  let scan = scans.get(preset.id)
  if (!scan) {
    scan = fetchHostedFile(preset).then((file) => analyzeUpload(file, { source: 'giphy', sourceUrl: preset.hosted?.pageUrl }))
    scan.catch(() => scans.delete(preset.id))
    scans.set(preset.id, scan)
  }
  return scan
}
