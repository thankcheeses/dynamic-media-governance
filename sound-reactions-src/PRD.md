# Product Requirements Document — Sound Reactions Concept

## 1. Product summary

**Working title:** Sound Reactions  
**Status:** Independent concept prototype; not affiliated with X  
**Product principle:** Expressive by design, silent by default.

A sound reaction is a compact, post-attached audio response with a visible text equivalent. A voice post remains author-owned primary content with a full-width player and a separate duration policy.

## 2. Goals

1. Let a viewer understand every reaction without playing audio.
2. Make playback deliberate, controllable and non-overlapping.
3. Keep voice posts and reactions distinct in appearance, behavior and accessible naming.
4. Prevent common publishing failures through deterministic preflight.
5. Demonstrate reaction-specific reporting, reviewer decisions, reason statements and audit export.
6. Validate the concept on desktop/mobile and keyboard/screen-reader-oriented journeys.

## 3. Non-goals

- X authentication, API integration, scraping, posting or affiliation.
- Real AI moderation, copyright fingerprinting, legal certification or biometric identity.
- Cloud persistence, cross-device sync, personal-data collection or server uploads.
- Claims that an X sound-reaction feature exists or previously existed.

## 4. Users and core journeys

### Viewer
Open the timeline without audio → read a reaction description → choose play → pause/stop or start another clip → report the reaction independently if needed.

### Creator
Compose text → select voice post or sound reaction → choose/synthesize/record audio → preview → supply a description → inspect live preflight → publish locally or submit for review.

### Reviewer
Open governance → adjust policy thresholds → inspect a hold/report → approve, remove or escalate → read the statement of reasons → export/filter the audit trail.

### Presenter
Open the eight-slide deck → use buttons or arrow keys → demonstrate the embedded live post → expand presenter notes.

## 5. Functional acceptance criteria

### Feed and formats
- [x] Fictional seeded feed includes humor/agreement/surprise/applause/respectful disagreement without harassment examples outside moderation fixtures.
- [x] Reaction chips show label, name, duration, count, description, emoji/text alternative and independent report action.
- [x] Six original sounds are synthesized only after user action.
- [x] Voice posts and reactions have different labels, icons, colors, sizes, duration limits and accessible names.
- [x] Side-by-side comparison view is available.

### Audio contract
- [x] No audio or `AudioContext` starts on load, scroll, viewport entry, hover or focus.
- [x] Starting clip B stops clip A, including repeated instances of the same library sound.
- [x] Play/pause, stop, elapsed/total and progress are visible.
- [x] Global mute/volume work in the persistent header and Settings; mute persists.
- [x] Captions default on; a short visible text alternative remains even when detailed captions are off.
- [x] Scroll-away, tab-hide and low-power stop active playback.
- [x] Reduced-motion preference and setting disable waveform animation.
- [x] Data saver performs no audio prefetch; synthesized audio needs no network request.

### Composer and recording
- [x] Text, media type, sound selection, preview, description and playback settings are available.
- [x] Live preflight updates when clip metadata or policy changes.
- [x] PASS publishes locally; REVIEW holds; BLOCK prevents publishing.
- [x] Microphone capture requires an explainer and browser permission, shows a red Recording indicator/timer, and supports Stop/Cancel.
- [x] Denial/unavailability exposes a clearly labeled simulated fallback.
- [x] Recording is session-only and excluded from persistent feed/submission storage.

### Governance and audit
- [x] Eight checks cover duration, size, description, loudness metadata, rate, SIMULATED abuse, SIMULATED copyright and AI label.
- [x] Reaction duration defaults to 8 s; size to 256 KB; voice duration is separately capped at 140 s.
- [x] Rate limiting counts local submissions for the same post in the prior hour; default is five.
- [x] Every threshold and failure policy is editable.
- [x] Demo fixtures cover pass, missing description, 12-second duration and SIMULATED abuse.
- [x] Review approval of a held submission publishes it into the feed; removal marks a published reaction removed.
- [x] Reports create queue entries and DSA-style reason statements.
- [x] Audit events include submission, preflight, checks, flag, review, decision, playback, report and moderation action.
- [x] JSON export works for audit events and submissions.

### Settings and presentation
- [x] Autoplay is fixed to “Off — by design.”
- [x] Mute, volume, captions, reduced motion, data saver, low-power and theme controls are operable.
- [x] Eight slides support previous/next, arrow keys, counter, direct slide selection and collapsible notes.
- [x] History content is limited to the approved facts and clearly separates hypotheses.

## 6. Accessibility acceptance criteria

- [x] Persistent concept banner and skip link.
- [x] Keyboard-operable controls and modal Escape/backdrop dismissal.
- [x] Visible focus rings and accessible names.
- [x] Desktop targets meet at least 24×24 px; primary mobile controls target approximately 44 px.
- [x] Text contrast passes automated serious/critical axe checks in the tested views.
- [x] Live regions announce playback and preflight state.
- [x] No horizontal page overflow at 390 px in captured views.
- [x] Production Lighthouse accessibility score meets or exceeds 95; actual result is recorded in `TEST_REPORT.md`.

## 7. Rollout and validation proposal

Internal accessibility and adversarial fixtures → opt-in pilot → comprehension/moderation/device evaluation → expansion. Proposed rollback triggers include autoplay regression, audio-only meaning, review-capacity overload, pilot-approved abuse/false-positive limit breaches and device-performance harm. Numeric launch gates require evidence; none are presented as established benchmarks.

## 8. Open engineering follow-ups

- Measure real loudness and true peak during media processing.
- Replace fixture flags with evaluated moderation services only after policy and reviewer-capacity research.
- Conduct manual screen-reader, switch-control, zoom and photosensitivity reviews.
- Add durable server-side reporting/appeals if this ever becomes a real multi-user product.
