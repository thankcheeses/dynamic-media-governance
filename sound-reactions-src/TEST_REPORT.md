# Test Report — Sound Reactions Concept

**Final verification date:** October 25, 2026  
**Build tested:** production Vite build served at `127.0.0.1:4173`

## Results

| Check | Actual result |
|---|---|
| ESLint | Passed with no errors |
| Strict TypeScript (`tsc -b --pretty false`) | Passed |
| Unit/component tests | **11/11 passed** in 2 files |
| Production build | Passed; 1,734 modules transformed |
| Production JS | 331.01 KB (99.19 KB gzip) |
| Production CSS | 43.78 KB (9.09 KB gzip) |
| Playwright browser tests | **32/32 passed**, 0 skipped, 0 flaky, 0 unexpected |
| Browser matrix | Chromium + WebKit; desktop 1280×900 + mobile 390×844 |
| Captures | **16 PNGs** across 8 requested views and 2 form factors |
| Captured console errors | **0** |
| Captured HTTP errors (status ≥400) | **0** |
| Horizontal page overflow in captures | **0** |
| axe on captured views | **0 serious/critical violations** |
| Lighthouse production accessibility | **100**; no non-passing audits in the accessibility category |
| Production dependency audit | **0 known vulnerabilities** |
| Full dependency audit | **32 development-only findings** (22 moderate, 10 high), primarily transitive Lighthouse/Puppeteer and Tailwind/PostCSS toolchain findings; none critical |

The full audit findings are not represented as fixed. `npm audit fix --force` proposed breaking tool downgrades/upgrades and was not applied. Production dependencies audit clean; development-only findings remain visible here.

## Required browser scenarios

Each scenario ran in all four browser/device projects:

1. Load and full-page scroll create no audio element playback or `AudioContext`.
2. Starting clip B stops clip A; repeated library sounds retain distinct instance state.
3. Voice post and reaction controls expose distinct accessible names.
4. Changing the duration threshold flips the preflight decision.
5. Reaction reporting writes report and decision audit events; playback start is also audited.
6. Approving a held submission publishes it into the local feed.
7. Presentation slides navigate by keyboard.
8. Feed axe scan has no serious/critical violations.

Unit tests cover harmless pass, missing transcript, 12-second duration block, threshold flips, policy overrides, voice limits, AI labels, prior-hour rate limiting, simulated detector labels, distinct player names and visible text alternatives.

## Visual and runtime review

Desktop/mobile screenshots were regenerated from the final production build and inspected as a complete contact sheet. The banner, three-column desktop shell, mobile navigation, composer, comparison, dashboard, audit, settings, slides and reaction picker render without blank regions or page-level horizontal overflow. The dashboard’s intentionally scrollable decision table is keyboard-focusable and named.

Evidence files:

- `test-results/playwright.json`
- `test-results/capture-report.json`
- `test-results/lighthouse.json`
- `screenshots/*.png`

## Scope and limitations

- Automated accessibility checks are necessary but not sufficient. No claim of full WCAG conformance is made.
- Manual screen-reader, switch-control, zoom/reflow, hearing/user-comprehension and photosensitivity evaluation remain open.
- Real microphone denial/unavailability behavior depends on browser/device permissions; the UI includes an explicit simulated fallback.
- Loudness/true peak are approximations, not measured or certified.
- Abuse/copyright checks are fixture simulations; no real AI or fingerprint service ran.
- All persistence is browser-local; no cross-device or backend behavior was tested or claimed.
- Static hosting needs SPA fallback for direct deep links; normal navigation from `/` is covered by the tests.

## Takeover verification — 2026-10-24 (Claude Code)

Independent re-run in a fresh Linux environment (Node 22.23.4), after the changes below.

