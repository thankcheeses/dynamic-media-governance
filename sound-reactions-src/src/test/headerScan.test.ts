import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UploadAnalysis } from '../analyze'
import { creditOf, provenanceOf, resolveBanner, DEFAULT_PICK } from '../banner'
import { DEFAULT_HEADER_ID, HEADER_PRESETS, headerPreset } from '../headers'
import { hostedScanState, presetFromMedia, resetHostedScans, scanHosted, scanSource, scanSubject, originOf, uploadPreset } from '../headerScan'

const analysis = (name: string, nativeFps: number, patch: Partial<UploadAnalysis['measurement']> = {}): UploadAnalysis => {
  const measurement = { fps: nativeFps, loopSeconds: 4, sizeMB: 1.2, flashesPerSecond: 1, redFlashesPerSecond: 0, flashArea: 0.1, ...patch }
  return { measurement, media: { name, measurement, kind: 'gif', frames: [], frameMs: 1000 / Math.min(15, nativeFps), poster: 'data:,' }, notes: nativeFps > 15 ? [`Your GIF runs at ${nativeFps} fps; the header plays it at 15 fps.`] : [] }
}
const calm = (name: string, nativeFps = 24) => analysis(name, nativeFps)
const strobe = (name: string) => analysis(name, 24, { flashesPerSecond: 12, flashArea: 1 })
const gif = (id: string) => ({ id, title: 'Pick', url: `https://giphy.com/gifs/${id}`, still: 's', gif: `https://media.giphy.com/${id}.gif`, width: 480, height: 270 })

const okFetch = (() => Promise.resolve(new Response(new Blob(['gif'], { type: 'image/gif' }), { status: 200 }))) as typeof fetch
const tenor = HEADER_PRESETS.find((p) => p.hosted?.provider === 'Tenor')!
const giphyPreset = HEADER_PRESETS.find((p) => p.hosted?.provider === 'GIPHY' && p.scanInBrowser)!

afterEach(() => resetHostedScans())

describe('one header-scan entry point', () => {
  it('scans a hosted Tenor pick, keeps its identity and states Tenor provenance', async () => {
    const analyze = vi.fn(async (_file: File, origin?: unknown) => ({ ...calm('x'), media: { ...calm('x').media, ...(origin as object) } }))
    const audit = vi.fn()
    const result = await scanSource({ kind: 'hosted', preset: tenor }, { fetch: okFetch, analyze, audit })
    expect(analyze.mock.calls[0][1]).toEqual({ source: 'hosted', provider: 'Tenor', sourceUrl: tenor.hosted!.pageUrl })
    expect(result.preset.id).toBe(tenor.id)
    expect(result.preset.hosted?.provider).toBe('Tenor')
    expect(result.scan.decision).toBe('PASS')
    expect(audit).toHaveBeenCalledWith('header_scanned', `hosted:${tenor.id}`, expect.stringMatching(/PASS\. 1 flashes\/s, 0 red\/s, 15 fps/))
  })

  it('plays a measured file at the capped rate, in the player, the status and the ⓘ panel alike', () => {
    const preset = presetFromMedia(tenor, calm('x', 24).media)
    expect(preset.fps).toBe(15)
    expect(uploadPreset(calm('clip.gif', 10).media).fps).toBe(10)
  })

  it('writes the same audit shape for a fixture, a device file and a GIPHY pick', async () => {
    const audit = vi.fn()
    const analyze = vi.fn(async () => calm('pick.gif'))
    await scanSource({ kind: 'fixture', preset: headerPreset('strobe') }, { audit })
    await scanSource({ kind: 'device', file: new File([''], 'mine.gif', { type: 'image/gif' }) }, { audit, analyze })
    await scanSource({ kind: 'giphy', gif: gif('abc') }, { audit, analyze, fetch: okFetch })
    const lines = audit.mock.calls.map(([type, subject, detail]) => `${type} ${subject} ${detail}`)
    expect(lines[0]).toMatch(/^header_scanned strobe Strobe party: BLOCK\. 12 flashes\/s, 0 red\/s, 15 fps, 4 s, 2\.6 MB \(fixture values\)$/)
    expect(lines[1]).toMatch(/^header_scanned upload pick\.gif: PASS\. 1 flashes\/s, 0 red\/s, 15 fps, 4 s, 1\.2 MB$/)
    expect(lines[2]).toMatch(/^header_scanned giphy:abc pick\.gif: PASS\./)
  })

  it('names subjects and origins per source', () => {
    expect(scanSubject({ kind: 'hosted', preset: tenor })).toBe(`hosted:${tenor.id}`)
    expect(originOf({ kind: 'giphy', gif: gif('g') })).toEqual({ source: 'giphy', provider: 'GIPHY', sourceUrl: 'https://giphy.com/gifs/g' })
    expect(originOf({ kind: 'device', file: new File([''], 'a.gif') })).toEqual({ source: 'device' })
  })

  it('caches a hosted scan per tab and forgets a failed one so it can be retried', async () => {
    const analyze = vi.fn(async () => calm('x'))
    const failing = (() => Promise.resolve(new Response('', { status: 503 }))) as typeof fetch
    await expect(scanHosted(giphyPreset, { fetch: failing, analyze })).rejects.toThrow('GIPHY answered 503')
    expect(hostedScanState(giphyPreset.id)).toEqual({ status: 'failed', error: 'GIPHY answered 503' })
    const first = await scanHosted(giphyPreset, { fetch: okFetch, analyze })
    const second = await scanHosted(giphyPreset, { fetch: failing, analyze })
    expect(second).toBe(first)
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(hostedScanState(giphyPreset.id).status).toBe('done')
  })
})

