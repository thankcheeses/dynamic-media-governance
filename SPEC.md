# Spec: let people try Sound Reactions with their own X profile

Status: draft for the owner (Brianna Baynard-Malone, @baynardmalone) to approve before anything is built. Written 2026-11-01 against `main` plus PR #8.

## 0. The one-paragraph version

A visitor taps **Sign in with X**. We ask X for the least it will give us: who they are and their own recent public posts. Their real name, handle, avatar, bio and posts appear in the prototype, in X's layout, with the two things X does not have today: a moving GIF banner they pick (scanned for flashing first) and sound reactions on their posts. Nothing is posted to X, nothing is changed on X, nothing they see is stored on a server, and when they sign out or close the tab it is gone. The owner's own profile stays the owner's. Everyone else gets a preview of *their* X, not a copy of the owner's.

What the owner asked for, in their words: "able to test it and that's all", "SAFELY, I don't wanna see anything and nothing needs to be compromised on either end", "make the tabs accurate so when I click Highlights I have my highlights", "people can upload their own sounds", "make the X UI/UX mimic X".

## 1. Goals and non-goals

Goals
- A real person can see what *their* X profile and timeline would look like with GIF banners and sound reactions.
- The owner never sees anyone's data; the system never keeps anyone's data.
- Every rule in `sound-reactions-src/CLAUDE.md` still holds: nothing autoplays audio, nothing animates before the flash scan passes, SIMULATED labels stay, no X logo/font/assets as branding, `CONCEPT PROTOTYPE · NOT AFFILIATED WITH X` stays.

Non-goals
- Posting, liking, following, or changing anything on X. Not now, not later in this spec.
- Reading other people's timelines, DMs, followers, or anything non-public.
- A social network of our own. No accounts of ours, no feeds of other visitors.
- Pretending this *is* X. It is a preview of a proposal.

## 2. What X's rules say (checked 2026-11-01)

