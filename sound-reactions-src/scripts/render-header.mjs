// Renders the sample dynamic profile header with three.js, frame by frame, then
// encodes it the way the framework describes: a GIF upload (≤8 MB, ≤15 fps,
// ≤10 s loop) and the WebM/VP9 file the platform would serve after transcoding.
//
//   node scripts/render-header.mjs                 # every variant
//   node scripts/render-header.mjs clay-orbit      # one variant
//
// Each variant writes public/headers/<id>.webm (what the platform serves) and
// <id>.jpg (the still frame). The GIF is written next to them for clay-orbit,
// the showcase upload, and to a temp folder for the rest; every GIF is then
// measured by scripts/analyze-header.py into src/header-manifest.json.
//
// Needs Playwright's Chromium and ffmpeg on PATH.
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'headers')
const VARIANTS = {
  'clay-orbit': { top: '#2A1E1A', bottom: '#120E0D', core: 0xc15f3c, line: 0xe9dfd3, shape: 'ico', keepGif: true },
  'sea-glass': { top: '#12262B', bottom: '#081216', core: 0x5fa8a0, line: 0xd8ece8, shape: 'torus' },
  'violet-hour': { top: '#231A33', bottom: '#0E0A16', core: 0x9a7fd1, line: 0xe6dcf5, shape: 'octa' },
  'moss': { top: '#1A2418', bottom: '#0B110A', core: 0x8fae6b, line: 0xe2ead8, shape: 'dodeca' },
  'citrus': { top: '#2B2412', bottom: '#120F06', core: 0xe0a458, line: 0xf3ead6, shape: 'ico' },
}
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VARIANTS)
const W = 1500, H = 500          // X-style 3:1 header
const FPS = 15, SECONDS = 10     // framework limits: ≤15 fps, ≤10 s loop
const FRAMES = FPS * SECONDS
const GIF_W = 1200               // GIF is scaled down to stay well under 8 MB

const pageFor = (v) => `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="${W}" height="${H}"></canvas>
<script type="module">
import * as THREE from '/three.module.min.js'
const canvas = document.getElementById('c')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1); renderer.setSize(${W}, ${H}, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
const scene = new THREE.Scene()

// Background: a quiet warm gradient, drawn once.
const bg = document.createElement('canvas'); bg.width = 2; bg.height = 256
const g = bg.getContext('2d').createLinearGradient(0, 0, 0, 256)
g.addColorStop(0, '${v.top}'); g.addColorStop(1, '${v.bottom}')
const bctx = bg.getContext('2d'); bctx.fillStyle = g; bctx.fillRect(0, 0, 2, 256)
const bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace
scene.background = bgTex

const camera = new THREE.PerspectiveCamera(30, ${W} / ${H}, 0.1, 100)
camera.position.set(0, 0, 13)

scene.add(new THREE.HemisphereLight(0xfff1e6, 0x2a1e1a, 1.1))
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-5, 6, 8); scene.add(key)
const rim = new THREE.DirectionalLight(0xffd9c4, 0.8); rim.position.set(6, -3, -5); scene.add(rim)

const clay = new THREE.MeshStandardMaterial({ color: ${v.core}, roughness: 0.8, metalness: 0, flatShading: true })
const ink = new THREE.MeshBasicMaterial({ color: ${v.line}, transparent: true, opacity: 0.35 })

const group = new THREE.Group(); group.position.set(3.2, 0, 0); scene.add(group)
const coreGeo = { ico: new THREE.IcosahedronGeometry(1.15, 1), torus: new THREE.TorusKnotGeometry(0.75, 0.26, 120, 12), octa: new THREE.OctahedronGeometry(1.25, 0), dodeca: new THREE.DodecahedronGeometry(1.15, 0) }['${v.shape}']
const core = new THREE.Mesh(coreGeo, clay); group.add(core)
const shellGeo = new THREE.IcosahedronGeometry(2.0, 0)
const shell = new THREE.LineSegments(new THREE.EdgesGeometry(shellGeo), new THREE.LineBasicMaterial({ color: ${v.line}, transparent: true, opacity: 0.28 }))
group.add(shell)
const rings = [[2.7, 1.2, 0.2], [3.0, 0.5, -0.9]].map(([r, ax, ay]) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 260), ink)
  ring.rotation.set(ax, ay, 0)
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), clay); bead.position.set(r, 0, 0); ring.add(bead)
  group.add(ring); return ring
})

// Small drifting forms on the left, kept dim so a name and avatar read over them.
const motes = Array.from({ length: 14 }, (_, i) => {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + (i % 3) * 0.05, 0), clay)
  m.userData = { x: -7 + (i * 0.73) % 9, y: -1.6 + ((i * 1.37) % 3.2), phase: i / 14 }
  scene.add(m); return m
})

// One frame at loop position p (0..1). Every motion completes whole cycles at p = 1.
window.renderAt = (p) => {
  const T = Math.PI * 2
  core.rotation.set(0.35, T * p, 0)
  shell.rotation.set(0.2, -T * p, 0.1)
  rings[0].rotation.z = T * p
  rings[1].rotation.z = -T * p
  group.rotation.x = 0.08 * Math.sin(T * p)
  motes.forEach((m) => {
    const q = T * (p + m.userData.phase)
    m.position.set(m.userData.x + 0.25 * Math.cos(q), m.userData.y + 0.18 * Math.sin(q), -2)
    m.rotation.set(q, q, 0)
  })
  renderer.render(scene, camera)
  return canvas.toDataURL('image/png')
}
window.ready = true
</script></body></html>`

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
mkdirSync(OUT, { recursive: true })
const gifDir = mkdtempSync(join(tmpdir(), 'header-gif-'))
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })

