/**
 * The one rule table for motion: when UI micro-motion may run, when a dynamic
 * header may play, and what the banner says about it. `src/motion.ts`,
 * `DynamicHeader` and `SoundOrb` all read it, so the settings each one honours
 * cannot drift apart. The DOM signals (intersection, scroll, tab visibility)
 * are gathered by a thin hook in the player and passed in.
 */
import { useEffect, useState } from 'react'
import type { HeaderDecision, HeaderStyle } from './headers'
import type { AppSettings } from './types'

const QUERY = '(prefers-reduced-motion: reduce)'

/** The operating-system preference: true, false, or null when the browser cannot say (tests, no matchMedia). */
export function osReducedMotion(): boolean | null {
  if (typeof window === 'undefined' || !window.matchMedia) return null
  return window.matchMedia(QUERY).matches
}

export function usePrefersReducedMotion(): boolean | null {
  const [reduced, setReduced] = useState(osReducedMotion)
  useEffect(() => {
    const query = window.matchMedia?.(QUERY)
    if (!query) return
    const update = () => setReduced(query.matches)
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return reduced
}

/** Reduced motion is on when either the in-app toggle or the OS says so. */
export const reduceMotion = (settings: Pick<AppSettings, 'reducedMotion'>, os: boolean | null) => settings.reducedMotion || os === true

/** anime.js micro-motion (pops, bursts, staggers). It also needs a real browser: no query, no motion. */
export const uiMotionAllowed = (settings: Pick<AppSettings, 'reducedMotion'>, os: boolean | null) => os !== null && !reduceMotion(settings, os)

/** Continuous decorative motion (the title orb): also off under low power and data saver. */
export const richMotionAllowed = (settings: Pick<AppSettings, 'reducedMotion' | 'lowPower' | 'dataSaver'>, os: boolean | null) =>
  uiMotionAllowed(settings, os) && !settings.lowPower && !settings.dataSaver

/**
 * Only calm styles are ever animated. Styles that flash are drawn as a single
 * still frame everywhere: the prototype never puts flashing content on screen.
 * The confetti style animates as a slow, non-flashing stand-in once a viewer
 * chooses to play it past its warning label.
 */
export const ANIMATABLE: HeaderStyle[] = ['video', 'upload', 'aurora', 'waves', 'confetti']

export interface HeaderPlaybackInput {
  style: HeaderStyle
  fps: number
  decision: HeaderDecision
  settings: Pick<AppSettings, 'reducedMotion' | 'lowPower' | 'dataSaver'>
  osReduced: boolean | null
  warningAccepted: boolean
  userPaused: boolean
  inView: boolean
  scrolling: boolean
  hidden: boolean
}

export interface HeaderPlayback {
  /** Why only a still frame is drawn, or null when the header may move. */
  stillReason: string | null
  /** A provisional header waits behind its warning until the viewer plays it. */
  gated: boolean
  running: boolean
  /** The "Right now" line in the ⓘ panel. */
  status: string
  /** Whether the banner offers the pause button. */
  canPause: boolean
}

/** Rule 14 as one table: still reasons first, then the gate, then the viewer's and the page's pauses. */
export function headerPlayback(input: HeaderPlaybackInput): HeaderPlayback {
  const { style, fps, decision, settings, osReduced, warningAccepted, userPaused, inView, scrolling, hidden } = input
  const stillReason = !ANIMATABLE.includes(style) ? 'Still frame only'
    : reduceMotion(settings, osReduced) ? 'Still frame: reduced motion is on'
    : settings.lowPower ? 'Still frame: low-power mode is on'
    : settings.dataSaver ? 'Still frame: data saver is on'
    : null
  const gated = decision === 'PROVISIONAL' && !warningAccepted
  const running = !stillReason && !gated && !userPaused && inView && !scrolling && !hidden
  const status = gated ? 'Waiting behind its warning label'
    : stillReason ? stillReason.replace('Still frame: ', 'Showing a still frame because ')
    : userPaused ? 'Paused by you'
    : hidden ? 'Paused because the tab is hidden'
    : !inView ? 'Paused because it is off-screen'
    : scrolling ? 'Paused while you scroll'
    : `Playing at up to ${Math.min(fps, 15)} fps`
  return { stillReason, gated, running, status, canPause: !stillReason && !gated }
}