| Check | Result |
| --- | --- |
| `npm ci` | Failed as shipped: lockfile resolved all 458 packages to a private mirror (`npm.mirrors.msh.team`) returning HTTP 502. Passed after repointing to `registry.npmjs.org` (integrity hashes unchanged). |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run test` | 11/11 pass |
| `npm run build` | Pass |
| `npm run test:e2e` | 32/32 pass (Chromium + WebKit, desktop + mobile) |

Changes made:
- `package-lock.json`: public registry URLs (no version changes).
- `src/audio.ts`: mid-clip volume changes now apply the same synth headroom factor (0.34) used at playback start; previously a volume change made synthesized clips about 3x louder.
- Persona display name corrected to "B. Baynard-Malone" (initials BB), her social-media name; handle `@baynardmalone` unchanged.
- `src/main.tsx`: optional `VITE_HASH_ROUTER=1` build flag for static hosts without SPA fallback. Default build still uses BrowserRouter.

Not re-run in this pass: Lighthouse, `npm run capture` screenshots/axe scan. Screenshots still show the old persona name.

## X-style redesign — 2026-10-24 (Claude Code)

Changes: X-style three-column shell (`src/x.css`, new `x-*` classes; retired shell rules removed from `src/index.css`), compact sound-reaction pill, voice-post media card, reaction picker sheet, filtering topic tabs, local search, verified badges (generic icon, fictional accounts), quote posts, per-post menu with local mute + undo, five more fictional posts. Motion via anime.js 4.2.2 in `src/motion.ts` (like pop and burst, rolling counts, staggered picker tiles and new posts, dialog rise), all skipped under OS or in-app reduced motion. localStorage key bumped to `sound-reactions-demo-v2` so stale v1 feeds are not shown.

Bugs found and fixed during this pass:
- Mobile: the post action row overflowed a 390 px screen, widening the layout viewport to 442 px. Tightened on small screens; verified no element extends past the screen.
- Modal re-ran its mount effect on every parent render (inline `onClose`), replaying the entrance and moving focus. Now runs once.
- Unit test caught a regression where the reaction description hid when captions were on (invariant 6). Description is now always visible; caption shows beneath it.
- axe flagged WCAG 2.5.8 target size on right-column footer links. Raised to 24 px.

| Check | Result |
| --- | --- |
| `npm run lint` / `npm run typecheck` | Pass |
| `npm run test` | 11/11 pass |
| `npm run build` | Pass |
| `npm run test:e2e` | 32/32 pass (Chromium + WebKit, desktop + mobile, incl. axe scan) |
| Manual screenshots (1280×900, 390×844) | No horizontal overflow, no console errors |

Not re-run: Lighthouse, `npm run capture`; `screenshots/` folder predates this redesign.

## ElevenLabs integration + 18-sound soundboard — 2026-10-29 (Claude Code)

- ElevenLabs SDK `@elevenlabs/elevenlabs-js` 2.75.0 (devDependency, build-time only). `scripts/generate-audio.mjs` generates sounds and the voice post, levels them with ffmpeg `loudnorm`, and writes measured duration, size, integrated loudness and true peak to `src/audio-manifest.json`. Key is read from `.env.local` via `node --env-file`; `.env*` is git-ignored, not bundled (Vite exposes only `VITE_` vars; verified the build output contains no key), and excluded from the handoff zip.
- `onboard check`: pass (key valid, SDK declared and imported).
- **Generation not yet run:** ElevenLabs returned `payment_issue` (account status `past_due`). No clips were generated or charged. Until then every sound uses the in-browser synthesizer; the app switches to generated files automatically once the manifest lists them.
- Soundboard: 18 sounds in 5 categories, search, favorites (persisted), "Surprise me" (selects, never plays). Previews play only for the picker.
- Bug fixed: persistence dropped any post whose clip had an `audioUrl`, which would have deleted seeded posts once real audio landed. Now only `blob:` recordings are session-only. localStorage key bumped to `sound-reactions-demo-v3`.

| Check | Result |
| --- | --- |
| lint / typecheck | Pass |
| unit | 11/11 pass |
| build | Pass |
| e2e | 36/36 pass (32 existing + new soundboard test on 4 setups; asserts no AudioContext while browsing) |

## Motion pass — 2026-10-29 (Claude Code)

- **Live waveforms:** a shared `AnalyserNode` (created only inside `play()`, i.e. a user gesture) drives reaction bars, the reaction emoji, and the voice-post halo from real audio levels, log-spaced 90 Hz–9 kHz. Transform-only; off under reduced motion.
- **Emoji bursts** (anime.js 4.2.2, `src/motion.ts`): on reaction play, soundboard preview (with pad press), and when a reaction you added lands on a post (one-shot signal, never on page load). Decorative layer is `aria-hidden`, `pointer-events: none`, cleaned up after ≤ 900 ms; verified 0 leftover nodes.
- **3D title-slide orb:** plain three.js r169 with named imports (lazy chunk, 118 KB gzip, loaded on browser idle only on `/presentation`). Reads the analyser level; never creates an AudioContext. One still frame under reduced motion, low-power or data-saver. Flat-icon fallback without WebGL. React Three Fiber was tried and removed: it pulled the full three.js namespace (222 KB gzip chunk) for a single mesh.
- **Audio controller:** per-play nodes now disconnect on stop (previously each play left its gain/compressor chain connected). Generated files route through a gain node so volume/mute behave the same in every browser.

Bugs found and fixed:
- `kimi-plugin-inspect-react` stamped a `code-path` attribute onto every element in **production** builds, leaking source file paths into the live HTML and crashing three.js objects (`code-path` → `mesh.code.path`). Plugin removed; verified no `code-path` in build output.
- The orb canvas rendered at 1.5x density without a CSS size, spilling over and blocking the "Hear it" button on high-DPI screens. Caught by the new e2e test; fixed with CSS sizing and `pointer-events: none`.

| Check | Result |
| --- | --- |
| lint / typecheck | Pass |
| unit | 11/11 |
| build | Pass (main 115 KB gzip) |
| e2e | 40/40, two consecutive full runs (adds "presentation starts no audio until pressed" on 4 setups) |

Real ElevenLabs audio still pending: account status `past_due` (rechecked 2026-10-29).

## Real audio generated — 2026-10-29 (Claude Code)

ElevenLabs account active (Creator plan; commercial use included). Generated once with `scripts/generate-audio.mjs`: 18 sound effects (`eleven_text_to_sound_v2`) and the voice post (`eleven_multilingual_v2`, stock voice "Charlotte", not a clone of any real person). All clips are labeled "AI-generated audio" in the UI, credited to elevenlabs.io, and flagged `aiDeclared` + `aiLabel` so the governance AI-label check passes on its own merits.

Mastering (ffmpeg, from cached raw files): exact gain toward a max-momentary target (−15 LUFS effects, −16 voice), iterated up to 5 passes, then a 4x-oversampled limiter. Result: every clip within 0.8 dB of target; true peak ≤ −0.7 dBTP; 976 KB total. Integrated loudness was tried first and rejected for 1.5–4 s clips (it averages in silence between claps and under-reads applause by ~7 dB).

The loudness preflight check now reads measured values for generated files and says so; synthesized fallbacks and live recordings stay labeled as unmeasured metadata.

| Check | Result |
| --- | --- |
| onboard check | Pass |
| lint / typecheck | Pass |
| unit | 11/11 |
| e2e | 40/40 (playback tests now exercise real files via MediaElementSource) |
| Browser probe | `/audio/mm-hmm.mp3` 200/206 audio/mpeg; live waveform bars respond; AI label shown; no page errors |

## Silent playback in the hosted viewer — fixed 2026-10-29

User report: real sounds silent in the published page. Cause: generated files played via `<audio>` routed through `createMediaElementSource`. The hosted viewer runs the page in a sandboxed frame (opaque origin), so the file is cross-origin and the browser outputs silence from the media element source. Local testing (same origin) did not show it.

Fix: generated files are fetched and decoded (`decodeAudioData`) into `AudioBufferSourceNode`s on the same Web Audio graph as the synthesizer; decoded buffers are cached; `ctx.resume()` is called synchronously in the gesture before any await; a play token cancels stale loads (including stop during load); any load/decode failure falls back to the synthesized version instead of silence. Live recordings (`blob:`) play via a plain `<audio>` element.

Verified with a harness that loads each build in `<iframe sandbox="allow-scripts">` from a different origin, measuring the analyser meter: previous build SILENT on Chromium and WebKit; fixed build produces output on both. Unit 11/11, e2e 40/40.

## 2026-10-29 — Sound check + iPhone audio unlock

- Added Settings → Sound check (plays the airhorn on press; reports engine state, real-file load result, measured signal, app mute and volume, plus an iPhone silent-switch tip).
- `src/audio.ts`: `navigator.audioSession.type = 'playback'`, a one-time silent WAV unlock on the first gesture, a `webkitAudioContext` fallback, and visible toasts when the file fails or the browser holds the audio back.
- Results: lint clean, typecheck clean, 11/11 unit, 40/40 Playwright (Chromium and WebKit, desktop and mobile). Hosted build scanned for key leaks: none. Live copy republished as version 7.

## 2026-10-30 — Illustrated avatars for fictional accounts

Added illustrated SVG portraits (drawings, not photos) for the nine fictional accounts, generated by `scripts/generate-avatars.mjs` into `public/avatars/`. `src/avatar.tsx` shows a portrait when one exists and the initials otherwise; the owner account (BB) keeps its initials until a photo is supplied.

| Check | Actual result |
|---|---|
| ESLint | Passed |
| Strict TypeScript | Passed |
| Unit/component tests | 11/11 passed |
| Production build | Passed |
| Playwright | 20/20 passed in Chromium (desktop and mobile). WebKit was not available in this environment and was not run. |
| Manual check | Hosted build loads at 1440×900 and 390×844 with the banner, portraits in the feed, voice post and Who to follow, and no horizontal overflow |