Read in full: the [X Developer Policy](https://docs.x.com/developer-terms/policy) and [About the X API](https://docs.x.com/x-api/getting-started/about-x-api). **Not readable from this environment:** the [Developer Agreement](https://docs.x.com/developer-terms/agreement), the [pricing page](https://docs.x.com/x-api/getting-started/pricing) and the [Display Requirements](https://developer.x.com/developer-terms/display-requirements). The owner must read those three in a browser before approving; the Agreement is the one that matters most (see 2.4).

### 2.1 What is clearly allowed and required
- **Sign in with X is the sanctioned way in.** The Policy says not to ask people for passwords and suggests Sign in with X instead. ("You may not store X passwords, or request that people provide their X password…")
- **Least privilege is on us.** The Policy requires "express and informed consent" before any action on someone's behalf and says "a person authenticating into your service does not by itself constitute consent." We will request only read scopes and take no actions, so there is nothing to consent to beyond reading.
- **After sign-in we must show their X identity:** "Once someone on your service authenticates via Sign in with X you must clearly display their X identity. X identity includes the person's current X @handle, avatar, and X logo." So the X logo appears *next to the signed-in person's handle* as attribution. That is the only place it may appear; the Policy also says "You may only use and display the X name and logo to identify X as the source of X Content" and never "in a manner that creates a false sense of endorsement, sponsorship, or association with X." Our concept banner already covers the "Service authenticity" rule ("Don't use names, logos, or URLs that … falsely imply an affiliation with X").
- **The Sign in with X button must be at least as prominent as any other sign-in.** We have no other sign-in, so this is trivially met.
- **Content must stay current.** If we show someone's posts we must fetch the current version through the API and remove anything that disappears from the API "as soon as reasonably possible, or within 24 hours" of a removal request. Holding nothing server-side and refreshing on every sign-in satisfies this; any client-side cache must expire within the session.
- **Keep X Content intact.** "You must maintain the integrity of all X Content that you display" and "may not remove or alter any proprietary notices or marks." Our GIF banner and sound reactions are layered *around* posts, never edit post text, author or timestamps, and are visibly ours (a reaction chip, a banner), never presented as part of the post.
- **Privacy policy before sign-up**, stating what we collect, how we use and share it (including with X), and how to contact us. We need a one-page privacy policy on the site.
- **The use-case we write when we register the app is binding.** It must describe this exactly: "read-only preview of a design proposal; displays the signed-in user's own profile and recent posts with added animated banner and audio-reaction UI; no posting; nothing stored."
- **Do not use the API to benchmark X** or to build "white label" copies. Not relevant to us, noted for completeness.

### 2.2 Pricing (pay-per-use; prices from third-party mirrors of X's pricing page, not read first-hand here)
X no longer sells Free/Basic/Pro tiers; it is credits, billed per request, with a monthly cap. Reported rates: **User read $0.010 per user returned; Posts read $0.005 per post returned; "owned reads" $0.001 per resource, but only "when the id is the authenticated user *and that user is the owner of the developer app*."** That last clause means visitors' own posts are **not** the cheap rate for us (they do not own our app); only the owner's are.

Rough cost per visitor session: 1 user read ($0.01) + 20 posts ($0.10) + optional 20 liked posts ($0.10) ≈ **$0.11–$0.21**, less where X's 24-hour deduplication applies. 1,000 sign-ins ≈ $110–$210. New accounts reportedly get up to $70 of one-time credits. **Verify every number in the Developer Console before setting a budget; set a hard monthly spend cap there, and set our own daily sign-in cap (see 3.6) so a viral tweet cannot run the bill.**

### 2.3 Rate of use
The Policy says Pay-Per-Use "is designed for hobbyists, commercial prototyping, early-stage X product integrations, and supporting applications with limited end-users" and that X may require an Enterprise plan if Sign in with X user counts "greatly exceed the normal levels" of similar apps. A capped public preview fits; an uncapped one may not.

### 2.4 The open legal question
Since January 2023 the Developer Agreement has prohibited using the API "to create or attempt to create a substitute or similar service or product to the X Applications." A web search says the current Agreement (reportedly updated April 2026) still contains that clause; it could not be read from here. Our position, to confirm by reading it: this is a **read-only preview of a design proposal** with no posting, no following, no feed of other users, no accounts, and a persistent disclaimer; it cannot substitute for X because you cannot *do* anything on it. If, on reading, the owner or a lawyer thinks the clause still bites, the fallback is section 7 (no X data; bring-your-own profile), which needs no API at all.

## 3. Feature A: Sign in with X, read-only preview

### 3.1 Visitor flow
1. Prototype shows a **Sign in with X** button on the owner profile page and in the account drawer, under a line: "Preview this with your own X profile. We only read your public profile and recent posts. Nothing is posted or saved."
2. Tap → X's authorization page lists exactly what we ask (profile and posts, read only). They approve or cancel.
3. Back in the prototype: a new route `/me` shows *their* profile in the X layout: banner (their current X banner as the still frame), avatar, name, @handle with the small X mark beside it (required by Policy), bio, join date, counts, and tabs filled from their own posts (section 5).
4. They pick a GIF banner (upload, GIPHY, or the presets). It is scanned in their browser as today; it plays only if it passes. They add sound reactions to their own posts from the library or their own uploads (section 4). It all stays in their tab.
5. **Sign out** (always visible) revokes our token with X, clears sessionStorage and returns to the demo. Closing the tab does the same minus the revoke call (the token expires on its own; we request no refresh token).

### 3.2 Scopes
`users.read` and `tweet.read`. Optionally `like.read` for the Likes tab. **Never** `tweet.write`, `users.write`, `follows.*`, `dm.*`, `offline.access`, `media.write`. Requesting none of the write scopes is the strongest guarantee we can give that "nothing is compromised": X will not even issue us a token that *could* post.

### 3.3 Architecture (what talks to what)
- **Static site (GitHub Pages)** — unchanged, holds the whole UI.
- **One tiny serverless function** (Cloudflare Worker or Vercel function; pick whichever the owner already has an account on). It exists only because X's OAuth token endpoint cannot be called from a browser, and because the app's client secret must never be in the page. It does three things and nothing else:
  1. `/auth/start`: builds the X authorize URL with PKCE and a signed state cookie.
  2. `/auth/callback`: exchanges the code for an access token, then immediately calls `GET /2/users/me` and `GET /2/users/:id/tweets` (fields: text, created_at, public_metrics, attachments, referenced_tweets, in_reply_to_user_id; expansions: attachments.media_keys), returns that JSON to the browser, and **discards the token** unless the visitor also wants the Likes tab, in which case one more call happens in the same request. The function holds the token in memory for the life of one request. It writes nothing to disk, KV, or a database.
  3. `/auth/revoke`: forwards the visitor's sign-out to X's revoke endpoint.
- **Browser**: keeps the returned profile and posts in `sessionStorage` under one key, shows them, and never sends them anywhere. No localStorage, so they do not survive the tab. No analytics on `/me`.

What we never have: a user table, a token table, logs containing tokens or post text (log only status codes and timings), a way for the owner to see any visitor's data.

### 3.4 Secrets
- X client ID (public) and client secret (secret) live only in the function's environment variables. The owner creates the X app and pastes the secret into the hosting dashboard themselves; it is never sent in chat, never committed, never in the page.
- The GIPHY key: see section 6.

### 3.5 Safety checklist (block merge until every line is true)
- [ ] Only read scopes requested; a reviewer checks the authorize URL.
- [ ] Function has no storage binding of any kind.
- [ ] Function logs contain no tokens, handles, or post text.
- [ ] Token discarded at end of request; no refresh token requested.
- [ ] `sessionStorage` only; cleared on sign-out; revoke called on sign-out.
- [ ] Content Security Policy on the site: scripts from self only; connections to our function, GIPHY, Tenor, X image CDN (`pbs.twimg.com`) only.
- [ ] Privacy policy page live and linked before the button.
- [ ] X mark shown beside the signed-in handle, nowhere else.
- [ ] Concept banner still on every page including `/me`.
- [ ] Daily sign-in cap and monthly spend cap set (3.6).
- [ ] Owner has read the Developer Agreement and Display Requirements and approved 2.4.

### 3.6 Caps and the kill switch
- Function counts sign-ins per UTC day in memory (approximate is fine) and returns "The preview is full for today, try tomorrow" past a number the owner picks (start at 200/day ≈ $20–40/day worst case).
- One environment variable `PREVIEW_ENABLED=false` turns the button into a "Preview paused" label without a deploy.

### 3.7 What the visitor sees that is not from X
Everything added is visibly ours: the banner player and its ⓘ panel, reaction chips, the composer's sound picker, the governance and audit pages (which stay fictional/local). Posts themselves render only fields X returned. Counts are X's `public_metrics`. We do not invent followers, verification, or Premium status; the badge shows only if X's `verified`/`verified_type` says so (the Policy requires this).

## 4. Feature B: upload your own sound

Today the library has six generated sounds plus a recorder. Add **Upload a sound** to the same picker, under the same rules as reactions and voice posts.

- Accepts `audio/*` (MP3, M4A/AAC, WAV, OGG, WebM). Decoded with `AudioContext.decodeAudioData` in the browser; nothing uploaded.
- Measured in the browser: duration, file size, peak, and an **approximate integrated loudness** (K-weighted RMS over the clip). Labelled "approximate loudness, measured in your browser; not EBU R128" — the existing library's numbers come from ffmpeg at build time and are the only ones we call measured.
- Caps: reaction ≤ 8 s (hard trim offered: "use the first 8 seconds"), voice post ≤ 140 s. Size cap from the governance settings.
- Required: a text description (what it sounds like) and, for voice, a transcript box. The same eight-check preflight runs; abuse and copyright stay **SIMULATED** with the label.
- **Copyright is the real risk.** Without a fingerprinting service we cannot know whether a 6-second clip is a song. For the local-only version that is acceptable because the clip never leaves the tab. For any future version where other people can hear it, uploads must wait for a real fingerprint check (or be limited to recorded voice).
- Session-only: stored as a Blob URL in memory like recordings today; gone when the tab closes.
- Playback obeys every existing rule: tap to play, one stream, captions on, pause on scroll-away, mute/volume persist.

## 5. Feature C: accurate profile tabs

Tabs stay `Posts · Replies · Highlights · Media · Likes`, in X's order, with X's behaviour as far as the API allows. Be honest in the UI where it does not.

| Tab | Signed-in visitor (from X) | Fictional accounts and the owner demo |
|---|---|---|
| Posts | Own posts, newest first, excluding replies (`in_reply_to_user_id` absent); reposts included and labelled | Seed posts as today |
| Replies | Posts with `in_reply_to_user_id` set, each shown with the "Replying to @…" line | Add seed replies so the tab is not empty |
| Highlights | **Not available through X's API** (Highlights is a Premium feature with no public read endpoint as of this writing). Show: "X doesn't expose Highlights to apps yet. Pin posts here to try it." Pinning is local. | Same, with a couple of seeded pins |
| Media | Posts whose `attachments.media_keys` is non-empty, in X's 3-column grid; images from X's CDN, videos as poster + link | Seed posts with illustrated images |
| Likes | `GET /2/users/:id/liked_tweets` with `like.read` (opt-in checkbox before sign-in: "also show my Likes") | Seeded |

Rule: a tab never shows another person's content obtained with a different person's token. Likes are the visitor's own likes; the posts inside them are public posts fetched with the visitor's token and shown only to the visitor.

## 6. Feature D: closer to X's UI, within the rules

What "mimic X" can mean here: layout, spacing, type scale, interaction patterns, tab behaviour, the compose box, the three-column shell, hover and pressed states, the pull-to-refresh feel on mobile. What it cannot mean (CLAUDE.md rule 2, and the Policy): X's logo as our logo, X's name in our name, the Chirp font, copied icons or assets.

Concrete list to close, in priority order, each a separate small PR with a screenshot pair (ours vs. a description of X's):
1. Profile header geometry: banner 3:1, avatar overlapping by half, name/handle/bio/meta line/counts spacing, Follow/Edit button placement (desktop and mobile).
2. Tab bar: equal-width tabs on mobile, underline width = label width, scroll-snap when more than fit.
3. Post card: avatar size, name/handle/time line truncation, action row order and spacing, counts formatting (already compact), long-press/hover states.
4. Composer: inline "What's happening?" with the sound picker as one of the attachment icons, not a separate page, on desktop; full-screen sheet on mobile.
5. Left nav and right rail: items and order matching X's; our extra items (Governance, Audit, Proposal) grouped under "More" so the shell reads like X and our pages are still reachable.
6. Media tab grid and lightbox.
7. Motion: tab underline slide, like burst, sheet transitions, all under the existing reduced-motion gate.

Every one of these keeps the concept banner and the ⓘ affordances; none adds autoplaying anything.

## 7. Fallback if X login is not approved: bring your own profile, no API
If 2.4 says no, or the owner prefers zero X involvement: keep "Make it yours" as the way in, and add "import from your X archive" — the visitor downloads their own archive from X (Settings → Your account → Download an archive), drops `profile.js` and `tweets.js` on the page, and we parse them **in the browser**. Same tabs, same preview, no API, no cost, no server, no token, nothing leaves the tab. Slower for the visitor (X takes hours to prepare an archive) but the safest possible version. This can also be built first and kept forever as the no-login path.

## 8. GIPHY key (the owner has one)
- Do **not** paste it into chat, a commit, or an issue.
- Any key that a web page uses is visible to anyone who opens DevTools; GIPHY designs web keys for that and protects them with per-key rate limits. So the question is only *where it lives in our pipeline*, not whether the public can see it.
- Recommended: add it as a GitHub Actions secret named `GIPHY_API_KEY`; change the Pages deployment from "commit the built `sound-reactions/` folder" to a workflow that builds with `VITE_GIPHY_API_KEY=${{ secrets.GIPHY_API_KEY }}` and deploys with `actions/deploy-pages`. The key is then in the built bundle (as it must be) but never in the source tree or git history, and the owner can rotate it in one place. Until then the current "type your key into the header studio" path keeps working.
- Keep GIPHY's required attribution and the `rating=pg` filter as they are.

## 9. Build order and what the owner does

| Step | Who | What |
|---|---|---|
| 1 | Owner | Read the Developer Agreement, pricing page and Display Requirements in a browser; decide on 2.4. |
| 2 | Owner | Create the X developer app (pay-per-use). Use-case text: in 2.1. Add a redirect URL for the function. Set a monthly spend cap. |
| 3 | Owner | Put the client secret in the hosting dashboard; put the GIPHY key in GitHub Actions secrets. Tell the engineer *that* it is done, not *what* it is. |
| 4 | Engineer | Section 7 (archive import) or section 3 (function + sign-in), per step 1. Privacy policy page. Safety checklist 3.5. |
| 5 | Engineer | Section 5 tabs (works for both paths). |
| 6 | Engineer | Section 4 sound upload (local-only). |
| 7 | Engineer | Section 6 UI passes, one at a time. |
| 8 | Engineer | Section 8 Pages workflow. |

Estimates, roughly: step 4 with the archive path ≈ 1–2 days; with the API path ≈ 3–4 days plus X's app approval time; step 5 ≈ 1 day; step 6 ≈ 1–2 days; step 7 ≈ half a day per item; step 8 ≈ half a day.

## 10. Open questions for the owner
1. API path (section 3) or archive path (section 7) first? My recommendation: build 7 first regardless — it is safe, free and works today — then add 3 if the Agreement reading is clear.
2. Include the Likes tab (one extra scope and one extra call)?
3. Daily sign-in cap and monthly budget?
4. Hosting for the one function: Cloudflare or Vercel?
5. Is a short privacy policy on the proposal site acceptable, and whose contact goes on it?

## Handoff notes for Grok (or whoever builds)
Read `sound-reactions-src/CLAUDE.md` first; its rules are not negotiable. The prototype's behaviour is the spec for playback, scanning and labelling. Build the archive path (section 7) before the API path. Never log or persist tokens or X content. Never request a write scope. Keep the concept banner. Put the X mark only beside the signed-in handle. Do not add the GIPHY key or the X client secret to the repository; both arrive through the hosting platform's secret store. Add a test for every rule in checklist 3.5 that can be tested.
