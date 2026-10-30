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

## 2026-10-30 — Dynamic GIF headers, profiles and header uploads

Added X-style profiles for every account (`/profile`, `/u/:handle`), reachable by tapping a name or avatar in the feed, a mobile account drawer, the owner's own photo, and dynamic headers:

- Five headers rendered with three.js (`scripts/render-header.mjs`) and measured with `scripts/analyze-header.py`. Each one is 15 fps, a 10 s loop, 3.6–4.5 MB as a GIF and 0.30–0.37 MB as the WebM that is served, with 0 flashes per second.
- A header studio that scans samples or a GIF or video the viewer picks. Analysis and transcoding run in the browser and nothing is stored or sent.
- Rule change: frame rate over 15 fps is transcoded down rather than rejected. Hard blocks now cover over-limit flashing across 25% or more of the header, as well as red flashing and 10 or more flashes per second.

| Check | Actual result |
|---|---|
| ESLint | Passed |
| Strict TypeScript | Passed |
| Unit/component tests | 19/19 passed (adds header scan, frame-rate and flash-severity tests) |
| Playwright | 24/24 passed in Chromium, desktop and mobile (adds feed → profile header and strobe hard-block tests). WebKit was not available in this environment and was not run. |
| Analyzer sanity check | A synthetic full-frame black/white strobe at 10 fps measured 5 flashes/s across 100% of the frame (hard block); a synthetic red pulse was flagged as red flash (hard block). The browser and Python analyzers agreed on four real-world GIFs supplied by the owner (flash counts 3, 1, 0 and 1 per second). Those GIFs were used for local testing only and are not in the repository. |
| Manual check | Feed → profile navigation, header playback (muted, no autoplay attribute), pause while scrolling, still frame under reduced motion, provisional warning gate, upload of GIF and MP4, mobile drawer, no horizontal overflow at 390×844 |

## 2026-10-30 — GIPHY search for headers

Added GIPHY search to the header studio (`src/giphy.ts`, `src/components/GiphyPanel.tsx`). The viewer enters their own API key, which is stored only in their browser under `sound-reactions-giphy-key`. Results are rated PG and shown as still frames with "Powered by GIPHY" attribution. A picked GIF is downloaded and goes through the same scan and transcode as an upload before it can play, and its header chip reads "Via GIPHY".

| Check | Actual result |
|---|---|
| ESLint / strict TypeScript | Passed |
| Unit/component tests | 19/19 passed |
| Playwright | 26/26 passed in Chromium, desktop and mobile, including a new GIPHY test with mocked API and media responses. WebKit was not available here. |
| Live GIPHY API | **Not tested.** This environment cannot reach api.giphy.com or media.giphy.com, and no real key was used. The request format follows GIPHY's documented search and trending endpoints and must be confirmed with a real key. |
| Mocked checks | Rejected key shows an error; key is saved only in its own storage slot, not the demo state; requests send rating=pg; the grid shows still frames only; a strobe GIF is hard-blocked and a calm GIF passes and plays |

## 2026-10-30 — Header info tour replaces banner chips

Removed the measurement chips from the profile banner. A new ⓘ "About this header" button beside the pause button opens a four-step tour (`src/components/HeaderInfo.tsx`): scanned before it went live, within the limits, how it plays (with the current playback state), and under the hood (thresholds and links to the analyzers and decision rules). The photosensitivity warning on provisional headers stays on the banner.

| Check | Actual result |
|---|---|
| ESLint / strict TypeScript | Passed |
| Unit/component tests | 19/19 passed |
| Playwright | 28/28 passed in Chromium, desktop and mobile (adds a tour test and checks that the banner has no chips). WebKit was not available here. |

## 2026-10-30 — The owner's own GIFs as hosted headers

Three of the owner's four GIF picks now play as profile headers straight from their hosts, credited on the banner and never copied into the repository: the SpongeBob jellyfish strut from GIPHY (the owner's profile and the proposal page's hero), the SpongeBob computer clip from Tenor (@theotypes) and the Paid in Full clip from Tenor (@deesaysso). A hosted header plays in a hidden muted video and is drawn to a canvas at most 15 times a second, so the 20 fps Tenor file shows at the framework's cap. The fourth pick (neon cats from a 1998 Purina ad) was not found on GIPHY or Tenor and is not on the site.

| Check | Actual result |
|---|---|
| Measurements | Taken by `scripts/analyze-header.py` on the owner's copy of each clip: jellyfish strut 14.29 fps, 1.33 s, 0.48 MB, 1 flash/s; SpongeBob computer 16.67 fps, 1.92 s, 0.71 MB, 0 flashes/s; Paid in Full 20 fps, 1.5 s, 1.73 MB, 1 flash/s; neon cats 13.26 fps, 5.58 s, 1.61 MB, 3 flashes/s across 25% of the frame. All four pass; the two over 15 fps pass with transcoding. |
| ESLint / strict TypeScript | Passed |
| Unit/component tests | 20/20 passed (adds a check that every hosted pick scans PASS and that fast ones are marked for transcoding) |
| Playwright | 32/32 passed in Chromium, desktop and mobile (adds a hosted-header test with Tenor mocked by a local WebM; the info tour test now expects the hosted source line). WebKit was not available here. |
| Screenshots | Both pages at 1280 and 390 px wide with the hosts mocked: no page errors, no horizontal overflow, credit chip and pause button do not overlap. |
| Live hosts | **Not tested.** This environment cannot reach GIPHY or Tenor. The Tenor MP4/WebM URLs and the GIPHY signed MP4 and still URLs are the ones each host publishes for the GIF; playback from the live site must be confirmed in a browser. |

