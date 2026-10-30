# Sound Reactions — Independent Concept Prototype

A production-oriented, local-only React prototype for post-attached sound reactions and an adapted Dynamic Media Governance workflow. It is **not affiliated with X**, makes no X API calls, and contains only fictional accounts, posts and counts.

## What is implemented

- Three-column social timeline with compact mobile navigation, For you / Following filters, local post actions and reaction picker.
- Six original Web Audio sounds synthesized at runtime: Applause, Side-eye, Laughter, Gasp, Mm-hmm and Tiny violin. No samples or memes.
- Distinct voice-post player (up to 140 s) and sound-reaction chip (default cap 8 s), with different visual treatments and accessible names.
- Gesture-only playback, one global stream, play/pause/stop, elapsed/total progress, global mute/volume, captions, visible text alternatives, reduced motion and data-saver settings.
- Scroll-away, hidden-tab and explicit low-power pause behavior. The low-power control is a user toggle because the web exposes no reliable low-power signal.
- Local composer with preview, descriptions, AI-label controls, real `getUserMedia` / `MediaRecorder` capture behind a permission explainer, and a clearly labeled simulated fallback.
- Deterministic preflight with editable thresholds and REVIEW/BLOCK policies. Abuse and copyright detectors are labeled **SIMULATED**.
- Review queue, approval/removal/escalation, reaction-specific reporting, statements of reasons, decision history and JSON exports.
- Append-only-in-the-UI audit trail with filtering and all specified event types, including user-initiated `playback_started`.
- Eight-slide keyboard-accessible presentation with presenter notes and a live embedded post.
- Lights out and Dim themes.

## Technology

React 18, TypeScript (strict), Vite, Tailwind CSS, Zustand, React Router, Lucide icons, Vitest, React Testing Library, Playwright and axe-core. There is no backend.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Production build and preview:

```bash
npm run build
npm run preview
```

The generated static site is in `dist/`. It can be hosted on a static host with SPA fallback to `index.html`. Navigate from `/`; direct deep links require that fallback.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npx playwright install chromium webkit
npm run build
npm run test:e2e
```

The browser matrix covers Chromium and WebKit at 1280 px desktop and 390 px mobile. `TEST_REPORT.md` records actual results and open limitations.

Screenshots (with the production preview running on port 4173):

```bash
npm run capture
```

Lighthouse accessibility (with the production preview running):

```bash
CHROME_PATH=/path/to/chromium npx lighthouse http://127.0.0.1:4173/ \
  --only-categories=accessibility --output=json \
  --output-path=test-results/lighthouse.json \
  --chrome-flags="--headless --no-sandbox"
```

## What is stored

Only browser `localStorage`, under the key `sound-reactions-demo-v3`, wrapped in `try/catch`:

- playback, accessibility and theme settings;
- governance thresholds and per-check failure policies;
- fictional feed changes and post-action state;
- submissions, review outcomes and audit events.

Recorded microphone media and any post/submission containing a recording Blob URL are **excluded from persistence**. Recording is session-only. Audio never leaves the device. Clearing site data removes local state; nothing syncs across devices. The Settings page provides a demo-data reset.

## What is simulated or approximated

- All accounts, content, counts, publishing, reporting and human review are fictional and local.
- Abuse keywords/flags and copyright fingerprints are fixture flags, not AI or real detection.
- Loudness: the 19 ElevenLabs files are leveled and measured at build time (ffmpeg EBU R128, max momentary loudness about −15 LUFS for effects and −16 for the voice, true peak ≤ −0.7 dBTP). The synthesized fallbacks and live recordings are not measured. Nothing here is certified.
- The prototype does not provide legal compliance, certification, real identity verification or biometric anchoring.
- X layout and color values are product approximations from the build brief, not scraped design tokens. The unauthenticated x.com page did not expose the timeline for independent visual comparison.

## Project map

- `src/audio.ts` — global playback controller and original synthesis.
- `src/governance.ts` — pure deterministic preflight and control provenance.
- `src/store.ts` — guarded local persistence, publishing, reporting, moderation and audit actions.
- `src/components/` — players, posts, picker, modal, settings controls and shell.
- `src/pages/` — feed, composer, comparison, governance, audit, settings and slides.
- `src/test/` — unit/component tests.
- `e2e/` — required cross-browser behavior and axe checks.
- `screenshots/` — desktop/mobile captures of all requested views.
- `PRD.md`, `GOVERNANCE_MAPPING.md`, `SOURCES.md`, `TEST_REPORT.md` — product and verification documentation.

## Assets

All sound is synthesized by project code. Icons are from Lucide (ISC license). No X logo, Chirp font, copied X icons, external photography, audio samples or API keys are included.
