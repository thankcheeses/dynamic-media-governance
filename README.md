# Dynamic Media Governance

An independent policy proposal for how a social platform such as X could safely ship animated ("dynamic") profile headers. It is not affiliated with, reviewed by or commissioned by X.

**Live page:** https://thankcheeses.github.io/dynamic-media-governance/

**Sound reactions prototype:** https://thankcheeses.github.io/dynamic-media-governance/sound-reactions/

## What it covers

- Screening uploads for photosensitive-seizure risk before they go live, using the WCAG 2.2 general flash and red flash thresholds
- Reducing abuse with technical guardrails and identity-linked accountability
- Mapping to the EU Digital Services Act (Articles 16, 17, 20, 34 and 35), the EU AI Act (Article 50) and the NIST Privacy Framework

## Repository layout

- `index.html`: the proposal page
- `sound-reactions/`: the built sound reactions concept prototype, served by GitHub Pages
- `sound-reactions-src/`: the prototype's source (Vite, React, TypeScript). Its `CLAUDE.md` lists the product rules. It is excluded from the Pages site by `_config.yml`.

To rebuild the prototype after changing its source:

```bash
cd sound-reactions-src
npm ci
VITE_HASH_ROUTER=1 npx vite build --base ./ --outDir ../sound-reactions --emptyOutDir
```

The sound files are already in `sound-reactions-src/public/audio`. Regenerating them needs your own ElevenLabs key in `.env.local`, which is never committed.

## Limits

One person wrote this proposal. It is not legal advice, and it describes no feature X has shipped.

## Author

Brianna Baynard · [LinkedIn](https://www.linkedin.com/in/brianna-baynard)
