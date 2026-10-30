# Sources and Evidence Register

Accessed or rechecked October 25, 2026 unless noted. Product claims in the app distinguish documented history, design targets, new proposals and hypotheses.

## Framework and accessibility

1. **Dynamic Media Governance Framework v2.1** — source page reviewed during the build. Its inverted red-flash expression and legal mappings were corrected rather than treated as requirements.  
   https://thankcheeses.github.io/dynamic-media-governance/
2. **W3C, Understanding SC 2.3.1: Three Flashes or Below Threshold** — three-flash/area wording and saturated-red `≥0.8` plus `>0.2` chromaticity condition.  
   https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
3. **W3C, Understanding SC 1.4.2: Audio Control** — no-autoplay design reference.  
   https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html
4. **W3C, Understanding SC 1.2.1: Audio-only and Video-only (Prerecorded)** — text-alternative design reference.  
   https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html
5. **W3C, WCAG 2.2** — keyboard, focus visible and target-size minimum criteria.  
   https://www.w3.org/TR/WCAG22/
6. **Chrome autoplay policy** — gesture-gated media behavior.  
   https://developer.chrome.com/blog/autoplay
7. **AES TD1008** — loudness target reference supplied in the build brief. The app explicitly documents approximation rather than measurement. Bibliographic reference: AES Technical Document TD1008, “Loudness Guidelines for OTT and OVD Content.”

## Regulatory design references

8. **U.S. Department of Justice / Federal Register, April 20, 2026** — Title II large-entity compliance date extended from April 24, 2026 to April 26, 2027; scope is state/local government entities.  
   https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web
9. **European Union, Digital Services Act (Regulation 2022/2065)** — Arts. 16, 17, 20, 27, 34 and 35.  
   https://eur-lex.europa.eu/eli/reg/2022/2065/oj
10. **European Union, AI Act (Regulation 2024/1689)** — Art. 50 transparency reference; no Art. 14 claim is made for this moderation prototype.  
    https://eur-lex.europa.eu/eli/reg/2024/1689/oj
11. **Morgan Lewis, AI Act Article 50 transparency from August 2, 2026** — secondary legal commentary listed in the supplied research brief. It is not used as the sole authority for a legal conclusion.

## Documented Twitter/X audio history

12. **Twitter, “Your Tweet, your voice,” June 17, 2020** — iOS voice tweets, 140-second clips and auto-threading.  
    https://blog.x.com/en_us/topics/product/2020/your-tweet-your-voice
13. **Engadget, July 15, 2021** — automated captions added to voice tweets after accessibility criticism; new voice tweets only. Bibliographic reference supplied in the build brief.
14. **Twitter, “Designing accessible sounds: The story behind our new chirps,” 2022** — neurodivergent research/usability input and Sound effects toggle.  
    https://blog.x.com/en_us/topics/product/2022/designing-accessible-sounds-story-behind-our-new-chirps
15. **TechCrunch, “X brings back Voice Notes to X Chat,” April 9, 2026** — voice notes returned to DMs and group chats; public voice posts may no longer exist.  
    https://techcrunch.com/2026/04/09/x-brings-back-voice-notes-to-x-chat/
16. **GIGAZINE, voice-post removal around March 2025** — secondary report listed in the brief; treated as unconfirmed and not asserted in the slide history.

No documented Twitter/X sound-reaction feature was substantiated by the supplied research. The prototype does not claim one existed.

## Interface evidence boundary

The unauthenticated `https://x.com/` page was reachable only as a login screen, not the timeline. Layout dimensions, post anatomy and color values in the brief were therefore implemented as starting approximations, not verified X design tokens. No X assets were copied.

## Verification evidence

Project-generated evidence, not external research:

- `test-results/playwright.json` — browser test output.
- `test-results/lighthouse.json` — production Lighthouse accessibility result.
- `test-results/capture-report.json` — screenshot, console, HTTP, overflow and all-view axe results.
- `screenshots/` — 16 desktop/mobile PNG captures.
