import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IcosahedronGeometry, Mesh, PerspectiveCamera, Scene, ShaderMaterial, WebGLRenderer } from 'three'
import { audioController } from '../audio'
import { motionAllowed } from '../motion'
import { useAppStore } from '../store'

/**
 * Title-slide centerpiece: a sphere whose surface ripples with noise, and
 * swells and brightens with the live audio level from the shared analyser.
 *
 * Plain three.js with named imports (tree-shaken) rather than React Three
 * Fiber: one mesh doesn't need a reconciler, and this keeps the lazy chunk a
 * fraction of the size, which matters on slower phones.
 *
 * It never starts audio and never creates an AudioContext; it only reads levels
 * while something the user pressed is playing. One still frame under reduced
 * motion, low-power or data-saver. rAF pauses in hidden tabs on its own.
 */

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uLevel;
varying float vDisplace;
varying vec3 vNormal;

float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i), n100 = hash(i + vec3(1,0,0)), n010 = hash(i + vec3(0,1,0)), n110 = hash(i + vec3(1,1,0));
  float n001 = hash(i + vec3(0,0,1)), n101 = hash(i + vec3(1,0,1)), n011 = hash(i + vec3(0,1,1)), n111 = hash(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

void main() {
  vNormal = normalize(normalMatrix * normal);
  float n = noise(normal * 2.2 + vec3(uTime * 0.35));
  float ripple = noise(normal * 6.0 - vec3(uTime * 1.2));
  // Capped so the swollen surface stays inside the camera frame.
  float displace = (n - 0.5) * (0.14 + uLevel * 0.42) + ripple * uLevel * 0.18;
  vDisplace = displace;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * displace, 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform float uLevel;
varying float vDisplace;
varying vec3 vNormal;

void main() {
  vec3 blue = vec3(0.114, 0.608, 0.941);  // accent #1D9BF0
  vec3 green = vec3(0.0, 0.729, 0.486);   // voice green #00BA7C
  vec3 base = mix(blue, green, clamp(vDisplace * 3.0 + 0.5, 0.0, 1.0));
  // Fresnel: dark core, glowing rim, so the sphere reads as 3D on pure black.
  float fres = pow(1.0 - abs(vNormal.z), 2.2);
  vec3 color = mix(base * (0.16 + uLevel * 0.35), base * 1.15 + vec3(0.22) * fres, fres) + base * uLevel * 0.18;
  gl_FragColor = vec4(color, 1.0);
}
`

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export default function SoundOrb({ fallback }: { fallback: ReactNode }) {
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(() => !webglAvailable())
  const lowPower = useAppStore((state) => state.settings.lowPower || state.settings.dataSaver)
  const reducedSetting = useAppStore((state) => state.settings.reducedMotion)

  useEffect(() => {
    const el = host.current
    if (failed || !el) return
    const animated = motionAllowed() && !lowPower
    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      // Context creation can still fail (GPU blocklist, lost context): show the flat icon.
      queueMicrotask(() => setFailed(true))
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    el.appendChild(renderer.domElement)

    const scene = new Scene()
    const camera = new PerspectiveCamera(45, 1, 0.1, 20)
    camera.position.z = 4.2
    // Detail 24 ≈ 12k triangles: smooth at this size, light on low-end phones.
    const geometry = new IcosahedronGeometry(1, 24)
    const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms: { uTime: { value: 0 }, uLevel: { value: 0 } } })
    const mesh = new Mesh(geometry, material)
    scene.add(mesh)

    const resize = () => {
      const size = el.clientWidth || 1
      renderer.setSize(size, size, false)
      camera.aspect = 1
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()

    let frame = 0
    let last = performance.now()
    let level = 0
    const tick = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000)
      last = now
      // Ease toward the live level so the surface swells instead of jittering.
      const target = Math.min(1, audioController.readLevel() * 2.6)
      level += (target - level) * Math.min(1, delta * 10)
      material.uniforms.uLevel.value = level
      material.uniforms.uTime.value = now / 1000
      mesh.rotation.y += delta * (0.12 + level * 0.9)
      mesh.rotation.x = Math.sin(now / 5000) * 0.18
      mesh.scale.setScalar(1 + level * 0.1)
      renderer.render(scene, camera)
      frame = requestAnimationFrame(tick)
    }
    if (animated) frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [failed, lowPower, reducedSetting])

  if (failed) return <>{fallback}</>
  return <div className="x-orb" ref={host} aria-hidden="true" />
}
