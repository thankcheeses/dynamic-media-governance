import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Info, Pause, Play } from 'lucide-react'
import { HeaderInfo } from './HeaderInfo'
import { useAppStore } from '../store'
import type { UploadedMedia } from '../analyze'
import type { HeaderDecision, HeaderPreset, HeaderStyle } from '../headers'

/**
 * Only calm styles are ever animated. Styles that flash are drawn as a single
 * still frame everywhere: the prototype never puts flashing content on screen.
 * The confetti style animates as a slow, non-flashing stand-in once a viewer
 * chooses to play it past its warning label.
 */
const ANIMATABLE: HeaderStyle[] = ['video', 'upload', 'aurora', 'waves', 'confetti']
const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`
const TAU = Math.PI * 2

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** Draws one frame. `p` runs 0→1 over the loop; every term repeats at p = 1 so loops are seamless. */
function drawHeader(ctx: CanvasRenderingContext2D, style: HeaderStyle, w: number, h: number, p: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  if (style === 'aurora') {
    ctx.fillStyle = '#120D14'; ctx.fillRect(0, 0, w, h)
    const colors = ['217,119,87', '142,59,70', '224,164,88', '91,58,110']
    ctx.globalCompositeOperation = 'screen'
    colors.forEach((c, i) => {
      const x = w * (0.5 + 0.38 * Math.sin(TAU * (p + i / 4)))
      const y = h * (0.5 + 0.32 * Math.sin(TAU * (2 * p + i * 0.37)))
      const r = Math.max(w, h) * 0.42
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(${c},0.55)`); g.addColorStop(1, `rgba(${c},0)`)
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    })
  } else if (style === 'waves') {
    ctx.fillStyle = '#0C1116'; ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 9; i++) {
      ctx.beginPath()
      for (let x = 0; x <= w; x += 6) {
        const y = h * (0.18 + 0.08 * i) + h * 0.06 * Math.sin((x / w) * TAU * 1.5 + TAU * p + i * 0.6)
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(${i % 2 ? '217,119,87' : '230,226,218'},${0.18 + i * 0.05})`
      ctx.lineWidth = 1.5; ctx.stroke()
    }
  } else if (style === 'confetti') {
    ctx.fillStyle = '#1A1220'; ctx.fillRect(0, 0, w, h)
    const palette = ['#E0A458', '#D97757', '#8FB3A8', '#C9B6E4', '#F2EFE7']
    for (let i = 0; i < 46; i++) {
      const x = rand(i + 1) * w
      const y = (((rand(i + 101) + p) % 1) * 1.2 - 0.1) * h
      ctx.save(); ctx.translate(x, y); ctx.rotate(TAU * (p + rand(i + 7)))
      ctx.fillStyle = palette[i % palette.length]; ctx.globalAlpha = 0.75
      ctx.fillRect(-4, -2, 8, 4); ctx.restore()
    }
  } else if (style === 'strobe') {
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#F5F5F5' : '#0A0A0A'; ctx.fillRect((w / 12) * i, 0, w / 12 + 1, h) }
  } else if (style === 'redpulse') {
    ctx.fillStyle = '#1A0505'; ctx.fillRect(0, 0, w, h)
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.45)
    g.addColorStop(0, '#E5141A'); g.addColorStop(1, 'rgba(229,20,26,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#2B2A4A'); g.addColorStop(1, '#C97B58')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#121220'
    for (let i = 0; i < 26; i++) {
      const bw = w / 26; const bh = h * (0.25 + 0.5 * rand(i + 3))
      ctx.fillRect(i * bw, h - bh, bw - 2, bh)
    }
  }
  ctx.restore()
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const update = () => setReduced(query.matches)
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return reduced
}

function useCanvasSize(ref: React.RefObject<HTMLCanvasElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const update = () => setSize({ w: canvas.clientWidth, h: canvas.clientHeight })
    update()
    if (!('ResizeObserver' in window)) return
    const observer = new ResizeObserver(update)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [ref])
  return size
}

/** A still frame of a header, used for thumbnails. Never animates. */
export function HeaderThumb({ preset }: { preset: HeaderPreset }) {
  if (preset.media) return <img className="header-thumb" src={asset(preset.media.poster)} alt="" decoding="async" />
  return <CanvasThumb preset={preset} />
}

function CanvasThumb({ preset }: { preset: HeaderPreset }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { w, h } = useCanvasSize(ref)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !w || !h) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawHeader(ctx, preset.style, w, h, 0.15)
  }, [preset.style, w, h])
  return <canvas ref={ref} className="header-thumb" aria-hidden="true" />
}

/**
 * A live dynamic header. It plays at most at the preset's frame rate and loops,
 * pauses while the page scrolls, when it leaves the viewport and when the tab is
 * hidden, and shows a still frame under reduced motion, low-power or data saver.
 * A provisional header waits behind its warning label until the viewer plays it.
 */
export function DynamicHeader({ preset, decision, upload }: { preset: HeaderPreset; decision: HeaderDecision; upload?: UploadedMedia | null }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { w, h } = useCanvasSize(ref)
  const settings = useAppStore((state) => state.settings)
  const osReduced = usePrefersReducedMotion()
  const [userPaused, setUserPaused] = useState(false)
  const [warningAccepted, setWarningAccepted] = useState(false)
  const [inView, setInView] = useState(true)
  const [scrolling, setScrolling] = useState(false)
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const elapsed = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const closeInfo = useCallback(() => setInfoOpen(false), [])

  const provisional = decision === 'PROVISIONAL'
  const stillReason = !ANIMATABLE.includes(preset.style) ? 'Still frame only'
    : settings.reducedMotion || osReduced ? 'Still frame: reduced motion is on'
    : settings.lowPower ? 'Still frame: low-power mode is on'
    : settings.dataSaver ? 'Still frame: data saver is on'
    : null
  const gated = provisional && !warningAccepted
  const running = !stillReason && !gated && !userPaused && inView && !scrolling && !hidden

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (running) void video.play().catch(() => { /* the poster stays up if the browser refuses */ })
    else video.pause()
  }, [running])

  useEffect(() => {
    const canvas = ref.current ?? videoRef.current
    if (!canvas || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let timer: number | undefined
    const onScroll = () => { setScrolling(true); window.clearTimeout(timer); timer = window.setTimeout(() => setScrolling(false), 450) }
    const onVisibility = () => setHidden(document.hidden)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', onVisibility); window.clearTimeout(timer) }
  }, [])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !w || !h || preset.media) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const frames = upload?.frames ?? []
    const loopMs = upload ? frames.length * upload.frameMs : preset.loopSeconds * 1000
    const frameMs = upload ? upload.frameMs : 1000 / preset.fps
    // Uploaded headers play their transcoded frames (already ≤15 fps and cropped to 3:1).
    const draw = upload
      ? () => { const f = frames[Math.floor(elapsed.current / frameMs) % frames.length]; if (f) ctx.drawImage(f, 0, 0, w, h) }
      : () => drawHeader(ctx, preset.style, w, h, (elapsed.current % loopMs) / loopMs)
    draw()
    if (!running) return
    let raf = 0; let last = performance.now(); let sinceDraw = 0
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100); last = now
      elapsed.current += dt; sinceDraw += dt
      if (sinceDraw >= frameMs) { sinceDraw %= frameMs; draw() }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [preset, upload, w, h, running])

  const status = gated ? 'Waiting behind its warning label'
    : stillReason ? stillReason.replace('Still frame: ', 'Showing a still frame because ')
    : userPaused ? 'Paused by you'
    : hidden ? 'Paused because the tab is hidden'
    : !inView ? 'Paused because it is off-screen'
    : scrolling ? 'Paused while you scroll'
    : `Playing at up to ${Math.min(preset.fps, 15)} fps`
  return <div className={`dynamic-header ${gated ? 'is-gated' : ''}`}>
    {preset.media
      ? <video ref={videoRef} muted playsInline loop preload="metadata" poster={asset(preset.media.poster)} aria-label={`Profile header: ${preset.description}`}>
          <source src={asset(preset.media.webm)} type="video/webm" />
        </video>
      : <canvas ref={ref} role="img" aria-label={`Profile header: ${preset.description}`} />}
    {gated && <div className="header-warning">
      <AlertTriangle size={18} aria-hidden="true" />
      <span><strong>Photosensitivity warning</strong><small>This header has quick flashes and is under review.</small></span>
      <button type="button" onClick={() => setWarningAccepted(true)}>Play header</button>
    </div>}
    <div className="header-controls">
      <button type="button" className="header-pause" aria-label="About this header" aria-haspopup="dialog" onClick={() => setInfoOpen(true)}>
        <Info size={17} aria-hidden="true" />
      </button>
      {!stillReason && !gated && <button type="button" className="header-pause" aria-pressed={userPaused} aria-label={userPaused ? 'Play header animation' : 'Pause header animation'} onClick={() => setUserPaused(!userPaused)}>
      {userPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
    </button>}
    </div>
    {infoOpen && <HeaderInfo preset={preset} decision={decision} upload={upload} status={status} onClose={closeInfo} />}
  </div>
}
