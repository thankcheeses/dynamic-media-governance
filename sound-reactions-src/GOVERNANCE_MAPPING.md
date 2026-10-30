# Governance Mapping — Dynamic Media Governance v2.1 Adaptation

This is an independent design mapping, not a legal opinion, compliance claim or certification. The prototype reuses the framework’s pipeline structure while correcting its citations and removing video-only/disproportionate controls.

## Corrections applied

| Area | Published v2.1 issue | Prototype correction |
|---|---|---|
| Saturated red | Uses `R/(R+G+B) < 0.8` | WCAG 2.2 uses `≥ 0.8` with a chromaticity change `> 0.2` in CIE 1976 UCS. The app uses non-strobing transform-only bars and reduced motion rather than claiming a full PEA analysis. |
| Flash threshold | “≤3 per second” without the complete criterion | WCAG 2.3.1 says no more than three flashes in any one-second period, or below general/red flash thresholds, including the area clause. This app stays below three as a conservative design default. |
| ADA | Title II framed as an X safe harbor/deadline | Title II applies to state/local government entities, not X. WCAG 2.2 AA is the design target. No Title II safe-harbor claim is made. |
| DSA | Arts. 27/34 mapped to PEA | Art. 27 is recommender transparency. Reports/decisions map to Arts. 16, 17 and 20; systemic-risk work maps to Arts. 34/35. |
| EU AI Act | Art. 14 human oversight implied | No Art. 14 obligation is claimed for content moderation. Art. 50 informs AI-generated/cloned-audio labels. Human review is a design choice. |
| Affiliation | “Prepared for X Trust & Safety” | Relabeled “Independent proposal.” No X affiliation. |
| Video controls | 8 MB, 15 fps, 10 s loop | Not applied to audio. Reactions use proposed 256 KB / 8 s defaults; no frame-rate limit. |
| Biometric anchor | Identity-linked accountability | Not applied; disproportionate for an 8-second reaction concept. |

The following are treated as **unsourced design proposals, not facts**: 10–20 s scan time, 24 h review SLA, 60–80% WebM savings, <0.5% complaint gate and strike durations. They are not used as requirements or benchmark claims.

## Control provenance

| Control | Origin | Implementation |
|---|---|---|
| Pre-publication gate | Framework 03.1, reused | Eight deterministic checks run before local publishing. |
| Provisional publish + review | Framework 03.1, reused with a conservative choice | REVIEW holds rather than publishing; severe configured failures BLOCK. Approval can subsequently publish a held item. |
| Flash safety | Framework 03.1, adapted | Applies only to waveform/visualizer animation. Audio itself cannot flash. |
| Auto-pause | Framework 03.2, adapted | Scroll-away, hidden tab and explicit low-power toggle stop playback. |
| Phased rollout | Framework 04, adapted | Internal → opt-in pilot → evaluation → expansion with proposed launch/rollback criteria. |
| No autoplay | WCAG 1.4.2 and browser autoplay policy | AudioContext/media playback begins only in click/key handlers. |
| Text alternative | WCAG 1.2.1 | Every clip has visible transcript or sound description and reaction emoji/text equivalent. |
| Keyboard/focus/target | WCAG 2.1.1, 2.4.7, 2.5.8 | Keyboard controls, visible focus, minimum target design and automated checks. |
| Loudness | AES TD1008 design reference | Targets −18 LUFS speech / −16 music and −1 dBTP ceiling; implementation is only a documented gain approximation. |
| Reaction duration / size | New proposal | Editable 8 s / 256 KB defaults; not represented as legal requirements. |
| One active stream | New proposal | Global controller stops current Web Audio sources or media element before starting another. |
| Rate limit | New proposal | Configurable; default five per post/hour using local prior-hour submissions. |
| Reaction-specific report | DSA Arts. 16/17/20 design mapping | Notice, simulated reviewer action and statement of reasons. Complaint routing is conceptual. |
| AI voice label | EU AI Act Art. 50 design mapping | Required by preflight when AI generation is declared. |
| Biometric ID | Framework 03.3, deliberately not applied | None. |

## Pipeline and audit

`SUBMIT → PREFLIGHT → REVIEW IF FLAGGED → PUBLISH / HOLD / BLOCK → AUDIT`

Decisions include reason codes and the full check list. The UI exposes no audit edit/delete operation; JSON export preserves the current local event sequence. Resetting demo data is an explicit local-user action, not a moderation feature.

## Legal and operational boundary

This prototype does not establish that the proposed controls satisfy any statute or standard. Real deployment would require jurisdiction-specific counsel, measured media analysis, accessible manual testing, detector evaluation, reviewer capacity, appeals operations, security review and evidence-based rollout thresholds.
