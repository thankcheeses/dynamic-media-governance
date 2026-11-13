/**
 * What a profile's banner shows. One resolver answers it for every profile: the
 * owner demo, a visitor's imported archive, and the fictional accounts. It takes
 * the account, the viewer's header pick, any header scanned in this tab and the
 * hosted-scan cache, and returns one tagged value that Profile, HeaderInfo and
 * DynamicHeader render without re-deriving anything.
 *
 * Provenance and the credit link are stated here, never inferred from which
 * fields happen to be set.
 */
import type { UploadedMedia } from './analyze'
import type { HeaderDecision, HeaderPreset } from './headers'
import { DEFAULT_HEADER_ID, headerPreset, isPublishable } from './headers'
import { uploadPreset, type HostedScanState } from './headerScan'

/** The viewer's live header pick, as the store keeps it. */
export type HeaderPick =
  /** A preset by id. `chosen` is false until the viewer publishes something from the studio. */
  | { kind: 'preset'; presetId: string; decision: HeaderDecision; chosen: boolean }
  /** A file scanned in this tab (device or GIPHY). The frames live in `uploadedHeader`, never in storage. */
  | { kind: 'upload'; decision: HeaderDecision }

export interface Credit { provider: 'GIPHY' | 'Tenor'; pageUrl: string }

export type Provenance =
  | { kind: 'fixture' }
  | { kind: 'rendered' }
  | { kind: 'owner-file' }
  | { kind: 'device' }
  | { kind: 'giphy-pick'; pageUrl?: string }
  | { kind: 'hosted'; provider: 'GIPHY' | 'Tenor'; pageUrl: string }

export type Banner =
  | { kind: 'none' }
  | { kind: 'archive-still'; src: string }
  | { kind: 'scanning'; preset: HeaderPreset; still?: string; credit: Credit }
  | { kind: 'blocked'; preset: HeaderPreset; still?: string; credit: Credit; reason: string }
  | { kind: 'failed'; preset: HeaderPreset; still?: string; credit: Credit; reason: string }
  | {
      kind: 'playable'
      preset: HeaderPreset
      decision: HeaderDecision
      /** Measured frames to play, when the header was scanned in this tab; null when the preset plays itself. */
      upload: UploadedMedia | null
      provenance: Provenance
      /** The "via" link rule 14 requires for anything that plays from a host. */
      credit: Credit | null
      /** Changes whenever the player must restart from scratch. */
      key: string
    }

export interface BannerInput {
  /** The profile's own header, for accounts that are not the viewer's. */
  account: { handle: string; headerId: string | null; headerDecision?: HeaderDecision; headerStill?: string }
  /** The viewer's own profile: the owner demo or their imported archive. Both use the viewer's pick. */
  mine: boolean
  isImported: boolean
  pick: HeaderPick
  uploadedHeader: UploadedMedia | null
  /** The hosted-scan cache, looked up by preset id. */
  hostedScan: (presetId: string) => HostedScanState
}

export function creditOf(preset: HeaderPreset, upload: UploadedMedia | null): Credit | null {
  if (preset.hosted) return { provider: preset.hosted.provider, pageUrl: preset.hosted.pageUrl }
  if (upload?.source === 'giphy' && upload.sourceUrl) return { provider: 'GIPHY', pageUrl: upload.sourceUrl }
  return null
}

export function provenanceOf(preset: HeaderPreset, upload: UploadedMedia | null): Provenance {
  if (preset.hosted) return { kind: 'hosted', provider: preset.hosted.provider, pageUrl: preset.hosted.pageUrl }
  if (upload?.source === 'giphy') return { kind: 'giphy-pick', pageUrl: upload.sourceUrl }
  if (upload) return { kind: 'device' }
  if (preset.ownerFile) return { kind: 'owner-file' }
  if (preset.media) return { kind: 'rendered' }
  return { kind: 'fixture' }
}

/** Plain-language provenance for the ⓘ panel. */
export function provenanceLabel(p: Provenance): string {
  switch (p.kind) {
    case 'hosted': return `A GIF playing from ${p.provider}, fetched and scanned in your browser before it was allowed to play`
    case 'giphy-pick': return 'A GIF picked from GIPHY, scanned in your browser before it was allowed to play'
    case 'device': return 'A file uploaded in this browser and scanned here'
    case 'owner-file': return 'The owner’s own GIF, kept in the repository at the owner’s request'
    case 'rendered': return 'A GIF rendered with three.js for this prototype'
    case 'fixture': return 'A sample header with fixture values'
  }
}

/** Whether the numbers behind a banner were measured from the file or set as fixtures. */
export const isMeasured = (p: Provenance) => p.kind !== 'fixture'

function hostedBanner(preset: HeaderPreset, scan: HostedScanState): Banner {
  const credit = creditOf(preset, null)!
  const still = preset.hosted?.still
  if (scan.status === 'failed') return { kind: 'failed', preset, still, credit, reason: scan.error }
  if (scan.status !== 'done') return { kind: 'scanning', preset, still, credit }
  const { result } = scan
  if (!isPublishable(result.scan.decision)) return { kind: 'blocked', preset, still, credit, reason: 'Blocked by the scan' }
  return { kind: 'playable', preset: result.preset, decision: result.scan.decision, upload: result.analysis?.media ?? null, provenance: provenanceOf(result.preset, null), credit, key: `${preset.id}-${result.scan.decision}` }
}

function presetBanner(preset: HeaderPreset, decision: HeaderDecision, hostedScan: BannerInput['hostedScan']): Banner {
  if (preset.scanInBrowser) return hostedBanner(preset, hostedScan(preset.id))
  return { kind: 'playable', preset, decision, upload: null, provenance: provenanceOf(preset, null), credit: creditOf(preset, null), key: `${preset.id}-${decision}` }
}

export function resolveBanner(input: BannerInput): Banner {
  const { account, mine, isImported, pick, uploadedHeader, hostedScan } = input
  if (!mine) {
    if (!account.headerId) return { kind: 'none' }
    return presetBanner(headerPreset(account.headerId), account.headerDecision ?? 'PASS', hostedScan)
  }
  if (pick.kind === 'upload') {
    if (!uploadedHeader) {
      // The frames were never persisted (a reload, or a cleared tab): fall back to the default preset.
      return presetBanner(headerPreset(DEFAULT_HEADER_ID), 'PASS', hostedScan)
    }
    const preset = uploadPreset(uploadedHeader)
    return { kind: 'playable', preset, decision: pick.decision, upload: uploadedHeader, provenance: provenanceOf(preset, uploadedHeader), credit: creditOf(preset, uploadedHeader), key: `upload-${pick.decision}` }
  }
  // Until the viewer picks a banner, their imported profile shows the still header image from the archive.
  if (isImported && !pick.chosen && account.headerStill) return { kind: 'archive-still', src: account.headerStill }
  return presetBanner(headerPreset(pick.presetId), pick.decision, hostedScan)
}

/** The pick a fresh store starts with: the default preset, not yet chosen by the viewer. */
export const DEFAULT_PICK: HeaderPick = { kind: 'preset', presetId: DEFAULT_HEADER_ID, decision: 'PASS', chosen: false }