describe('banner resolver', () => {
  const idle = () => ({ status: 'idle' as const })
  const owner = { handle: '@baynardmalone', headerId: null }

  it('shows a fictional account’s hosted header as still while the scan runs, then plays it with its credit', async () => {
    const account = { handle: '@theotypes', headerId: tenor.id }
    const scanning = resolveBanner({ account, mine: false, isImported: false, pick: DEFAULT_PICK, uploadedHeader: null, hostedScan: idle })
    expect(scanning).toMatchObject({ kind: 'scanning', credit: { provider: 'Tenor' } })
    const result = await scanSource({ kind: 'hosted', preset: tenor }, { fetch: okFetch, analyze: async () => calm('x') })
    const playing = resolveBanner({ account, mine: false, isImported: false, pick: DEFAULT_PICK, uploadedHeader: null, hostedScan: () => ({ status: 'done', result }) })
    expect(playing).toMatchObject({ kind: 'playable', decision: 'PASS', credit: { provider: 'Tenor', pageUrl: tenor.hosted!.pageUrl }, provenance: { kind: 'hosted', provider: 'Tenor' } })
  })

  it('keeps a blocked hosted header as a still frame', async () => {
    const result = await scanSource({ kind: 'hosted', preset: tenor }, { fetch: okFetch, analyze: async () => strobe('x') })
    const banner = resolveBanner({ account: { handle: '@theotypes', headerId: tenor.id }, mine: false, isImported: false, pick: DEFAULT_PICK, uploadedHeader: null, hostedScan: () => ({ status: 'done', result }) })
    expect(banner.kind).toBe('blocked')
  })

  it('an owner’s hosted pick keeps its identity: the pick is a preset id, so it survives persistence', () => {
    const pick = { kind: 'preset' as const, presetId: tenor.id, decision: 'PASS' as const, chosen: true }
    const banner = resolveBanner({ account: owner, mine: true, isImported: false, pick, uploadedHeader: null, hostedScan: idle })
    expect(banner).toMatchObject({ kind: 'scanning', preset: { id: tenor.id } })
  })

  it('a GIPHY pick published from the studio carries a GIPHY credit and GIPHY provenance', () => {
    const media = { ...calm('pick.gif').media, source: 'giphy' as const, provider: 'GIPHY' as const, sourceUrl: 'https://giphy.com/gifs/abc' }
    const banner = resolveBanner({ account: owner, mine: true, isImported: false, pick: { kind: 'upload', decision: 'PASS' }, uploadedHeader: media, hostedScan: idle })
    expect(banner).toMatchObject({ kind: 'playable', credit: { provider: 'GIPHY', pageUrl: 'https://giphy.com/gifs/abc' }, provenance: { kind: 'giphy-pick' }, preset: { fps: 15 } })
  })

  it('an upload pick with no frames left (after a reload) falls back to the default preset', () => {
    const banner = resolveBanner({ account: owner, mine: true, isImported: false, pick: { kind: 'upload', decision: 'PASS' }, uploadedHeader: null, hostedScan: idle })
    expect(banner).toMatchObject({ kind: 'scanning', preset: { id: DEFAULT_HEADER_ID } })
  })

  it('an imported account shows its archive still until the viewer explicitly picks a banner', () => {
    const account = { handle: '@me', headerId: null, headerStill: 'blob:still' }
    expect(resolveBanner({ account, mine: true, isImported: true, pick: DEFAULT_PICK, uploadedHeader: null, hostedScan: idle })).toEqual({ kind: 'archive-still', src: 'blob:still' })
    const chosenDefault = { ...DEFAULT_PICK, chosen: true }
    expect(resolveBanner({ account, mine: true, isImported: true, pick: chosenDefault, uploadedHeader: null, hostedScan: idle }).kind).toBe('scanning')
  })

  it('states provenance from the preset and the media, not from which fields happen to be set', () => {
    expect(provenanceOf(headerPreset('strobe'), null)).toEqual({ kind: 'fixture' })
    expect(provenanceOf(headerPreset('neon-cats'), null).kind).toBe('owner-file')
    expect(creditOf(headerPreset('strobe'), null)).toBeNull()
    expect(creditOf(tenor, null)).toEqual({ provider: 'Tenor', pageUrl: tenor.hosted!.pageUrl })
  })
})
