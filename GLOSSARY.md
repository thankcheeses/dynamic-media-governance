# Glossary

Terms the prototype's code and documents use, with the module that owns each one. Use these words; avoid the synonyms noted.

**Header** — the animated banner on a profile. A *preset* describes one (`sound-reactions-src/src/headers.ts`). Avoid: cover, hero image.

**Header pick** — the viewer's live header, as the store keeps it: a preset by id (with `chosen`, false until the viewer publishes from the studio) or an *upload* whose frames live only in this tab (`src/banner.ts`, `HeaderPick`). Avoid: the sentinel id `'upload'`, which the store no longer uses.

**Banner** — what a profile's header area shows right now: none, archive still, scanning, blocked, failed or playable. The banner resolver (`src/banner.ts`, `resolveBanner`) is the one place that decides it. Avoid: re-deriving it in a component.

**Header source** — where a header to scan comes from: a fixture sample, a hosted GIF, a GIPHY pick or a device file (`src/headerScan.ts`, `HeaderSource`). The scan entry point (`scanSource`) is the one way a header is scanned; hosted GIFs go through its per-tab cache (`scanHosted`).

**Provenance** — where a playing header came from, stated by the banner resolver: hosted (GIPHY or Tenor), GIPHY pick, device, owner file, rendered, fixture. The ⓘ panel prints it. Avoid: inferring it from which fields are set.

**Credit** — the "via GIPHY" / "via Tenor" link rule 14 requires on anything that plays from a host (`creditOf`).

**Scan / decision** — the deterministic header screen (`scanHeader`) and its outcome: PASS, PROVISIONAL, BLOCK, REJECTED. *Publishable* means PASS or PROVISIONAL.

**Submission ledger** — the one function that turns a preflight decision into the submission record, its audit trail and the owner's post (`src/ledger.ts`, `recordDecision`). Avoid: building audit sequences at a call site.

**Ephemeral** — about a post imported from the viewer's archive (ids start `x-`). Carried as a flag on posts and audit events and by a submission's post id; never matched in free text (`src/ledger.ts`, `isEphemeralPostId`).

**Preferences** — the settings keys the viewer changed from the shipped defaults. Only these are stored; a product default can change without a migration (`src/persistence.ts`).

**Motion policy** — the one rule table for whether UI micro-motion, rich decorative motion or a header may move, and what the banner says about it (`src/motionPolicy.ts`). *Still reason* is why a header shows one frame.

**Profile view-model** — who a profile page is about and what it shows: display fields, metadata rows, actions, tab contents and empty-state copy (`src/profileView.ts`, `profileFor`). *Mine* means the viewer's own profile: the owner demo or their imported archive.

**Owner** — the one real account in the demo (`@baynardmalone`). "Make it yours" relabels it for display with a visitor's *identity*; a relabelled account is never shown as verified.