for (const NAME of wanted) {
  const v = VARIANTS[NAME]
  if (!v) throw new Error(`Unknown variant ${NAME}`)
  const tmp = mkdtempSync(join(tmpdir(), 'header-'))
  const context = await browser.newContext({ viewport: { width: W, height: H } })
  await context.route('http://render.local/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/three.module.min.js') return route.fulfill({ body: readFileSync(join(ROOT, 'node_modules/three/build/three.module.min.js')), contentType: 'text/javascript' })
    return route.fulfill({ body: pageFor(v), contentType: 'text/html' })
  })
  const tab = await context.newPage()
  await tab.goto('http://render.local/')
  await tab.waitForFunction(() => window.ready === true)
  for (let i = 0; i < FRAMES; i++) {
    const url = await tab.evaluate((p) => window.renderAt(p), i / FRAMES)
    writeFileSync(join(tmp, `f${String(i).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'))
  }
  await context.close()

  const frames = join(tmp, 'f%04d.png')
  const gif = join(v.keepGif ? OUT : gifDir, `${NAME}.gif`)
  // GIF: the "upload". Palette per clip, no dithering noise that could read as shimmer.
  ff(['-framerate', String(FPS), '-i', frames, '-vf', `scale=${GIF_W}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=none`, '-loop', '0', gif])
  // WebM/VP9: what the platform serves after transcoding. No audio track at all.
  ff(['-framerate', String(FPS), '-i', frames, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-an', join(OUT, `${NAME}.webm`)])
  // Poster: the still frame shown under reduced motion, low power or data saver.
  ff(['-i', join(tmp, 'f0000.png'), '-q:v', '4', join(OUT, `${NAME}.jpg`)])
  rmSync(tmp, { recursive: true, force: true })
  execFileSync('python3', ['-I', join(ROOT, 'scripts/analyze-header.py'), gif, '--id', NAME, '--out', join(ROOT, 'src/header-manifest.json'), '--merge'], { stdio: ['ignore', 'ignore', 'inherit'] })
  console.log(`${NAME}: gif ${(statSync(gif).size / 1048576).toFixed(2)} MB, webm ${(statSync(join(OUT, `${NAME}.webm`)).size / 1048576).toFixed(2)} MB`)
}
await browser.close()
rmSync(gifDir, { recursive: true, force: true })
