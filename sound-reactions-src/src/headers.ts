/**
 * Dynamic (animated) profile headers, governed by the Dynamic Media Governance
 * framework: technical guardrails at upload, then a Photosensitive Epilepsy
 * Analysis (PEA) against the WCAG 2.2 general and red flash thresholds.
 *
 * Three kinds of header are measured. The owner's own picks are real GIFs that
 * play straight from their host (GIPHY or Tenor) and were measured by
 * scripts/analyze-header.py on the owner's copy of each clip. The rendered
 * headers are GIFs made with three.js (scripts/render-header.mjs) and measured
 * the same way; their numbers come from src/header-manifest.json. The other
 * presets stand in for uploads that fail in different ways, and their flash
 * counts are fixture values. Files a viewer uploads are measured in the browser
 * (src/analyze.ts). The UI labels which is which.
 */
import manifest from './header-manifest.json'

export type HeaderStyle = 'video' | 'upload' | 'aurora' | 'waves' | 'confetti' | 'strobe' | 'redpulse' | 'timelapse'
export type HeaderDecision = 'PASS' | 'PROVISIONAL' | 'BLOCK' | 'REJECTED'

/** A GIF that plays from its host and is never copied into the repository. */
export interface HostedHeader {
  provider: 'GIPHY' | 'Tenor'
  /** The GIF's page on the host, for attribution. */
  pageUrl: string
  mp4: string
  webm?: string
  /** The GIF itself, fetched for an in-browser scan. */
  gif?: string
  /** A still frame, when the host serves one. */
  still?: string
}

export interface HeaderPreset {
  id: string
  name: string
  /** Visible text alternative, also used as the canvas label. */
  description: string
  style: HeaderStyle
  fps: number
  loopSeconds: number
  sizeMB: number
  /** Highest count of general flashes in any one-second window (fixture). */
  flashesPerSecond: number
  /** Whether any flash is a saturated-red transition (fixture). */
  redFlash: boolean
  /** Largest share of the frame (0–1) that changes in a single flash transition. */
  flashArea?: number
  /** Real media files under public/headers, for presets backed by an actual GIF. */
  media?: { gif: string; webm: string; poster: string }
  /** A GIF served by GIPHY or Tenor, for the owner's own picks. */
  hosted?: HostedHeader
  /** True when the numbers were measured from the file rather than set as fixtures. */
  measured?: boolean
  /** A GIF the owner supplied and chose to keep in the repository, rather than a rendered one. */
  ownerFile?: boolean
  /**
   * True for a hosted GIF with no measurements yet: the viewer's browser fetches
   * and scans it before it is allowed to play (src/hostedScan.ts).
   */
  scanInBrowser?: boolean
}

export interface HeaderCheck {
  key: 'size' | 'fps' | 'loop' | 'flash' | 'red'
  label: string
  pass: boolean
  detail: string
}

export interface HeaderScan {
  decision: HeaderDecision
  checks: HeaderCheck[]
  summary: string
}

/** Framework limits (section 03.1 and 03.2 of the proposal). */
export const HEADER_LIMITS = {
  sizeMB: 8,
  fps: 15,
  loopSeconds: 10,
  flashesPerSecond: 3,
  /** At or above this the flashing is severe at any size and hard-blocked. */
  severeFlashesPerSecond: 10,
  /** Over-limit flashing that covers at least this share of the header is also severe. */
  severeFlashArea: 0.25,
}

const MEASURED_COPY: Record<string, { name: string; description: string; ownerFile?: boolean }> = {
  'clay-orbit': { name: 'Clay orbit', description: 'A clay-colored faceted sphere turning slowly inside a wireframe shell, with two thin orbits and small drifting shapes, on a dark warm background.' },
  'sea-glass': { name: 'Sea glass', description: 'A sea-green knot turning slowly inside a wireframe shell, with two thin orbits, on a deep teal background.' },
  'violet-hour': { name: 'Violet hour', description: 'A lavender crystal turning slowly inside a wireframe shell, with two thin orbits, on a dark violet background.' },
  moss: { name: 'Moss', description: 'A moss-green faceted stone turning slowly inside a wireframe shell, with two thin orbits, on a dark green background.' },
  citrus: { name: 'Citrus', description: 'An amber faceted sphere turning slowly inside a wireframe shell, with two thin orbits, on a dark gold background.' },
  'neon-cats': { name: 'Neon cats', description: 'Cats in glowing neon colours leaping across a black background, from a 1998 Purina commercial.', ownerFile: true },
}

