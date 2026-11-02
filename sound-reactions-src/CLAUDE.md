# Claude Code Handoff — Sound Reactions Concept

You are taking over a completed, browser-only React prototype. Start by reading `README.md`, `PRD.md`, `GOVERNANCE_MAPPING.md`, and `TEST_REPORT.md`. Do not treat the prototype’s simulated governance or approximate audio measurements as production services.

## Current state

- Restored from website version `d9921d6`; rollback snapshot `77de5e2` had identical content.
- Production build is included in `dist/`.
- Final baseline: lint, strict TypeScript, production build, 11/11 unit/component tests, and 32/32 Playwright tests passed.
- Browser matrix: Chromium and WebKit, desktop 1280×900 and mobile 390×844.
- Production Lighthouse accessibility: 100. Captured views had zero serious/critical axe violations, console errors, HTTP errors, or horizontal page overflow.
- Sixteen final screenshots and machine-readable test evidence are included.
- Production dependency audit: zero known vulnerabilities. Full development audit still reports 32 findings (22 moderate, 10 high), mainly transitive Lighthouse/Puppeteer and Tailwind/PostCSS tooling. Do not claim these are resolved.

## Install and run

Use Node.js 20+.

```bash
npm ci   # lockfile resolves to registry.npmjs.org
npm run dev
```

Production verification:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

Run the production preview before captures or Lighthouse:

```bash
npm run preview -- --host 127.0.0.1
npm run capture
```

Lighthouse example:

```bash
npx lighthouse http://127.0.0.1:4173/ \
  --only-categories=accessibility --output=json \
  --output-path=test-results/lighthouse.json \
  --chrome-flags="--headless --no-sandbox"
```

If Chromium is not discovered automatically, set `CHROME_PATH` to a local Chromium executable.

## Architecture

