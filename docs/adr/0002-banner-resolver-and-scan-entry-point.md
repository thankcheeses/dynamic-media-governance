# ADR 0002: One banner resolver and one header-scan entry point

**Status:** accepted · 2026-11-08

## Context

"What does this profile's header show" was rebuilt in five files from flags and field shapes. A hosted pick published from the studio was stored under the sentinel id `'upload'`, so it was lost on reload, its banner carried no "via" credit (rule 14), and a Tenor GIF was described as picked from GIPHY because every studio scan hard-coded `source: 'giphy'`. Each caller also wired load → analyze → preset → scan → audit by hand, with two audit formats and one path uncached.

## Decision

- `src/headerScan.ts` is the only way a header is scanned. It takes a `HeaderSource` (fixture, hosted, GIPHY pick, device file), owns the loader adapters, the single rule for turning a measured file into a preset (`fps` is the playback rate), the per-tab cache for hosted GIFs, and one audit line shape. Dependencies (fetch, analyzer, audit) are injectable.
- `src/banner.ts` resolves what a profile's banner shows from the account, the viewer's pick, any upload in this tab and the scan cache, and returns one tagged `Banner` carrying frames or source, decision, provenance and credit. Profile, HeaderInfo and DynamicHeader render it.
- The store's header pick is a tagged value: `{ kind: 'preset', presetId, decision, chosen }` or `{ kind: 'upload', decision }`. A hosted pick is a preset pick and persists; only file uploads are session-only.
- `UploadedMedia` states its origin (`source`, `provider`, `sourceUrl`); nothing guesses it.

## Consequences

- Provenance, credit, frame rate and persistence of a header are each decided in one place and unit-tested without a browser.
- A hosted pick chosen in the studio shows its credit and survives a reload (e2e regression in `e2e/core.spec.ts`).
- Every scan writes one audit entry, including the profile banner's hosted scans (once per preset per tab).