const MEASURED: HeaderPreset[] = manifest.map((m) => ({
  id: m.id, ...(MEASURED_COPY[m.id] ?? { name: m.id, description: 'A rendered dynamic header.' }),
  style: 'video' as const, fps: m.fps, loopSeconds: m.loopSeconds, sizeMB: m.sizeMB,
  flashesPerSecond: m.flashesPerSecond, redFlash: m.redFlash, flashArea: m.flashArea,
  media: { gif: `headers/${m.id}.gif`, webm: `headers/${m.id}.webm`, poster: `headers/${m.id}.jpg` },
  measured: true,
})).sort((a, b) => (a.id === 'clay-orbit' ? -1 : b.id === 'clay-orbit' ? 1 : 0))

// GIPHY serves media only at the signed paths it publishes for a GIF; the plain
// media.giphy.com/media/<id>/ form redirects to the GIF's web page.
function giphy(base: string, pageUrl: string): HostedHeader {
  return { provider: 'GIPHY', pageUrl, mp4: `${base}giphy.mp4`, gif: `${base}giphy.gif`, still: `${base}giphy_s.gif` }
}
const GIPHY_JELLYFISH = 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeWdlYnVkYnNjZjR2ajg5dGdobnVuMnI5dHUwcTZ4bDcwNW93cnduNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/rdXF0gnAyUAfK/'

/** A hosted GIF nobody has measured yet. Its numbers arrive from the viewer's own scan. */
function unscanned(preset: Pick<HeaderPreset, 'id' | 'name' | 'description' | 'hosted'>): HeaderPreset {
  return { ...preset, style: 'video', fps: 0, loopSeconds: 0, sizeMB: 0, flashesPerSecond: 0, redFlash: false, scanInBrowser: true }
}

/**
 * GIFs picked for the fictional accounts, one per corner of the timeline. They
 * play from GIPHY and are scanned in the viewer's browser before they animate.
 */
const PICKED: HeaderPreset[] = [
  unscanned({ id: 'sage-cleanse', name: 'Sage cleanse', description: 'A woman in black waving a smoking bundle of sage above her head, clearing the air.',
    hosted: giphy('https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjI0cGdoY2I2amVtYWJybGFxMmV2enB6ZjR4NXFnOGdqbWVjdGE2bCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/zcXVdsykoJ2GvHdWqw/', 'https://giphy.com/gifs/ryndean-sage-cleanse-incense-zcXVdsykoJ2GvHdWqw') }),
  unscanned({ id: 'garifuna-cooking', name: 'Grandmother’s kitchen', description: 'Hands stirring a pot of Garifuna machuca over the caption “I learned to cook watching my grandmother, my mom, my aunts”.',
    hosted: giphy('https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExemV4eTlxNTU3OXV0ZGd5cGszcXJzdmdyaWY5OGxieDhnc2prbDJrNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/UtscVw1JGFrsOSLlGV/', 'https://giphy.com/gifs/cooking-black-woman-soul-food-UtscVw1JGFrsOSLlGV') }),
  unscanned({ id: 'code-loop', name: 'Code scrolling', description: 'JavaScript scrolling up a dark editor in a seamless loop.',
    hosted: giphy('https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExMThmejBlb3hpZWV3c2drendnYjc2OHFwdW81bm53bndnczd6d3k2eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT9IgzoKnwFNmISR8I/', 'https://giphy.com/gifs/code-coding-seamless-xT9IgzoKnwFNmISR8I') }),
  unscanned({ id: 'ml-training', name: 'Training', description: 'Orange nodes of a small neural network linking up on a dark grid under the word “Training”.',
    hosted: giphy('https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExYzdxNDBiNW9kdzk4b2dueGIzMHk3N2p3NmF0NnZ4ZHo2dHVlYjRydSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/nRutofER2qASM0dhKH/', 'https://giphy.com/gifs/TEAMAF-training-machine-learning-neural-network-nRutofER2qASM0dhKH') }),
  unscanned({ id: 'kg-right-now', name: 'Right now!', description: 'Kevin Garnett grinning and shouting “Right now!” on a Showtime basketball set.',
    hosted: giphy('https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZnFucmhtMHJ3MTZuZXNpYnRid29nN3hmbzR1NThmNmxnaWhxaWRkOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/EKX8Iem846jWhOHMkX/', 'https://giphy.com/gifs/showtimesports-lets-go-kg-kevin-garnett-EKX8Iem846jWhOHMkX') }),
]

