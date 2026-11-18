# Dynamic Media Governance

Two things live here: the proposal page (`index.html`, served by GitHub Pages) and the
Sound Reactions prototype (`sound-reactions-src/`, built into `sound-reactions/`).
Rules for working on the prototype are in `sound-reactions-src/CLAUDE.md`; read them
before touching anything under that folder.

The proposal page is plain HTML with no build step, except its 3D hero: `assets/constellation.js` is
built from `sound-reactions-src/proposal/constellation.ts` with `npm run build:proposal` (run it in
`sound-reactions-src` and commit the output). Fonts are self-hosted in `fonts/` (OFL licences beside
them); the page fetches nothing from a font host. Colour follows the owner's link cards: violet for
the proposal, pink for Sound Reactions.

## Agent skills

### Issue tracker

Issues are tracked in this repo's GitHub Issues, driven with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, named as the skills name them (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.
