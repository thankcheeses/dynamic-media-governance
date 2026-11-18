/**
 * The proposal hero's constellation: a slowly turning 3D network of nodes,
 * the live version of the network on the owner's link cards.
 *
 * Built with three.js into ../assets/constellation.js (`npm run build:proposal`).
 * It follows the same motion rules the proposal asks of banners: silent, no
 * flashing (node brightness only drifts, under 0.25 Hz), paused off-screen,
 * in hidden tabs and by the viewer, and a single still frame under reduced motion.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, LineSegments,
  NormalBlending, PerspectiveCamera, Points, Scene, ShaderMaterial, WebGLRenderer,
  type Blending,
} from 'three'

export interface ConstellationHandle {
  /** True while the network is turning. */
  readonly running: boolean
  setPaused: (paused: boolean) => void
  /** Re-reads colors from CSS custom properties (call after a theme change). */
  refreshColors: () => void
  dispose: () => void
}

/** Deterministic, so the network is the same shape on every visit. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Graph { positions: Float32Array; tone: Uint8Array; size: Float32Array; phase: Float32Array; edges: Uint16Array }

/** Clusters on a loose shell plus scattered stars, joined to their nearest neighbours. */
export function buildGraph(count: number, seed = 7): Graph {
  const rand = mulberry32(seed)
  const gauss = () => { let u = 0; let v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
  const onSphere = () => { const z = rand() * 2 - 1; const a = rand() * Math.PI * 2; const r = Math.sqrt(1 - z * z); return [r * Math.cos(a), z, r * Math.sin(a)] }
  const centres = Array.from({ length: 7 }, () => onSphere().map((c) => c * (0.55 + rand() * 0.35)))
  const positions = new Float32Array(count * 3)
  const tone = new Uint8Array(count)
  const size = new Float32Array(count)
  const phase = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    let p: number[]
    if (rand() < 0.62) {
      const c = centres[Math.floor(rand() * centres.length)]
      p = c.map((v) => v + gauss() * 0.16)
    } else {
      const s = onSphere(); const r = 0.35 + Math.pow(rand(), 0.55) * 0.75
      p = s.map((v) => v * r)
    }
    positions.set([p[0] * 1.25, p[1] * 0.82, p[2]], i * 3)
    const t = rand()
    tone[i] = t < 0.78 ? 0 : t < 0.87 ? 1 : t < 0.94 ? 2 : 3
    const hub = rand() < 0.055
    size[i] = hub ? 7 + rand() * 3 : 2 + rand() * 2.2
    phase[i] = rand() * Math.PI * 2
  }
  const edges: number[] = []
  const seen = new Set<number>()
  for (let i = 0; i < count; i++) {
    const near: Array<[number, number]> = []
    for (let j = 0; j < count; j++) {
      if (i === j) continue
      const dx = positions[i * 3] - positions[j * 3]; const dy = positions[i * 3 + 1] - positions[j * 3 + 1]; const dz = positions[i * 3 + 2] - positions[j * 3 + 2]
      const d = dx * dx + dy * dy + dz * dz
      if (d < 0.44 * 0.44) near.push([d, j])
    }
    near.sort((a, b) => a[0] - b[0])
    for (const [, j] of near.slice(0, 3)) {
      const key = Math.min(i, j) * count + Math.max(i, j)
      if (!seen.has(key)) { seen.add(key); edges.push(i, j) }
    }
  }
  return { positions, tone, size, phase, edges: Uint16Array.from(edges) }
}

const NODE_VERT = /* glsl */ `
  attribute float size; attribute float phase; attribute vec3 color;
  uniform float uTime; uniform float uScale; uniform float uHalo;
  varying vec3 vColor; varying float vFade;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float breathe = 1.0 + 0.12 * sin(uTime * 1.2 + phase);
    gl_PointSize = size * breathe * uScale * (uHalo > 0.5 ? 3.4 : 1.0) / -mv.z;
    vColor = color;
    vFade = clamp(1.25 - (-mv.z - 2.4) * 0.55, 0.25, 1.0);
    gl_Position = projectionMatrix * mv;
  }`