/**
 * The owner's own GIF picks. Each plays from its host and is credited there;
 * nothing is copied into the repository. The measurements were taken by
 * scripts/analyze-header.py on the owner's copy of the same clip.
 */
const HOSTED: HeaderPreset[] = [
  {
    id: 'jellyfish-strut', name: 'Jellyfish strut', description: 'SpongeBob strutting across a green room while a jellyfish floats beside him, from the Jellyfish Jam scene.',
    style: 'video', fps: 14.29, loopSeconds: 1.33, sizeMB: 0.48, flashesPerSecond: 1, redFlash: false, flashArea: 0.87, measured: true,
    hosted: giphy(GIPHY_JELLYFISH, 'https://giphy.com/gifs/dancing-spongebob-squarepants-jellyfish-jam-rdXF0gnAyUAfK'),
  },
  {
    id: 'spongebob-computer', name: 'SpongeBob at the computer', description: 'A worried SpongeBob typing at an old beige computer in a red room.',
    style: 'video', fps: 16.67, loopSeconds: 1.92, sizeMB: 0.71, flashesPerSecond: 0, redFlash: false, flashArea: 0.4, measured: true,
    hosted: { provider: 'Tenor', pageUrl: 'https://tenor.com/view/spongebob-computer-fire-gif-21352118', mp4: 'https://media.tenor.com/tWD3GjJcoHgAAAPo/spongebob-computer.mp4', webm: 'https://media.tenor.com/tWD3GjJcoHgAAAPs/spongebob-computer.webm', gif: 'https://media1.tenor.com/m/tWD3GjJcoHgAAAAC/spongebob-computer.gif' },
  },
  {
    id: 'paid-in-full', name: 'Making it rain', description: 'Rico from Paid in Full tossing cash into the air in a packed club.',
    style: 'video', fps: 20, loopSeconds: 1.5, sizeMB: 1.73, flashesPerSecond: 1, redFlash: false, flashArea: 0.18, measured: true,
    hosted: { provider: 'Tenor', pageUrl: 'https://tenor.com/view/money-rico-paid-raining-money-gif-5009446', mp4: 'https://media.tenor.com/YTe7HLNWvAQAAAPo/money-rico.mp4', webm: 'https://media.tenor.com/YTe7HLNWvAQAAAPs/money-rico.webm', gif: 'https://media1.tenor.com/m/YTe7HLNWvAQAAAAC/money-rico.gif' },
  },
  ...PICKED,
]

export const HEADER_PRESETS: HeaderPreset[] = [
  ...HOSTED,
  ...MEASURED,
  { id: 'slow-waves', name: 'Slow waves', description: 'Thin lines rolling gently like a calm sea.', style: 'waves', fps: 12, loopSeconds: 10, sizeMB: 1.4, flashesPerSecond: 0, redFlash: false },
  { id: 'confetti', name: 'Confetti pop', description: 'Confetti bursts with quick bright pops.', style: 'confetti', fps: 15, loopSeconds: 6, sizeMB: 3.2, flashesPerSecond: 4, redFlash: false, flashArea: 0.08 },
  { id: 'strobe', name: 'Strobe party', description: 'Black and white strobe at club speed.', style: 'strobe', fps: 15, loopSeconds: 4, sizeMB: 2.6, flashesPerSecond: 12, redFlash: false, flashArea: 1 },
  { id: 'red-pulse', name: 'Red alert pulse', description: 'A saturated red light pulsing on and off.', style: 'redpulse', fps: 15, loopSeconds: 5, sizeMB: 1.9, flashesPerSecond: 5, redFlash: true, flashArea: 0.6 },
  { id: 'timelapse', name: 'City timelapse', description: 'A long, high-frame-rate city timelapse.', style: 'timelapse', fps: 30, loopSeconds: 18, sizeMB: 11.4, flashesPerSecond: 1, redFlash: false },
]

