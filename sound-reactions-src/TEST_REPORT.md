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

## 2026-11-01 — Red flash by WCAG 2.2's chromaticity rule; red flashes get the 3-per-second limit

The red-flash test now follows WCAG 2.2's working definition (ISO 9241-391): a transition counts as red when one state has R/(R+G+B) ≥ 0.8 **and** the two states differ by more than 0.2 in the CIE 1976 UCS diagram (u′v′ from sRGB → XYZ with the coefficients in the WCAG text; black is treated as achromatic). The previous `(R−G−B)×320 > 20` heuristic is gone. The arithmetic moved to `src/flash.ts` (DOM-free, unit-tested) and `scripts/analyze-header.py` mirrors it. The scan now records `redFlashesPerSecond` instead of a yes/no, and applies the same limit as general flashes: more than 3 red flashes a second is a hard block; 3 or fewer passes, as WCAG's threshold states.

Because the three owner picks on GIPHY/Tenor had been measured under the old rule and their copies are no longer available here, they are now scanned in the viewer's browser before they play, like the themed picks. Re-uploading a copy in the header studio measures it under the new rule.

| Check | Actual result |
|---|---|
| Re-measurement (local headers) | `scripts/analyze-header.py` on `clay-orbit.gif` and `neon-cats.gif`, and `--red-only` over the WebM frames of `citrus`, `moss`, `sea-glass`, `violet-hour`: red flashes 0/s for five; **neon cats 2/s** (was 0 under the old heuristic) with 3 general flashes/s — still passes. Hosted owner picks: **not re-measured** (clips not available here). |
| Python ↔ TypeScript agreement | Same synthetic cases: full-frame red/black pulse at 15 fps → 8 red flashes/s in Python and >3 in TS; red/dark-red (brightness only) → 0; green/black → 0; sRGB red at u′v′ (0.4507, 0.5229) in both. |
| ESLint / strict TypeScript | Passed |
| Unit/component tests | 28/28 passed (7 new in `src/test/flash.test.ts`; the hosted-pick tests now assert the browser scan; one new case checks 2 red/s passes and 4 red/s blocks) |
| Playwright | 36/36 passed in Chromium, desktop and mobile (Dee's Tenor pick and the owner profile now mock the host GIF and wait for the browser scan). WebKit was not available here. |
| Screenshot | Dee’s profile, ⓘ "Scanned before it went live" step at 390 px with the neon cats GIF standing in for Tenor: "General flashes 3 per second", "Red flashes 2 per second (limit 3)", "Passed"; no page errors. |
| Live hosts | **Not tested.** GIPHY and Tenor are unreachable from this environment; the in-browser fetch of the owner's three picks (Tenor's CORS headers in particular) must be confirmed on the live site. |

## 2026-11-02 — Preview with your own X archive, read in the browser

Section 7 of `SPEC.md`, the owner's chosen first step. `/me` (also "Use my X archive" on the owner profile and the account drawer) opens a dialog that explains the X data download and reads the zip X sends, or the `data/*.js` files inside it, **in the browser** with fflate: only `account.js`, `profile.js`, `tweets*.js`, `like.js`, `verified.js`, `follower.js`, `following.js` and the images in `profile_media`/`tweets_media` are read; everything else in the zip, including the email address in `account.js`, direct messages and ad data, is skipped unread. The result is held in memory only (`src/importStore.ts`; imported posts enter the feed flagged `ephemeral` and are excluded from localStorage along with any submissions or audit entries about them). A reload, a closed tab or **Clear my import** removes it. Images come from the archive; X's CDN is never contacted.

