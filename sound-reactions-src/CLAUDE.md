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

- `src/audio.ts`: the playback controller (`createAudioController` with injectable deps; the app's singleton is `audioController`). It owns the playback policy: one stream at a time, volume follows settings, a hidden tab stops it, low-power mode stops it and refuses the next play. It subscribes to the store itself; Layout has no audio effects. Unit-tested with a fake Web Audio graph.
- `src/governance.ts`: pure deterministic eight-check preflight and reason-copy mapping.
- `src/store.ts`: Zustand state and actions. Publishing, reactions and moderation go through `src/ledger.ts` (the submission ledger: one function makes the submission, its audit trail and the owner post). What persists, and how older saves are read, is `src/persistence.ts` (an allow-list; settings stored as preferences; ephemerality as a flag). Both are unit-tested.
- `src/data.ts`: fictional seed content, six sound definitions, settings and governance defaults.
- `src/types.ts`: shared domain types.
- `src/components/AudioClip.tsx`: voice/reaction players, progress, captions, reporting and scroll-away behavior.
- `src/components/PostBox.tsx`: the post box at the top of the timeline (text post, emoji, link to the sound composer carrying the draft). Text-only posts go through `postText` in the store (`textPost` in `src/ledger.ts`): no sound, so no preflight and no submission, one `text_post_published` audit line.
- `src/emoji.ts` + `src/components/EmojiPicker.tsx`: the full Unicode emoji set (`unicode-emoji-json`, lazy-loaded from the bundle, never fetched from another site), name search and the insert-at-cursor rule; used by the post box and the composer.
- `src/components/ReactionPicker.tsx`: sound preview/selection and prior-hour reaction rate count.
- Domain vocabulary and decisions: `../GLOSSARY.md` and `../docs/adr/`. Use the glossary's words in code, tests and copy.
- `src/journey.ts`: the ordered stops of the walkthrough and the tour's saved progress. `src/components/tourSteps.tsx` holds the tour copy; `WelcomeTour.tsx` renders the tour (Next opens each step's page; closing resumes later) and the Next card at the foot of every page. Typeface: Inter, self-hosted from the bundle (never Chirp).
- `src/components/Layout.tsx`: persistent concept banner, responsive shell, drawer, tour state and the phone-only tour pill. (Audio settings and visibility handling moved into `src/audio.ts`.)
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
- `src/headerScan.ts`: the one way a header is scanned. Takes a `HeaderSource` (fixture sample, hosted GIF, GIPHY pick, device file), owns the loader adapters, the rule that turns a measured file into a preset, the per-tab cache for hosted GIFs (`scanHosted`, observable from React) and one audit line shape. Replaces `hostedScan.ts`.
- `src/banner.ts`: the banner resolver. From the account, the viewer's header pick, any upload in this tab and the scan cache it returns one tagged `Banner` (none, archive still, scanning, blocked, failed, playable) carrying provenance and the "via" credit. The header pick is `{ kind: 'preset', presetId, decision, chosen }` or `{ kind: 'upload', decision }`.
- `src/motionPolicy.ts`: the one rule table for motion: UI micro-motion, rich decorative motion (the orb) and header playback (rule 14's still reasons, the warning gate, the pauses and the ⓘ status line). `motion.ts`, `DynamicHeader` and `SoundOrb` read it.
- `src/profileView.ts`: the profile view-model (`profileFor`): who the page is about, display fields, metadata rows, actions, tab contents and empty copy; `displayAuthor` is the one rule for how a post's author is shown under "Make it yours".
- `src/components/DynamicHeader.tsx`: the header player (video, canvas and uploaded frames); the DOM signals it gathers go into the motion policy.
- `src/pages/Profile.tsx`: X-style profile pages and the header studio (samples, upload, GIPHY, scan, publish). Renders the banner resolver's and view-model's results; every scan goes through `headerScan.ts`.
- `src/giphy.ts` + `src/components/GiphyPanel.tsx`: GIPHY search (rating PG, still-frame results, attribution) feeding the same scan as uploads.
- `scripts/render-header.mjs` + `scripts/analyze-header.py`: render the three.js headers and measure them into `src/header-manifest.json`.
- `scripts/generate-avatars.mjs`: illustrated avatars for the fictional accounts.
- `src/soundUpload.ts`: decodes and measures a sound file the viewer picks (reaction picker and composer), building a session-only Clip; pure measurement helpers are unit-tested.
- `src/archive.ts`: reads a person's own X data archive (zip or its `data/*.js` files) in the browser with fflate: account, profile, posts, likes and the images inside the zip; never contacts X; DOM-free apart from object URLs, unit-tested.
- `src/importStore.ts`: the imported account and likes, in memory only; imported posts go into the main store flagged `ephemeral`. Highlights pins live in the main store (`highlights`): pins on the owner demo's posts persist, pins on imported posts go with the import.
- `src/components/ImportArchive.tsx`: the import dialog (steps, consent text, file picker). `src/pages/Privacy.tsx`: the privacy notice.
- `src/motion.ts`: all anime.js motion (bursts, pad press, landing, staggers); whether it may run comes from `src/motionPolicy.ts`.
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
14. Dynamic headers (`src/headers.ts`, `src/components/DynamicHeader.tsx`): play at most 15 fps on a loop of at most 10 s; pause while scrolling, off-screen and in hidden tabs; show a still frame under reduced motion, low power or data saver; always offer a pause button. Nothing is animated before it passes the scan. Flashing samples are only ever drawn as still frames. Provisional headers stay behind their warning label until the viewer chooses to play them. The analyzers (`src/flash.ts` via `src/analyze.ts`, and `scripts/analyze-header.py`) are a simplified WCAG 2.3.1 screen, never described as certified: general flash is a ≥10% relative-luminance change with the darker state below 0.80; red flash follows WCAG 2.2's working definition (one state with R/(R+G+B) ≥ 0.8 and a CIE 1976 UCS change above 0.2); both count only over 25% of a 10° field and both are limited to 3 per second. The owner's hosted picks are now `scanInBrowser` like the themed picks; their earlier numbers predate the red-flash rule and are not carried as measurements. Uploaded and GIPHY headers stay in the browser tab and are never persisted or sent anywhere; GIPHY GIFs are fetched from GIPHY, never copied into the repository, and keep their attribution. Hosted picks (`hosted` presets in `src/headers.ts`) play from GIPHY or Tenor, carry a "via" credit link on the banner, and are never copied into the repository. Hosted picks with no measurements (`scanInBrowser`, currently all of them) show their still frame while `src/headerScan.ts` fetches the GIF and runs the upload analyzer in the viewer's browser; they animate only if that scan passes, and a failed or blocked scan leaves the still frame up, with the reason on the banner. The ⓘ panel states provenance from the banner resolver (`src/banner.ts`), never from which fields happen to be set.

## Persistence and deployment

Three localStorage keys are used, all with guarded access. `sound-reactions-giphy-key` holds only the viewer's own GIPHY API key, typed into the header studio (never committed; a build can alternatively embed one with `VITE_GIPHY_API_KEY`, which makes it visible to anyone viewing the page). `sound-reactions-identity` holds the viewer's "Make it yours" name, handle, bio and a 256 px JPEG of their photo (`src/identity.ts`); it relabels the owner account for display only, never shows the verification badge, survives a demo reset, and nothing in it leaves the browser. `sound-reactions-demo-v3` (storage version 3, `src/persistence.ts`) holds the rest as an allow-list: the viewer's settings *preferences* (only keys changed from the defaults, so a product default can change without a migration), governance configuration, fictional feed changes, submissions, audit events, likes/reposts/bookmarks/favorites, Highlights pins and the header pick. Recorded-audio and uploaded-sound Blob URL posts/submissions are session-only, as are uploaded header frames (an upload pick falls back to the default preset on reload; a hosted pick persists by id). An imported X archive is **not** persisted at all: its posts carry `ephemeral: true`, audit events about them carry `ephemeral: true`, submissions about them are recognised by their `x-` post id, and all of it is dropped by `partializeState`; the account and likes live in `src/importStore.ts` with no storage. A reload clears it. Older saves (v1, v2) are read by `migrateState`. The page sets a Content Security Policy (`index.html`) that allows connections only to the site itself, GIPHY and Tenor. There is no backend or cross-device sync.

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