## 2026-10-30 — Themed GIFs for the fictional accounts, scanned in the browser

Five more GIFs now play on the fictional profiles from GIPHY, one per corner of the timeline: a sage cleanse (@kiaravibes), a grandmother's-kitchen cooking clip (@jreyescooks), a scrolling-code loop (@samoko), a neural-network "Training" animation (@ariexplains) and Kevin Garnett's "Right now!" (@coachnia). None of them had been measured ahead of time, so they are marked `scanInBrowser`: the profile shows the still frame with a "Scanning for flashing before it plays…" note while `src/hostedScan.ts` fetches the GIF and runs the same analyzer as an upload, then plays the scanned frames only if the scan passes. A failed or blocked scan leaves the still frame up. Picking one of them in the header studio runs the real scan instead of the simulated one. The neon cats GIF is still not on the site: its only known copy is a Pinterest pin, and Pinterest is not reachable from this environment.

| Check | Actual result |
|---|---|
| ESLint / strict TypeScript | Passed |
| Unit/component tests | 21/21 passed (adds a check that unmeasured hosted picks carry a GIF and a still to scan from) |
| Playwright | 34/34 passed in Chromium, desktop and mobile (adds a browser-scan test with GIPHY mocked by the local calm GIF: the banner plays through the canvas, has no host video element, is credited, and the ⓘ tour says it was scanned in the browser). WebKit was not available here. |
| Screenshots | Jordan's profile at 1280 and 390 px with GIPHY mocked: the scan note shows first, then the scanned frames play; the header studio lists the new picks with "Scanned in your browser when picked". No page errors, no horizontal overflow. |
| Live GIPHY | **Not tested.** This environment cannot reach GIPHY, so the in-browser fetch (which needs GIPHY's CORS headers, as the existing GIPHY picker already assumes) and playback must be confirmed on the live site. |

## 2026-10-30 — The owner's neon cats GIF on @mayamakes

At the owner's request the neon cats GIF (a 1998 Purina commercial) is kept in the repository as `public/headers/neon-cats.gif`, with a WebM and a still frame made from it by ffmpeg, and plays on @mayamakes. The ⓘ tour's Source line says it is the owner's own file. A three.js banner rendered earlier in the session for this slot was discarded; the owner wanted the real GIF.

| Check | Actual result |
|---|---|
| Measurement | `scripts/analyze-header.py` on the file: 13.26 fps, 5.58 s loop, 1.61 MB, 3 flashes per second across 25% of the frame, no red flash. Passes, exactly at the limit of 3. |
| ESLint / strict TypeScript | Passed |
| Unit/component tests | 21/21 passed |
| Playwright | 34/34 passed in Chromium, desktop and mobile. WebKit was not available here. |
| Screenshot | Maya's profile at 1280 px: the GIF plays from the local WebM with the pause and ⓘ controls; no page errors. |

## 2026-10-30 — "Make it yours": a visitor's own name and photo on the owner profile

The owner profile has a new **Make it yours** button. It opens a small form (photo, name, handle, bio) and from then on the owner profile, the composer, the account drawer, the sidebar and every post by the owner show the visitor's name, handle, initials or photo instead of the owner's. The verified badge is hidden for a personalised profile, the profile meta line reads "Your profile, on this device only", and the button becomes **Edit my details**, where "Use the demo owner again" restores the original. Everything is kept in one localStorage key (`sound-reactions-identity`, `src/identity.ts`): the photo is shrunk in the browser to a 256 px JPEG data URL before it is stored, nothing is uploaded, there is no account and no login. The internal handle stays `@baynardmalone` so profile links and searches keep working.

| Check | Actual result |
|---|---|
| ESLint / strict TypeScript | Passed |
| Unit/component tests | 21/21 passed |
| Playwright | 36/36 passed in Chromium, desktop and mobile (adds a test that fills the form with "Sam Tester" and the handle "sam tests!", expects `@samtests`, no verified badge, the device-only meta line, "Post by Sam Tester" articles, persistence across a reload, and the restore path back to B. Baynard-Malone). WebKit was not available here. |
| Screenshots | The form and the renamed profile at 390 px wide: no page errors, no horizontal overflow. |
| Photo upload | **Not tested.** The 256 px shrink (`squarePhoto`) has no automated test and was not tried by hand here; confirm it on the live site with a JPEG and a PNG. |
