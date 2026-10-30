import type { CSSProperties } from 'react'

/**
 * Stable per-person avatar tint derived from initials. Fictional accounts have
 * no photos, so each gets its own hue at a fixed lightness that keeps the dark
 * initials above 7:1 contrast.
 */
export function avatarStyle(initials: string): CSSProperties {
  let hash = 0
  for (const char of initials) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return { background: `oklch(0.8 0.1 ${hash})`, color: '#0F1419' }
}
