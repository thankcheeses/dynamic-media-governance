import { animate, stagger } from 'animejs'
import { useAppStore } from './store'

/**
 * Single owner for UI motion. Every animation in the app goes through here so
 * reduced motion (OS setting or the in-app toggle) is honored in one place, and
 * each element property has exactly one animator (anime.js), never CSS + JS at once.
 * Easing follows the house rule: exponential ease-out, no bounce or elastic.
 */
export function motionAllowed(): boolean {
  if (useAppStore.getState().settings.reducedMotion) return false
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Target = Element | Element[] | NodeListOf<Element> | null | undefined

function ok(target: Target): target is Element | Element[] | NodeListOf<Element> {
  if (!target) return false
  if (target instanceof Element) return true
  return target.length > 0
}

/** Like / bookmark press: a quick scale pop on the icon. 300 ms total. */
export function popIcon(target: Target) {
  if (!ok(target) || !motionAllowed()) return
  animate(target, {
    scale: [{ to: 1.28, duration: 120, ease: 'outQuart' }, { to: 1, duration: 180, ease: 'outExpo' }],
  })
}

/** Like burst: a ring that expands and fades behind the heart. */
export function burstRing(target: Target) {
  if (!ok(target) || !motionAllowed()) return
  animate(target, {
    scale: [{ from: 0.4, to: 1.6 }],
    opacity: [{ from: 0.55, to: 0 }],
    duration: 420,
    ease: 'outExpo',
  })
}

/** Count change: the number slides in from the direction it moved. */
export function rollCount(target: Target, direction: 1 | -1) {
  if (!ok(target) || !motionAllowed()) return
  animate(target, {
    translateY: [{ from: `${direction * 60}%`, to: '0%' }],
    opacity: [{ from: 0, to: 1 }],
    duration: 260,
    ease: 'outExpo',
  })
}

/**
 * Staggered entrance for a set of siblings (reaction picker tiles, new posts).
 * Content is visible by default; this only animates from an offset, so if the
 * animation never runs (hidden tab, headless capture) nothing ships blank.
 */
export function staggerIn(targets: Target, { distance = 10, gap = 35 }: { distance?: number; gap?: number } = {}) {
  if (!ok(targets) || !motionAllowed()) return
  animate(targets, {
    translateY: [{ from: distance, to: 0 }],
    opacity: [{ from: 0, to: 1 }],
    duration: 320,
    delay: stagger(gap),
    ease: 'outExpo',
  })
}

/** Sheet / dialog entrance: rises a short distance and fades in. */
export function riseIn(target: Target, distance = 24) {
  if (!ok(target) || !motionAllowed()) return
  animate(target, {
    translateY: [{ from: distance, to: 0 }],
    opacity: [{ from: 0, to: 1 }],
    duration: 300,
    ease: 'outExpo',
  })
}

let burstLayer: HTMLDivElement | null = null
function layer(): HTMLDivElement {
  if (burstLayer && document.body.contains(burstLayer)) return burstLayer
  burstLayer = document.createElement('div')
  burstLayer.className = 'x-burst-layer'
  burstLayer.setAttribute('aria-hidden', 'true')
  document.body.appendChild(burstLayer)
  return burstLayer
}

/**
 * Emoji confetti from an element's center: a handful of copies arc up and out,
 * spin a little and fade. Small, short (≤ 900 ms) and transform/opacity only,
 * so no flashing. Decorative: the burst layer is aria-hidden and removed after.
 */
export function emojiBurst(origin: Element | null | undefined, emoji: string, count = 7) {
  if (!origin || !motionAllowed()) return
  const box = origin.getBoundingClientRect()
  const host = layer()
  const cx = box.left + box.width / 2
  const cy = box.top + box.height / 2
  const pieces: HTMLSpanElement[] = []
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span')
    piece.className = 'x-burst-piece'
    piece.textContent = emoji
    piece.style.left = `${cx}px`
    piece.style.top = `${cy}px`
    host.appendChild(piece)
    pieces.push(piece)
  }
  pieces.forEach((piece, i) => {
    // Fan across the upper half-circle with a little randomness.
    const angle = Math.PI + (Math.PI * (i + 0.5)) / count + (Math.random() - 0.5) * 0.35
    const distance = 46 + Math.random() * 34
    animate(piece, {
      // Centering lives in the CSS `translate` property; anime only moves the offset.
      translateX: [{ from: 0, to: Math.cos(angle) * distance }],
      translateY: [{ from: 0, to: Math.sin(angle) * distance - 18 }],
      scale: [{ from: 0.4, to: 1.15, duration: 260, ease: 'outBack(2)' }, { to: 0.7, duration: 560, ease: 'inQuad' }],
      rotate: [{ from: 0, to: (Math.random() - 0.5) * 70 }],
      opacity: [{ from: 1, to: 1, duration: 420 }, { to: 0, duration: 400, ease: 'inQuad' }],
      duration: 820,
      ease: 'outExpo',
      onComplete: () => piece.remove(),
    })
  })
}

/** Soundboard pad press: a short squish and rebound, like a hardware pad. */
export function padPress(target: Target) {
  if (!ok(target) || !motionAllowed()) return
  animate(target, {
    scale: [{ to: 0.93, duration: 90, ease: 'outQuad' }, { to: 1, duration: 300, ease: 'outBack(1.8)' }],
  })
}

/** A reaction pill that just landed on a post: pops in and settles. */
export function landPill(target: Target) {
  if (!ok(target) || !motionAllowed()) return
  animate(target, {
    scale: [{ from: 0.6, to: 1.08, duration: 260, ease: 'outBack(2.2)' }, { to: 1, duration: 220, ease: 'outQuad' }],
    opacity: [{ from: 0, to: 1, duration: 160 }],
  })
}

/** Post that should celebrate a just-added reaction when its chip next renders. */
let pendingLanding: string | null = null
export function markLanding(postId: string) { pendingLanding = postId }
export function takeLanding(postId: string): boolean {
  if (pendingLanding !== postId) return false
  pendingLanding = null
  return true
}