export const DEFAULT_HEADER_ID = 'jellyfish-strut'

export function headerPreset(id: string): HeaderPreset {
  return HEADER_PRESETS.find((preset) => preset.id === id) ?? HEADER_PRESETS[0]
}

/** Measurements for a header, whether a preset or a file a viewer uploaded. */
export interface HeaderMeasurement {
  fps: number
  loopSeconds: number
  sizeMB: number
  flashesPerSecond: number
  redFlash: boolean
  /** Largest share of the frame (0–1) that changes in a single flash transition. */
  flashArea?: number
}

/**
 * Size and loop length are hard guardrails: a file over either is rejected at
 * upload. Frame rate is not: every upload is transcoded to WebM anyway, so a
 * file above the cap is transcoded down to it (ordinary GIFs often run at
 * 16–25 fps). Files that clear the guardrails get the PEA, measured on the
 * original frames. Severe flashing is hard-blocked: any red flash, 10 or more
 * flashes a second, or over-limit flashing across a quarter or more of the
 * header. Smaller over-limit flashing is published provisionally behind a
 * warning label with a 24-hour manual review, and anything else passes.
 */
export function scanHeader(m: HeaderMeasurement): HeaderScan {
  const L = HEADER_LIMITS
  const transcoded = m.fps > L.fps
  const checks: HeaderCheck[] = [
    { key: 'size', label: 'File size', pass: m.sizeMB <= L.sizeMB, detail: `${m.sizeMB} MB (limit ${L.sizeMB} MB)` },
    { key: 'loop', label: 'Loop length', pass: m.loopSeconds <= L.loopSeconds, detail: `${m.loopSeconds} s (limit ${L.loopSeconds} s)` },
    { key: 'fps', label: 'Frame rate', pass: true, detail: transcoded ? `${m.fps} fps, transcoded down to ${L.fps} fps` : `${m.fps} fps (limit ${L.fps} fps)` },
    { key: 'flash', label: 'General flash', pass: m.flashesPerSecond <= L.flashesPerSecond, detail: `${m.flashesPerSecond} per second (limit ${L.flashesPerSecond})${m.flashesPerSecond > L.flashesPerSecond && m.flashArea !== undefined ? `, across ${Math.round(m.flashArea * 100)}% of the header` : ''}` },
    { key: 'red', label: 'Red flash', pass: !m.redFlash, detail: m.redFlash ? 'Saturated red flashes found' : 'No saturated red flashes' },
  ]

  if (checks.some((check) => (check.key === 'size' || check.key === 'loop') && !check.pass)) {
    return { decision: 'REJECTED', checks, summary: `Rejected at upload. Headers must be ${L.sizeMB} MB or less and loop in ${L.loopSeconds} seconds or less.` }
  }
  const overLimit = m.flashesPerSecond > L.flashesPerSecond
  // Unknown area is treated as full-frame: the safe assumption.
  const largeArea = (m.flashArea ?? 1) >= L.severeFlashArea
  if (m.redFlash || m.flashesPerSecond >= L.severeFlashesPerSecond || (overLimit && largeArea)) {
    return { decision: 'BLOCK', checks, summary: 'Hard block. The flashing is severe enough to risk seizures, so this header cannot be published.' }
  }
  if (overLimit) {
    return { decision: 'PROVISIONAL', checks, summary: 'Published provisionally behind a photosensitivity warning. A person reviews it within 24 hours.' }
  }
  return { decision: 'PASS', checks, summary: transcoded ? `Passed. It will play at ${L.fps} fps.` : 'Passed. The header can play.' }
}

/** Only PASS and PROVISIONAL headers can be live on a profile. */
export function isPublishable(decision: HeaderDecision): boolean {
  return decision === 'PASS' || decision === 'PROVISIONAL'
}
