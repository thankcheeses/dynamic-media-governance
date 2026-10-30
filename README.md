# Dynamic Media Governance

An independent policy proposal for how a social platform such as X could safely ship animated ("dynamic") profile headers. It is not affiliated with, reviewed by or commissioned by X.

**Live page:** https://thankcheeses.github.io/dynamic-media-governance/

**Sound Reactions prototype:** https://thankcheeses.github.io/dynamic-media-governance/sound-reactions/ (an X-style feed with dynamic GIF profile headers, sound reactions and a header studio that scans GIF or video uploads in your browser)

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

## GIPHY search in the prototype

The header studio can search GIPHY. GIPHY licenses its GIFs for display in apps through its API, so the prototype searches GIPHY rather than copying GIFs into this repository. To use it:

1. Create a free app at https://developers.giphy.com/dashboard/ and copy its API key.
2. Open the prototype, go to Profile → Edit profile, paste the key under **Search GIPHY** and select **Save key**.

The key is saved only in that browser. Every GIF you pick is scanned for flashing before it can play, and nothing is published or stored anywhere.

To let every visitor search without entering a key, build with `VITE_GIPHY_API_KEY=<key>`. The key is then visible to anyone who views the page source. That is normal for GIPHY keys, but keep the key on GIPHY's free beta tier, which is rate-limited.

## Limits

One person wrote this proposal. It is not legal advice, and it describes no feature X has shipped.

## Author

Brianna Baynard · [LinkedIn](https://www.linkedin.com/in/brianna-baynard)
