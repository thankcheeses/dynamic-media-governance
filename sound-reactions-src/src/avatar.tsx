import type { CSSProperties, ReactNode } from 'react'

/**
 * Stable per-person avatar tint derived from initials. It shows behind the
 * portrait while it loads, and on its own for accounts without one, at a
 * lightness that keeps the dark initials above 7:1 contrast.
 */
export function avatarStyle(initials: string): CSSProperties {
  let hash = 0
  for (const char of initials) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return { background: `oklch(0.8 0.1 ${hash})`, color: '#0F1419' }
}

/**
 * Illustrated portraits for the fictional accounts, written by
 * scripts/generate-avatars.mjs. They are drawings, not photos. BB is the
 * prototype owner's own photo, supplied by her.
 */
const PORTRAITS: Record<string, string> = {
  BB: 'bb.jpg',
  MC: 'mc.svg',
  TM: 'tm.svg',
  AO: 'ao.svg',
  DC: 'dc.svg',
  AW: 'aw.svg',
  KV: 'kv.svg',
  JR: 'jr.svg',
  SO: 'so.svg',
  CN: 'cn.svg',
}

export function avatarSrc(initials: string): string | undefined {
  const file = PORTRAITS[initials]
  return file ? `${import.meta.env.BASE_URL}avatars/${file}` : undefined
}

/**
 * Portrait when one exists, otherwise the initials. Decorative: callers label
 * the person. A visitor's own photo (see src/identity.ts) takes precedence.
 */
export function avatarContent(initials: string, photo?: string): ReactNode {
  const src = photo ?? avatarSrc(initials)
  return src ? <img src={src} alt="" width={40} height={40} decoding="async" /> : initials
}