const NODE_FRAG = /* glsl */ `
  uniform float uHalo; uniform float uAlpha;
  varying vec3 vColor; varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = uHalo > 0.5 ? pow(max(0.0, 1.0 - d), 2.2) * 0.42 : smoothstep(1.0, 0.72, d);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vFade * uAlpha);
  }`
const EDGE_VERT = /* glsl */ `
  attribute vec3 color; varying vec3 vColor; varying float vFade;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vColor = color; vFade = clamp(1.2 - (-mv.z - 2.4) * 0.6, 0.15, 1.0);
    gl_Position = projectionMatrix * mv;
  }`
const EDGE_FRAG = /* glsl */ `
  uniform float uAlpha; varying vec3 vColor; varying float vFade;
  void main() { gl_FragColor = vec4(vColor, uAlpha * vFade); }`

function readTones(host: HTMLElement): Color[] {
  const css = getComputedStyle(host)
  return ['--node-1', '--node-2', '--node-3', '--node-4'].map((name) => new Color(css.getPropertyValue(name).trim() || '#8b7cf6'))
}

export function mountConstellation(host: HTMLElement, { reducedMotion }: { reducedMotion: boolean }): ConstellationHandle | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  host.appendChild(renderer.domElement)
  renderer.domElement.setAttribute('aria-hidden', 'true')

  const small = host.clientWidth < 640
  const graph = buildGraph(small ? 120 : 180)
  const count = graph.size.length
  const scene = new Scene()
  const camera = new PerspectiveCamera(38, 1, 0.1, 20)
  camera.position.set(0, 0, 3.4)
  const group = new Group()
  group.rotation.set(0.32, -0.6, 0.08)
  scene.add(group)

  const nodeGeo = new BufferGeometry()
  nodeGeo.setAttribute('position', new BufferAttribute(graph.positions, 3))
  nodeGeo.setAttribute('size', new BufferAttribute(graph.size, 1))
  nodeGeo.setAttribute('phase', new BufferAttribute(graph.phase, 1))
  const nodeColors = new BufferAttribute(new Float32Array(count * 3), 3)
  nodeGeo.setAttribute('color', nodeColors)

  const edgeGeo = new BufferGeometry()
  const edgePos = new Float32Array(graph.edges.length * 3)
  graph.edges.forEach((n, k) => edgePos.set(graph.positions.subarray(n * 3, n * 3 + 3), k * 3))
  edgeGeo.setAttribute('position', new BufferAttribute(edgePos, 3))
  const edgeColors = new BufferAttribute(new Float32Array(graph.edges.length * 3), 3)
  edgeGeo.setAttribute('color', edgeColors)

  const uniforms = { uTime: { value: 0 }, uScale: { value: 1 } }
  const material = (halo: boolean) => new ShaderMaterial({
    vertexShader: NODE_VERT, fragmentShader: NODE_FRAG, transparent: true, depthWrite: false,
    uniforms: { ...uniforms, uHalo: { value: halo ? 1 : 0 }, uAlpha: { value: 1 } },
  })
  const dots = new Points(nodeGeo, material(false))
  // Halos only on the hub nodes: a separate geometry that shares the hub positions.
  const hubs = [...graph.size.keys()].filter((i) => graph.size[i] > 6)
  const haloGeo = new BufferGeometry()
  haloGeo.setAttribute('position', new BufferAttribute(Float32Array.from(hubs.flatMap((i) => [...graph.positions.subarray(i * 3, i * 3 + 3)])), 3))
  haloGeo.setAttribute('size', new BufferAttribute(Float32Array.from(hubs.map((i) => graph.size[i])), 1))
  haloGeo.setAttribute('phase', new BufferAttribute(Float32Array.from(hubs.map((i) => graph.phase[i])), 1))
  const haloColors = new BufferAttribute(new Float32Array(hubs.length * 3), 3)
  haloGeo.setAttribute('color', haloColors)
  const halos = new Points(haloGeo, material(true))
  const lines = new LineSegments(edgeGeo, new ShaderMaterial({ vertexShader: EDGE_VERT, fragmentShader: EDGE_FRAG, transparent: true, depthWrite: false, uniforms: { uAlpha: { value: 0.3 } } }))
  group.add(lines, halos, dots)

  const refreshColors = () => {
    const tones = readTones(host)
    const light = getComputedStyle(host).getPropertyValue('--node-blend').trim() === 'normal'
    const blend: Blending = light ? NormalBlending : AdditiveBlending
    for (let i = 0; i < count; i++) { const c = tones[graph.tone[i]]; nodeColors.setXYZ(i, c.r, c.g, c.b) }
    hubs.forEach((n, k) => { const c = tones[graph.tone[n]]; haloColors.setXYZ(k, c.r, c.g, c.b) })
    graph.edges.forEach((n, k) => { const c = tones[graph.tone[n] === 0 ? 0 : graph.tone[n]]; edgeColors.setXYZ(k, c.r, c.g, c.b) })
    nodeColors.needsUpdate = true; haloColors.needsUpdate = true; edgeColors.needsUpdate = true
    for (const m of [dots.material, halos.material, lines.material] as ShaderMaterial[]) { m.blending = blend; m.needsUpdate = true }
    ;(lines.material as ShaderMaterial).uniforms.uAlpha.value = light ? 0.26 : 0.3
    render()
  }

  let width = 0; let height = 0
  const resize = () => {
    width = host.clientWidth; height = host.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // Wide heroes keep the text column clear: the network sits to the right, around the profile preview.
    group.position.x = camera.aspect > 1.25 ? Math.min(1.35, (camera.aspect - 1) * 0.95) : 0
    group.position.y = camera.aspect > 1.25 ? 0 : 0.55
    camera.updateProjectionMatrix()
    // Point sizes are CSS pixels at the camera's distance, scaled a little with the hero's height.
    uniforms.uScale.value = renderer.getPixelRatio() * camera.position.z * Math.min(1.35, Math.max(0.8, height / 760))
    render()
  }
  const render = () => renderer.render(scene, camera)

  // Pointer tilt: the network leans a little toward the pointer.
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 }
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    tilt.tx = (event.clientY / window.innerHeight - 0.5) * 0.22
    tilt.ty = (event.clientX / window.innerWidth - 0.5) * 0.3
  }

  let visible = true; let userPaused = false; let raf = 0; let last = 0; let disposed = false
  const shouldRun = () => !reducedMotion && !userPaused && visible && !document.hidden && !disposed
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now
    uniforms.uTime.value += dt
    group.rotation.y += dt * 0.045
    tilt.x += (tilt.tx - tilt.x) * 0.04; tilt.y += (tilt.ty - tilt.y) * 0.04
    scene.rotation.set(tilt.x, tilt.y, 0)
    render()
    raf = shouldRun() ? requestAnimationFrame(frame) : 0
  }
  const sync = () => {
    if (shouldRun() && !raf) { last = 0; raf = requestAnimationFrame(frame) }
    host.dataset.running = String(shouldRun())
  }

  const ro = new ResizeObserver(resize)
  ro.observe(host)
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
  io.observe(host)
  document.addEventListener('visibilitychange', sync)
  window.addEventListener('pointermove', onPointer, { passive: true })

  resize()
  refreshColors()
  sync()

  return {
    get running() { return shouldRun() },
    setPaused: (paused) => { userPaused = paused; sync() },
    refreshColors,
    dispose: () => {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pointermove', onPointer)
      renderer.dispose(); host.removeChild(renderer.domElement)
    },
  }
}