- `src/audio.ts`: singleton playback controller, Web Audio synthesis, session-recording playback and global one-stream enforcement.
- `src/governance.ts`: pure deterministic eight-check preflight and reason-copy mapping.
- `src/store.ts`: Zustand state, guarded localStorage persistence, publishing, reporting, moderation and audit actions.
- `src/data.ts`: fictional seed content, six sound definitions, settings and governance defaults.
- `src/types.ts`: shared domain types.
- `src/components/AudioClip.tsx`: voice/reaction players, progress, captions, reporting and scroll-away behavior.
- `src/components/ReactionPicker.tsx`: sound preview/selection and prior-hour reaction rate count.
- `src/components/Layout.tsx`: persistent concept banner, responsive shell, global audio settings and visibility/low-power handling.
- `src/pages/Composer.tsx`: media selection, live preflight and real/simulated recording flows.
- `src/pages/Governance.tsx`: editable policy controls, review queue and decisions.
- `src/pages/Audit.tsx`: searchable/filterable local audit timeline and JSON export.
- `src/pages/Presentation.tsx`: eight keyboard-accessible slides and notes.
- `src/index.css`: visual system and responsive/accessibility styling.
- `e2e/core.spec.ts`: required cross-browser regression scenarios.
- `scripts/capture.mjs`: screenshots, console/HTTP/overflow checks and axe scans.
- `src/accounts.ts`: profiles for every account, including which header each one shows.
- `src/headers.ts`: header presets (the owner's hosted GIFs, rendered GIFs and fixtures), framework limits and the deterministic header scan.
- `src/flash.ts`: the flash arithmetic (WCAG 2.2 general flash; red flash by the CIE 1976 UCS working definition; area rule; flash counting), DOM-free and unit-tested; `scripts/analyze-header.py` mirrors it.
- `src/analyze.ts`: in-browser decoding, measurement (via `src/flash.ts`) and transcoding of uploaded GIF or video headers.
- `src/hostedScan.ts`: fetches an unmeasured hosted GIF and runs it through the upload analyzer once per tab, before it may play.
- `src/components/DynamicHeader.tsx`: the header player (video, canvas and uploaded frames) and its playback rules.
- `src/pages/Profile.tsx`: X-style profile pages and the header studio (samples, upload, GIPHY, scan, publish).
- `src/giphy.ts` + `src/components/GiphyPanel.tsx`: GIPHY search (rating PG, still-frame results, attribution) feeding the same scan as uploads.
- `scripts/render-header.mjs` + `scripts/analyze-header.py`: render the three.js headers and measure them into `src/header-manifest.json`.
- `scripts/generate-avatars.mjs`: illustrated avatars for the fictional accounts.
- `src/soundUpload.ts`: decodes and measures a sound file the viewer picks (reaction picker and composer), building a session-only Clip; pure measurement helpers are unit-tested.
- `src/archive.ts`: reads a person's own X data archive (zip or its `data/*.js` files) in the browser with fflate: account, profile, posts, likes and the images inside the zip; never contacts X; DOM-free apart from object URLs, unit-tested.
- `src/importStore.ts`: the imported account, likes and Highlights pins, in memory only; imported posts go into the main store flagged `ephemeral`.
- `src/components/ImportArchive.tsx`: the import dialog (steps, consent text, file picker). `src/pages/Privacy.tsx`: the privacy notice.
- `src/motion.ts`: all anime.js motion (bursts, pad press, landing, staggers), gated by reduced motion in one place.
- `src/components/SoundOrb.tsx`: lazy three.js title-slide orb; reads analyser levels only.
- `scripts/generate-audio.mjs` + `scripts/audio-catalog.mjs`: ElevenLabs generation (`NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/generate-audio.mjs`). Writes `public/audio/*.mp3` and `src/audio-manifest.json`; the app uses files automatically when listed.

Routes: `/`, `/compose`, `/compare`, `/governance`, `/audit`, `/settings`, `/presentation`, `/privacy`, `/profile` (owner), `/u/:handle` (other accounts) and `/me` (the viewer's imported X archive, or the import landing when nothing is imported).

## Non-negotiable product invariants

1. Keep the banner: `CONCEPT PROTOTYPE · NOT AFFILIATED WITH X`.
2. No X login, API, scraping, posting, logo, Chirp font or copied X assets. The one way a real person's X data enters the prototype is their own downloaded archive, read in their browser (`src/archive.ts`): never uploaded, never persisted, never fetched from X's servers; only account, profile, posts, likes, verified status, follower/following counts and bundled images are read, never email, messages or anything else in the archive. All seed data stays fictional, except the owner account (@baynardmalone), whose photo the owner supplied and whose GIF picks are linked from their hosts, except `public/headers/neon-cats.gif`, which the owner supplied and asked to keep in the repository (`ownerFile` in `src/headers.ts`). Fictional accounts use illustrated avatars, never realistic photos.
3. Never create/resume `AudioContext` or play audio on load, scroll, hover, focus or viewport entry. Start only from click/key handlers. Dynamic profile headers are the one kind of media that animates without a tap: they are silent (muted, no audio track), have no `autoplay` attribute, and follow rule 14.
4. Starting any clip must stop the previous clip, including repeated instances of the same library sound.
5. Reactions remain compact and default to an 8-second cap. Voice posts are full-width, author-owned and capped separately at 140 seconds.
6. Every clip needs visible meaning without audio. Captions default on; keep a short text alternative even when detailed captions are disabled.
7. Preserve play/pause/stop, elapsed/total time, progress, persistent mute/volume, reduced motion, data saver, hidden-tab and scroll-away behavior.
8. Low-power mode is an explicit user setting; do not claim the browser provides a reliable low-power signal.
9. Abuse and copyright checks must remain labeled `SIMULATED` unless replaced by real, documented services.
10. Loudness: generated library files are leveled and measured at build time with ffmpeg EBU R128 (max momentary loudness, true peak ≤ −0.7 dBTP). Synthesized fallback sounds and live recordings are not measured. Sounds a viewer uploads (`src/soundUpload.ts`) are decoded with an OfflineAudioContext and given an approximate loudness (unweighted RMS with the BS.1770 offset, flagged `approxLoudness`), which the preflight labels as approximate and not EBU R128; uploads stay in the tab as blob: URLs like recordings, must be described before they can be added, and the copyright check on them is still SIMULATED. Never call any of it certified.
11. Recording requires the permission explainer and browser permission. Denial/unavailability uses a clearly labeled simulated fallback.
12. Do not add biometric identity requirements or video-only limits to audio.
13. WCAG 2.2 AA is a design target, not a certification. No ADA Title II applicability or X affiliation claim.
14. Dynamic headers (`src/headers.ts`, `src/components/DynamicHeader.tsx`): play at most 15 fps on a loop of at most 10 s; pause while scrolling, off-screen and in hidden tabs; show a still frame under reduced motion, low power or data saver; always offer a pause button. Nothing is animated before it passes the scan. Flashing samples are only ever drawn as still frames. Provisional headers stay behind their warning label until the viewer chooses to play them. The analyzers (`src/flash.ts` via `src/analyze.ts`, and `scripts/analyze-header.py`) are a simplified WCAG 2.3.1 screen, never described as certified: general flash is a ≥10% relative-luminance change with the darker state below 0.80; red flash follows WCAG 2.2's working definition (one state with R/(R+G+B) ≥ 0.8 and a CIE 1976 UCS change above 0.2); both count only over 25% of a 10° field and both are limited to 3 per second. The owner's hosted picks are now `scanInBrowser` like the themed picks; their earlier numbers predate the red-flash rule and are not carried as measurements. Uploaded and GIPHY headers stay in the browser tab and are never persisted or sent anywhere; GIPHY GIFs are fetched from GIPHY, never copied into the repository, and keep their attribution. Hosted picks (`hosted` presets in `src/headers.ts`) play from GIPHY or Tenor, carry a "via" credit link on the banner, and are never copied into the repository. Hosted picks with no measurements (`scanInBrowser`, currently all of them) show their still frame while `src/hostedScan.ts` fetches the GIF and runs the upload analyzer in the viewer's browser; they animate only if that scan passes, and a failed or blocked scan leaves the still frame up.

## Persistence and deployment

Three localStorage keys are used, all with guarded access. `sound-reactions-giphy-key` holds only the viewer's own GIPHY API key, typed into the header studio (never committed; a build can alternatively embed one with `VITE_GIPHY_API_KEY`, which makes it visible to anyone viewing the page). `sound-reactions-identity` holds the viewer's "Make it yours" name, handle, bio and a 256 px JPEG of their photo (`src/identity.ts`); it relabels the owner account for display only, never shows the verification badge, survives a demo reset, and nothing in it leaves the browser. `sound-reactions-demo-v3` holds the rest: settings, governance configuration, fictional feed changes, submissions and audit events. Recorded-audio Blob URL posts/submissions are excluded from persistence and are session-only. An imported X archive is **not** persisted at all: its posts carry `ephemeral: true` and are dropped by `partialize`, as are submissions and audit entries about them (post ids start with `x-`); the account, likes and Highlights pins live in `src/importStore.ts` with no storage. A reload clears it. The page sets a Content Security Policy (`index.html`) that allows connections only to the site itself, GIPHY and Tenor. There is no backend or cross-device sync.

`dist/` is the production static build. Static hosting needs an SPA fallback to `index.html` for direct deep links. Tests navigate from `/`. The hosted copy at `../sound-reactions/` is built with `VITE_HASH_ROUTER=1 npx vite build --base ./ --outDir ../sound-reactions --emptyOutDir`; `../.github/workflows/pages.yml` runs the same build on every push to `main` with `VITE_GIPHY_API_KEY` from the repository secret `GIPHY_API_KEY` and deploys to Pages once the repository's Pages source is set to GitHub Actions. The key is never committed; the workflow fails if it finds it in a tracked file.

## Change workflow

1. Read the relevant tests before changing playback, persistence or governance.
2. Make focused changes; preserve strict typing and existing accessible names unless intentionally updating tests and UI together.
3. Run the full verification commands above.
4. Regenerate screenshots/evidence after user-facing changes and inspect both form factors.
5. Update `TEST_REPORT.md` with actual results only. Update `SOURCES.md` when factual/legal/history claims change.
6. Never invent test results, platform history, legal compliance, research findings or moderation capability.

## Useful next engineering work

- Add manual screen-reader, switch, zoom/reflow and photosensitivity review.
- Add measured loudness/true-peak processing if real media upload is introduced.
- Replace fixture moderation only with evaluated services and explicit reviewer operations.
- Add a real backend, durable reporting/appeals and authentication only as a separate architectural project; do not disguise localStorage as multi-user persistence.
- Review development-tool dependency upgrades carefully rather than applying breaking `npm audit fix --force` changes blindly.