The profile page now fills every tab honestly for every account: Posts (top-level), Replies (`in_reply_to`), Highlights (a local pin from a post's ··· menu, since X does not export Highlights), Media (posts with images from the archive; videos are skipped and say so), Likes (from `like.js`: text and link, since X does not export the author). Demo accounts show plain empty states instead of invented content. Reposts show a "reposted @…" line. A `/privacy` page describes storage and network behaviour; a Content Security Policy on the page limits connections to the site, GIPHY and Tenor.

| Check | Actual result |
|---|---|
| ESLint / strict TypeScript | Passed |
| Unit/component tests | 32/32 passed (4 new in `src/test/archive.test.ts`: prefix parsing and file selection; X date parsing and short dates; a full synthetic archive → profile, newest-first posts, reply, repost, image + missing-video media, likes, counts, no email or DM text anywhere in the result, no `pbs.twimg.com` URL in any post; missing `account.js` refused and the 2,000-post cap). |
| Playwright | 38/38 passed in Chromium, desktop and mobile (new test builds a small zip in the test, imports it through the real dialog, checks the name, handle, bio, avatar image, each tab's content, pinning to Highlights, the posts appearing in Home, that localStorage never contains the handle or email, that **no request left for any host other than the site, GIPHY or Tenor**, that Clear my import returns to the demo profile, and that a reload shows the landing again). WebKit was not available here. |
| Screenshots | `/me` landing, the import dialog, and the imported profile at 390 px: no page errors, no horizontal overflow. |
| Real archives | **Not tested with a real X export** here (none available in this environment). The parser follows X's documented archive layout and tolerates both `tweet` and `tweets` wrappers and split `tweets-partN.js` files; please try it with your own archive on the live site and report anything that does not import. |
| CSP | Set via `<meta http-equiv>`; the e2e suite ran against it without console errors. Headers cannot be set on GitHub Pages, so `frame-ancestors` is not enforced. |

## 2026-11-02 — Upload your own sound (local-only)

Section 4 of `SPEC.md`. The reaction picker has **Upload your own** and the composer has **Upload a sound**. A picked audio file is decoded with an `OfflineAudioContext` (renders nothing, so the "AudioContext only inside a click handler" rule is untouched), measured in the browser (duration, size, peak, and an approximate loudness: unweighted RMS with the BS.1770 −0.691 dB offset, flagged `approxLoudness`), and becomes a session-only blob: clip like a microphone recording. It must be described before it can be added; the eight-check preflight runs unchanged, labels the loudness as approximate and not EBU R128, and the copyright check stays SIMULATED, which the UI says next to the upload. No trim is offered: a clip over the cap is blocked by the duration check and the person picks a shorter file.

| Check | Actual result |
|---|---|
| ESLint / strict TypeScript | Passed |
| Unit/component tests | 35/35 passed (3 new in `src/test/soundUpload.test.ts`: a 0.2-peak sine measures about −17.7 LUFS and −14 dBFS peak, two identical channels add 3 dB, silence reports −70; audio-file acceptance by type or extension; the built clip starts undescribed and flagged approximate) |
| Playwright | 42/42 passed in Chromium, desktop and mobile (two new: a generated 1 s WAV uploaded in the picker is auto-selected, shows "about −17.x LUFS", the not-EBU-R128 and SIMULATED-copyright notes, cannot be added until described, then attaches as a reaction and leaves nothing about itself in localStorage; a generated 10 s WAV in the composer shows "10s submitted" and the publish button reads Blocked). WebKit was not available here. |
| Screenshot | Picker at 390 px with the uploaded tile selected and the description filled: no page errors, no overflow. |
| Formats | Only WAV was exercised in tests (generated). MP3/M4A/OGG decoding depends on the browser's codecs and was **not tested** here; try one of each on the live site. |
| Loudness accuracy | The estimate is not K-weighted or gated. **Not compared against ffmpeg** on the same files here; treat the number as a rough guide, as the UI says. |

## 2026-11-02 — Pages build workflow with the GIPHY key as a repository secret

Section 8 of `SPEC.md`. `.github/workflows/pages.yml` installs, lints, typechecks and unit-tests the prototype, stages the proposal page and repository files, builds the prototype with `VITE_GIPHY_API_KEY` from the `GIPHY_API_KEY` secret, fails if that key appears in any tracked file, uploads the site as a Pages artifact, and deploys it only when the repository's Pages source is already "GitHub Actions" (it asks the Pages API for `build_type`). Nothing else in the repository changed.

| Check | Actual result |
|---|---|
| YAML | Parses; two jobs (`build`, `deploy`), triggers `push` to `main` and `workflow_dispatch`. |
| Build steps | The staging copy (`git ls-files` → `cp --parents`) and the `vite build` into `_site/sound-reactions` were run locally with the same commands and an empty key: the staged site contains `index.html`, `README.md`, `SPEC.md`, `_config.yml`, `.nojekyll` and the built `sound-reactions/`. |
| Workflow run | **Not run here.** No GitHub Actions runner in this environment. The first real run happens when this merges to `main`; the deploy job stays skipped until the owner switches the Pages source and the secret is added. |
| Key handling | **Not tested with a real key.** The tracked-file check uses `git grep -F` on the secret from an environment variable, so the key never appears in the command line or the logs (GitHub also masks secrets in logs). |


## 2026-11-02 — Low-power mode blanked the app; true-black theme; proposal reframed for X's teams

**Bug.** Turning on Low-power mode in Settings made the whole prototype disappear (black screen, empty `#root`). Cause: `useAudio()` returned a new `stop` function on every render, and the Layout effect that pauses audio under low power listed `stop` as a dependency; with low power on, every render re-ran the effect, `stop()` emitted a playback-state change, that re-rendered Layout, and the loop ended in React error #185 ("maximum update depth exceeded"), which unmounts the tree. Fix: `play` and `stop` are now module-level constants, so their identity never changes. The hidden-tab effect had the same dependency and is fixed by the same change.

**Theme.** Lights out now uses `#000` for surfaces as well as the page (stat cards, notices, the concept banner strip were `#0C0F11`/`#16181C`); accent tints are magenta instead of the leftover blue. The proposal page's raised surfaces are `#000000` and its ambient glow is reduced to a hint. Dim is unchanged.

**Proposal copy.** The hero and executive summary now address X's product and engineering teams and add a "what you get" list (the numeric controls, the reference implementation, the stated boundaries). The sentence "X is preparing to introduce dynamic and interactive profile headers" is replaced with a conditional; X has announced no such feature and the page now says so. (An earlier note in this report said that sentence was not on the page; it was. The search that missed it used the wrong regex flavour.)

| Check | Actual result |
|---|---|
| Reproduction | Before the fix, in the production build: toggling Low-power mode left `#root` empty and logged React error #185 from `Layout`'s effect via `audioController.stop → emit`. After the fix: Settings stays on screen, Home renders, Maya's header shows a still frame with "low-power mode is on" in the ⓘ panel. |
| ESLint / strict TypeScript | Passed |
| Unit/component tests | 35/35 passed |
| Playwright | 44/44 passed in Chromium, desktop and mobile (new regression test for the low-power toggle). WebKit was not available here. |
| Screenshots | Governance page at 390 px on pure black; proposal hero and executive summary with the new copy. |

## 2026-11-02 — Lights out enforced once, low-power reset once, phone home screen closer to X

The owner's phone showed the navy **Dim** theme and still-frame banners. Both were saved settings in their browser: Dim had been selected earlier, and Low-power mode had been switched on during the blank-screen bug and stayed on across the reload. The persisted store is now at version 2 with a one-time migration that sets the theme to Lights out and Low-power mode to off; Dim remains selectable afterwards. On phones (≤ 700 px) the home screen no longer shows the inline composer (X uses the pen button there) or the topic tabs beyond For you / Following.

| Check | Actual result |
|---|---|
| Live site (fresh browser, via a remote fetch) | The proposal page serves the new copy on black. The owner profile shows the ⓘ and pause controls on the banner, which only render after the in-browser scan passes, so the GIPHY fetch and scan work in the wild. A headless screenshot showed the banner area dark, which is consistent with a canvas that had not been painted by the time the capture ran; it is not evidence either way about animation on a real phone. |
| ESLint / strict TypeScript | Passed |
| Unit/component tests | 35/35 passed |
| Playwright | 44/44 passed in Chromium, desktop and mobile (full run before the low-power reset was added to the migration; the settings, low-power and persistence tests re-run after it). WebKit was not available here. |
| Migration from a real v1 store | **Not tested with the owner's actual saved data**; the migration only touches `settings.theme` and `settings.lowPower`. |

## 2026-11-08 — Six deepening refactors from the architecture review (`/improve-codebase-architecture`)

The review (report kept outside the repo) found six shallow spots and the owner asked for all of them. No visible copy changed except where a defect was fixed. New modules: `src/headerScan.ts` (one scan entry point, replaces `hostedScan.ts`), `src/banner.ts` (banner resolver and the tagged header pick), `src/ledger.ts` (submission ledger), `src/persistence.ts` (allow-list persistence, preferences, migrations, storage v3), `src/motionPolicy.ts` (one motion rule table), `src/profileView.ts` (profile view-model and `displayAuthor`). `src/audio.ts` now owns the playback policy with injectable deps; Layout lost its three audio effects. Decisions are in `docs/adr/0001` and `0002`; vocabulary in `GLOSSARY.md`.

**Defects fixed along the way** (all found by reading, confirmed by the new tests):
- A hosted sample published from the header studio was stored as an "upload": lost on reload, no "via" credit on the banner (rule 14), and a Tenor GIF described as picked from GIPHY. It is now a preset pick with Tenor/GIPHY provenance and credit, and it persists.
- A GIPHY pick's banner now carries the "via GIPHY" credit link.
- Picking the default header explicitly on an imported profile now shows it (the archive still showed before, because "chosen" was inferred from the id).
- An audit entry whose free text contained `x-` (for example a scan of "Relax-time.gif") was dropped from storage; ephemerality is now a flag.
- A sound started after low-power mode was switched on used to play; the controller now refuses it and says so.
- Highlights pins on the owner demo's posts now persist, as the copy promised.

**Deliberately unchanged:** data saver still has no effect on audio (the Settings copy promises no prefetch; the controller never prefetched). That needs a product decision before it is encoded; noted in the review.

| Check | Actual result |
|---|---|
| ESLint / strict TypeScript | Passed |
| Unit/component tests | **87/87 passed** in 10 files (52 new: scan entry point and banner resolver, ledger and persistence, motion policy table, profile view-model, audio policy with a fake Web Audio graph) |
| Playwright | **44/44 passed** in Chromium, desktop and mobile, on the refactored build, before the new e2e test was added; then the GIPHY test (extended with the banner credit) and the new studio-hosted-pick regression test passed 4/4 in both projects. WebKit was not available here. |
| Regression test order | The new e2e test was written after the fix, not before; it asserts the three symptoms (credit link, Tenor provenance, pick survives reload) that the old code could not produce. |
| Hosted build | `../sound-reactions/` rebuilt (hash router). |
| Migration from a real v2 store | **Not tested with the owner's actual saved data**; `migrateState` is unit-tested on synthetic v1 and v2 saves. |

## 2026-11-13 — Inter typeface, a guided journey, and a tour that is easy to find

The owner asked for a more Twitter-like font, a flow where nobody has to hunt for the next page, and a tour that is visible without nagging.

- **Font.** The prototype used the device's system font (Roboto on Android). It now ships Inter (SIL Open Font License) from its own bundle via `@fontsource-variable/inter`; nothing is fetched from a font host, so the Content Security Policy is unchanged. Chirp is X's proprietary face and is still not used (rule 2). The proposal page already used Inter.
- **Journey.** `src/journey.ts` is one ordered list of eight stops (feed, a profile, my profile, compose, governance, audit, compare, presentation, then the proposal). Every page ends with a Next card pointing to the stop after it; Settings and Privacy point back to the start.
- **Tour.** Seven steps, and Next now opens the page each step talks about. Closing remembers the step and reopening resumes there. On phones, where the banner button shrinks to a "?", a small "Tour" pill sits bottom-left with its own dismiss button; the "?" always remains.

| Check | Actual result |
|---|---|
| ESLint / strict TypeScript | Passed |
| Unit/component tests | 92/92 passed in 11 files (5 new, `journey.test.ts`) |
| Playwright | 48/48 passed in Chromium, desktop and mobile (new test: the tour drives, resumes, and the Next cards chain). WebKit was not available here. |
| Font actually applied | In the built app on an emulated Pixel 7, `document.fonts.check('15px "Inter Variable"')` returned true and the body's computed font family starts with Inter Variable. |
| Screenshots (emulated Pixel 7, desktop 1280) | Inspected: tour on Dee's profile, pill after closing, Next card at the foot. A first pass showed the pill and compose button covering the Next card on phones; the card now has clearance. **Not re-captured after that spacing fix.** |
| Real phone | **Not tested on the owner's device.** |

## 2026-11-13 — Whole-number frame rate in the banner status line

Recording a demo exposed "Playing at up to 13.26 fps" in the ⓘ panel for a GIF whose native rate is not a whole number. The status line now rounds. The measured rate on the "Within the limits" step is unchanged, since that one is a measurement.

| Check | Actual result |
|---|---|
| ESLint / strict TypeScript | Passed |
| Unit tests | 93/93 passed (1 new case in the motion policy table) |
| Playwright | **Not re-run**; the change is one string in a unit-tested pure function. |
| Hosted build | Rebuilt. |

## 2026-11-14 — Link preview cards

The proposal link showed a small square crop of a sample header when pasted into a post. Both pages now declare a large-image card using the owner's own card designs (supplied as images, resized to 1200×627): `og/dynamic-media-governance-proposal.png` for the proposal (the first version shipped the wrong card, NHID-Clinical; corrected and renamed on 2026-11-14) and `public/og-card.png` for the prototype.

| Check | Actual result |
|---|---|
| Files | Both PNGs are 1200×627 and referenced by absolute URL in `og:image` and `twitter:image`. |
| Hosted build | Rebuilt; `sound-reactions/og-card.png` and the new meta tags are present in the built `index.html`. |
| Lint / typecheck / unit tests | Passed (93/93); no source code changed. |
| Card as rendered by X | **Not tested.** X fetches the page itself after deploy and caches previews, so an older preview can persist for a while. |
