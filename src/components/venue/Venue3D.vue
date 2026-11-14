<script setup lang="ts">
import { Eye, Rotate360, ViewportWide } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Block, Zone } from '@/utils/festival'
import type { SeatVM } from '@/utils/venue'

import { loadKit, type Kit } from './kit3d'

// Pratinjau 3D dibangkitkan dari data API (kursi/zona) memakai aset GLB buatan Blender (panggung, truss, LED wall,
// speaker, tenda, toilet, FOH, gerbang, kursi). three.js dan aset dimuat lazy saat tab 3D dibuka.
const props = defineProps<{
  seats?: SeatVM[]
  selected?: Set<string>
  blocks: Block[]
  zones?: Zone[]
  /** kepadatan kerumunan per zona 0..1 (festival). */
  crowd?: Record<string, number>
}>()
const emit = defineEmits<{ toggle: [id: string]; ready: [] }>()
const { t } = useI18n()

type TH = typeof import('three')
type Mesh = import('three').Mesh
const el = ref<HTMLDivElement>()
const state = ref<'loading' | 'ready' | 'nogl'>('loading')
const preset = ref<string>('overview')
const tip = ref<{ s: SeatVM; x: number; y: number } | null>(null)
const kitOk = ref(true)
const THREE_ = shallowRef<TH | null>(null)

let renderer: import('three').WebGLRenderer
let scene: import('three').Scene
let camera: import('three').PerspectiveCamera
let controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls
let kit: Kit | null = null
let loSeats: import('three').InstancedMesh[] = []
let hiSeats: import('three').Object3D[] = []
let raf = 0
let tween = 0
let dirty = true
let visible = true
let ro: ResizeObserver | undefined
let io: IntersectionObserver | undefined
const disposables: { dispose: () => void }[] = []

const reduce =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const elevOf = (R: number, minR: number) => Math.max(0, (R - minR) * 0.16)
const minRadius = computed(() =>
  Math.min(...(props.seats ?? []).map((s) => Math.hypot(s.x, s.y)), Infinity),
)

const extent = computed(() => {
  let maxZ = 300
  let maxX = 300
  for (const s of props.seats ?? []) {
    maxZ = Math.max(maxZ, s.y)
    maxX = Math.max(maxX, Math.abs(s.x))
  }
  for (const b of props.blocks) {
    maxZ = Math.max(maxZ, b.y + b.h)
    maxX = Math.max(maxX, Math.abs(b.x), Math.abs(b.x + b.w))
  }
  return { maxZ, maxX }
})

const castAll = (o: import('three').Object3D) =>
  o.traverse((m) => {
    const mm = m as Mesh
    if (mm.isMesh) {
      mm.castShadow = true
      mm.receiveShadow = true
    }
  })

async function init(): Promise<void> {
  const host = el.value
  if (!host) return
  const THREE = await import('three')
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')
  THREE_.value = THREE
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  } catch {
    state.value = 'nogl' // tanpa WebGL: UI menampilkan alternatif 2D
    return
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  host.appendChild(renderer.domElement)
  renderer.domElement.setAttribute('aria-hidden', 'true')

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0908)
  scene.fog = new THREE.Fog(0x0a0908, 1100, 3200)
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.32
  disposables.push(pmrem)

  camera = new THREE.PerspectiveCamera(45, 1, 5, 7000)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.maxPolarAngle = Math.PI * 0.495
  controls.minDistance = 30
  controls.maxDistance = 2600
  controls.addEventListener('change', () => (dirty = true))

  lights(THREE)
  floor(THREE)
  try {
    kit = await loadKit()
  } catch (e) {
    console.error('[venue3d] aset GLB gagal dimuat, memakai bentuk dasar', e)
    kitOk.value = false
  }
  buildBlocks(THREE)
  buildSeats(THREE)
  buildCrowd(THREE)
  setPreset('overview', false)
  resize()
  ro = new ResizeObserver(resize)
  ro.observe(host)
  io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting
    if (visible) dirty = true
  })
  io.observe(host)
  const c = renderer.domElement
  c.addEventListener('pointermove', onMove)
  c.addEventListener('pointerdown', onDown)
  c.addEventListener('pointerup', onUp)
  c.addEventListener('pointerleave', () => (tip.value = null))
  state.value = 'ready'
  loop()
  emit('ready')
}

function lights(THREE: TH): void {
  scene.add(new THREE.HemisphereLight(0x6f7fa6, 0x241c14, 0.7))
  const key = new THREE.DirectionalLight(0xffe0b0, 1.5)
  key.position.set(-380, 700, 520)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  const sc = key.shadow.camera
  sc.left = -1000
  sc.right = 1000
  sc.top = 1000
  sc.bottom = -1000
  sc.near = 50
  sc.far = 2200
  key.shadow.bias = -0.0004
  key.shadow.radius = 4
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x9ab6ff, 0.6)
  rim.position.set(500, 380, -600)
  scene.add(rim)
  const gold = new THREE.PointLight(0xffc880, 2.4, 1100, 1.4)
  gold.position.set(-160, 170, -40)
  const blue = new THREE.PointLight(0x7ea6ff, 2.0, 1100, 1.4)
  blue.position.set(160, 170, -40)
  scene.add(gold, blue)
}

function floor(THREE: TH): void {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(256, 160, 20, 256, 256, 330)
  grad.addColorStop(0, '#3a3128')
  grad.addColorStop(1, '#0c0a09')
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 512)
  g.strokeStyle = 'rgba(217,185,121,0.07)'
  for (let i = 0; i <= 512; i += 32) {
    g.beginPath()
    g.moveTo(i, 0)
    g.lineTo(i, 512)
    g.moveTo(0, i)
    g.lineTo(512, i)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 })
  const f = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600), m)
  f.rotation.x = -Math.PI / 2
  f.position.set(0, -0.2, 450)
  f.receiveShadow = true
  scene.add(f)
  disposables.push(f.geometry, m, tex)
}

function mat(THREE: TH, color: string, opts: Record<string, unknown> = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.75,
    metalness: 0.05,
    ...opts,
  })
  disposables.push(m)
  return m
}

/** Tempatkan klon aset ke blok: skala seragam agar muat, menghadap arah `yaw`. */
function place(THREE: TH, name: keyof Kit, b: Block, yaw: number, maxScale = 1.6): void {
  const src = kit?.[name]
  if (!src) return
  const o = src.clone(true)
  const size = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3())
  const swap = Math.abs(Math.sin(yaw)) > 0.7
  const sx = (swap ? size.z : size.x) || 1
  const sz = (swap ? size.x : size.z) || 1
  o.scale.setScalar(Math.min(b.w / sx, b.h / sz, maxScale))
  o.rotation.y = yaw
  o.position.set(b.x + b.w / 2, 0, b.y + b.h / 2)
  castAll(o)
  scene.add(o)
}

function buildBlocks(THREE: TH): void {
  const hasStage = !!kit?.stage
  for (const b of props.blocks) {
    const cx = b.x + b.w / 2
    const side = cx < -200 ? Math.PI / 2 : cx > 200 ? -Math.PI / 2 : Math.PI // menghadap ke tengah/panggung
    if (b.kind === 'stage' && hasStage) {
      const o = kit!.stage.clone(true)
      o.scale.set(b.w / 400, 1, 1)
      o.position.set(cx, 0, b.y + b.h / 2)
      castAll(o)
      o.traverse((m) => {
        // LED wall: emisif diturunkan agar warna layar terbaca (tidak terbakar jadi putih)
        const mm = m as Mesh
        const mt = mm.isMesh ? (mm.material as import('three').MeshStandardMaterial) : null
        if (mt?.name === 'led_wall') mt.emissiveIntensity = 0.55
      })
      scene.add(o)
      beams(THREE, b)
      continue
    }
    if (b.kind === 'screen' && hasStage) continue // LED wall sudah bagian dari aset panggung
    if (kit) {
      const handled = placeKit(THREE, b, side)
      if (handled) continue
    }
    // bentuk dasar: pelat zona, catwalk, area khusus; juga cadangan bila GLB gagal
    const isZone = b.kind === 'zone'
    const h = Math.max(1, b.height)
    const geo = new THREE.BoxGeometry(b.w, h, b.h)
    disposables.push(geo)
    const mesh = new THREE.Mesh(
      geo,
      mat(THREE, b.color, isZone ? { transparent: true, opacity: 0.42, roughness: 1 } : {}),
    )
    mesh.position.set(cx, h / 2, b.y + b.h / 2)
    mesh.receiveShadow = true
    mesh.castShadow = !isZone
    scene.add(mesh)
    labelFor(THREE, b)
  }
}

function placeKit(THREE: TH, b: Block, side: number): boolean {
  switch (b.kind) {
    case 'foh':
      place(THREE, 'foh', b, Math.PI)
      labelFor(THREE, b)
      return true
    case 'tower':
      place(THREE, 'tower', b, 0, 1.3)
      return true
    case 'bar':
      place(THREE, 'tent_bar', b, side)
      labelFor(THREE, b)
      return true
    case 'medic':
      place(THREE, 'tent_medic', b, side)
      labelFor(THREE, b)
      return true
    case 'merch':
      place(THREE, 'tent_merch', b, side)
      labelFor(THREE, b)
      return true
    case 'toilet':
      place(THREE, 'toilet', b, side)
      labelFor(THREE, b)
      return true
    case 'gate':
      place(THREE, 'gate', b, Math.PI, 1.2)
      return true
    case 'barricade': {
      const n = Math.max(1, Math.round(b.w / 120))
      for (let i = 0; i < n; i++) {
        const o = kit!.barricade.clone(true)
        o.scale.set(b.w / (n * 120), 1, 1)
        o.position.set(b.x + (b.w * (i + 0.5)) / n, 0, b.y + b.h / 2)
        castAll(o)
        scene.add(o)
      }
      return true
    }
    default:
      return false
  }
}

function beams(THREE: TH, b: Block): void {
  for (let i = 0; i < 5; i++) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(30, 230, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xffd9a0 : 0xa6c4ff,
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    cone.position.set(b.x + (b.w * (i + 0.5)) / 5, 120, b.y + b.h * 0.9)
    cone.rotation.x = (i % 2 ? -1 : 1) * 0.5
    cone.rotation.z = (i - 2) * 0.14
    scene.add(cone)
    disposables.push(cone.geometry, cone.material as import('three').Material)
  }
}

function labelFor(THREE: TH, b: Block): void {
  if (
    !b.label ||
    !['zone', 'foh', 'bar', 'toilet', 'medic', 'merch', 'ada', 'lounge'].includes(b.kind)
  )
    return
  const spr = label(THREE, b.label)
  const isZone = b.kind === 'zone'
  spr.position.set(
    b.x + b.w / 2,
    isZone ? 34 : Math.max(1, b.height) + 44,
    isZone ? b.y + 34 : b.y + b.h / 2,
  )
  scene.add(spr)
}

function label(THREE: TH, text: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(12,10,9,0.82)'
  g.beginPath()
  g.roundRect(8, 24, 496, 80, 40)
  g.fill()
  g.strokeStyle = 'rgba(217,185,121,0.85)'
  g.lineWidth = 3
  g.stroke()
  g.fillStyle = '#f2ead8'
  g.font = '700 46px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 256, 66)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  disposables.push(tex, m)
  const s = new THREE.Sprite(m)
  s.scale.set(104, 26, 1)
  return s
}

// ---------------------------------------------------------------- kursi
const STATE_COLOR = { sold: '#2f2a24', held: '#76623a', blocked: '#2f2a24' } as const
function seatColor(s: SeatVM, sel: boolean): string {
  if (sel) return '#f4ecd8'
  return s.state === 'available' ? s.color : STATE_COLOR[s.state]
}

function seatMatrix(THREE: TH, s: SeatVM, scale = 1): import('three').Matrix4 {
  const d = new THREE.Object3D()
  d.position.set(s.x, elevOf(Math.hypot(s.x, s.y), minRadius.value), s.y)
  d.rotation.set(0, (-s.rot * Math.PI) / 180, 0)
  d.scale.setScalar(scale)
  d.updateMatrix()
  return d.matrix
}

function buildSeats(THREE: TH): void {
  const seats = props.seats ?? []
  if (!seats.length) return
  const meshes: Mesh[] = []
  kit?.seat_lo.traverse((o) => ((o as Mesh).isMesh ? meshes.push(o as Mesh) : 0))
  if (!meshes.length) {
    const g = new THREE.BoxGeometry(14, 10, 12)
    g.translate(0, 5, 0)
    const m = new THREE.MeshStandardMaterial({ roughness: 0.7 })
    meshes.push(new THREE.Mesh(g, m))
    disposables.push(g, m)
  }
  loSeats = meshes.map((mesh) => {
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, seats.length)
    im.receiveShadow = true
    scene.add(im)
    return im
  })
  applySelection()
}

function applySelection(): void {
  const THREE = THREE_.value
  const seats = props.seats ?? []
  if (!THREE || !loSeats.length) return
  const col = new THREE.Color()
  const hi: import('three').Matrix4[] = []
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  seats.forEach((s, i) => {
    const sel = !!props.selected?.has(s.id)
    const m = sel ? zero : seatMatrix(THREE, s) // yang dipilih diganti model detail
    col.set(seatColor(s, sel))
    for (const im of loSeats) {
      im.setMatrixAt(i, m)
      im.setColorAt(i, col)
    }
    if (sel) hi.push(seatMatrix(THREE, s, 1.18))
  })
  for (const im of loSeats) {
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  }
  for (const o of hiSeats) scene.remove(o)
  hiSeats = []
  if (kit?.seat) {
    for (const m of hi) {
      const c = kit.seat.clone(true)
      c.applyMatrix4(m)
      c.traverse((o) => {
        const mm = o as Mesh
        if (!mm.isMesh) return
        const mt = (mm.material as import('three').MeshStandardMaterial).clone()
        if (mt.name === 'fabric') {
          mt.color.set('#f4ecd8')
          mt.emissive.set('#d9b979')
          mt.emissiveIntensity = 0.35
        }
        mm.material = mt
        mm.castShadow = true
      })
      scene.add(c)
      hiSeats.push(c)
    }
  }
  dirty = true
}
watch(() => [props.selected && [...props.selected].join(','), props.seats], applySelection)

// ---------------------------------------------------------------- kerumunan
function buildCrowd(THREE: TH): void {
  const meshes: Mesh[] = []
  kit?.person.traverse((o) => ((o as Mesh).isMesh ? meshes.push(o as Mesh) : 0))
  if (!meshes.length) {
    const g = new THREE.CapsuleGeometry(2.6, 7, 3, 6)
    disposables.push(g)
    meshes.push(new THREE.Mesh(g, mat(THREE, '#e9dfc4')))
  }
  const d = new THREE.Object3D()
  for (const z of props.zones ?? []) {
    const k = props.crowd?.[z.tier.id] ?? 0
    const n = Math.round(Math.min(380, z.block.w * z.block.h * 0.0021) * k)
    if (n < 1) continue
    for (const mesh of meshes) {
      const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, n)
      let seed = z.block.w * 7 + z.block.h // sama untuk tiap bagian mesh agar figur tetap utuh
      const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
      for (let i = 0; i < n; i++) {
        d.position.set(
          z.block.x + 10 + rnd() * (z.block.w - 20),
          0,
          z.block.y + 16 + rnd() * (z.block.h - 28),
        )
        d.rotation.y = (rnd() - 0.5) * 0.9 // menghadap panggung (-Z) dengan sedikit variasi
        d.scale.setScalar(0.95 + rnd() * 0.4)
        d.updateMatrix()
        im.setMatrixAt(i, d.matrix)
      }
      im.castShadow = true
      scene.add(im)
      disposables.push(im)
    }
  }
}

// ---------------------------------------------------------------- kamera
type V3 = [number, number, number]
function camFor(p: string): { pos: V3; target: V3; fov: number } {
  const { maxZ, maxX } = extent.value
  if (p === 'top')
    return {
      pos: [0, Math.max(maxZ, maxX) * 1.9, maxZ * 0.28],
      target: [0, 0, maxZ * 0.28 - 1],
      fov: 45,
    }
  if (p === 'stage') return { pos: [0, 78, -70], target: [0, 28, maxZ * 0.65], fov: 62 }
  if (p === 'seat') {
    const id = [...(props.selected ?? [])].pop()
    const s = (props.seats ?? []).find((x) => x.id === id)
    if (s)
      return {
        pos: [s.x, elevOf(Math.hypot(s.x, s.y), minRadius.value) + 26, s.y],
        target: [0, 52, -100],
        fov: 62,
      }
  }
  if (p.startsWith('zone:')) {
    const z = props.zones?.find((q) => q.tier.id === p.slice(5))
    if (z) return { pos: [z.cx, 24, z.cy + 40], target: [0, 60, -100], fov: 66 }
  }
  return { pos: [maxX * 0.18, maxZ * 0.72, maxZ * 1.32], target: [0, 20, maxZ * 0.16], fov: 45 }
}

function setPreset(p: string, animate = true): void {
  preset.value = p
  const to = camFor(p)
  const THREE = THREE_.value
  if (!THREE || !camera) return
  const fromPos = camera.position.clone()
  const fromTgt = controls.target.clone()
  const toPos = new THREE.Vector3(...to.pos)
  const toTgt = new THREE.Vector3(...to.target)
  cancelAnimationFrame(tween)
  const dur = animate && !reduce ? 800 : 0
  const t0 = performance.now()
  const step = (now: number) => {
    const k = dur ? Math.min(1, (now - t0) / dur) : 1
    const e = 1 - Math.pow(1 - k, 3)
    camera.position.lerpVectors(fromPos, toPos, e)
    controls.target.lerpVectors(fromTgt, toTgt, e)
    camera.fov += (to.fov - camera.fov) * e
    camera.updateProjectionMatrix()
    controls.update()
    dirty = true
    if (k < 1) tween = requestAnimationFrame(step)
  }
  tween = requestAnimationFrame(step)
}
const canSeat = computed(() => (props.selected?.size ?? 0) > 0)

// ---------------------------------------------------------------- picking
let ray: import('three').Raycaster | undefined
let downAt: { x: number; y: number } | null = null
function seatAtPointer(e: PointerEvent): SeatVM | null {
  const THREE = THREE_.value
  const im = loSeats[0]
  if (!THREE || !im || !props.seats) return null
  ray ??= new THREE.Raycaster()
  const r = renderer.domElement.getBoundingClientRect()
  const v = new THREE.Vector2(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    -((e.clientY - r.top) / r.height) * 2 + 1,
  )
  ray.setFromCamera(v, camera)
  const hit = ray.intersectObject(im, false)[0]
  return hit?.instanceId != null ? (props.seats[hit.instanceId] ?? null) : null
}
function onMove(e: PointerEvent): void {
  const s = seatAtPointer(e)
  const r = renderer.domElement.getBoundingClientRect()
  tip.value = s ? { s, x: e.clientX - r.left, y: e.clientY - r.top } : null
  renderer.domElement.style.cursor = s && s.state === 'available' ? 'pointer' : 'grab'
}
function onDown(e: PointerEvent): void {
  downAt = { x: e.clientX, y: e.clientY }
}
function onUp(e: PointerEvent): void {
  if (!downAt) return
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6
  downAt = null
  if (moved) return
  const s = seatAtPointer(e)
  if (s && s.state === 'available') emit('toggle', s.id)
}

function resize(): void {
  const host = el.value
  if (!host || !renderer) return
  const w = host.clientWidth
  const h = host.clientHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  dirty = true
}
function loop(): void {
  raf = requestAnimationFrame(loop)
  if (!dirty || !visible) return
  dirty = false
  renderer.render(scene, camera)
}

onMounted(init)
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  cancelAnimationFrame(tween)
  ro?.disconnect()
  io?.disconnect()
  controls?.dispose()
  for (const d of disposables) d.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <div class="v3 on-dark">
    <div ref="el" class="v3__gl" data-test="venue-3d" />
    <div v-if="state === 'loading'" class="v3__ov" role="status">{{ t('seats.loading3d') }}</div>
    <div v-else-if="state === 'nogl'" class="v3__ov" role="alert">{{ t('seats.noWebgl') }}</div>

    <div v-if="state === 'ready'" class="v3__bar" role="group" :aria-label="t('seats.cameraGroup')">
      <button type="button" :aria-pressed="preset === 'overview'" @click="setPreset('overview')">
        <NIcon :component="Rotate360" :size="16" aria-hidden="true" /> {{ t('seats.cam.overview') }}
      </button>
      <button type="button" :aria-pressed="preset === 'top'" @click="setPreset('top')">
        <NIcon :component="ViewportWide" :size="16" aria-hidden="true" /> {{ t('seats.cam.top') }}
      </button>
      <button type="button" :aria-pressed="preset === 'stage'" @click="setPreset('stage')">
        <NIcon :component="Eye" :size="16" aria-hidden="true" /> {{ t('seats.cam.stage') }}
      </button>
      <button
        v-if="seats?.length"
        type="button"
        :disabled="!canSeat"
        :aria-pressed="preset === 'seat'"
        :title="canSeat ? '' : t('seats.cam.seatHint')"
        @click="setPreset('seat')"
      >
        <NIcon :component="Eye" :size="16" aria-hidden="true" /> {{ t('seats.cam.seat') }}
      </button>
      <button
        v-for="z in zones ?? []"
        :key="z.tier.id"
        type="button"
        :aria-pressed="preset === 'zone:' + z.tier.id"
        @click="setPreset('zone:' + z.tier.id)"
      >
        <NIcon :component="Eye" :size="16" aria-hidden="true" />
        {{ t('seats.cam.from', { name: z.tier.name }) }}
      </button>
    </div>
    <p v-if="state === 'ready'" class="v3__hint">
      {{ t('seats.hint3d') }}<template v-if="!kitOk"> · {{ t('seats.basic3d') }}</template>
    </p>

    <div v-if="tip" class="v3__tip" :style="{ left: tip.x + 14 + 'px', top: tip.y + 14 + 'px' }">
      <strong>{{ tip.s.sectionName }}</strong>
      <span>{{ t('seats.row') }} {{ tip.s.row }} · {{ t('seats.seat') }} {{ tip.s.no }}</span>
      <em :data-st="tip.s.state">{{ t(`seats.state.${tip.s.state}`) }}</em>
    </div>
  </div>
</template>

<style scoped>
.v3 {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--a-line);
  border-radius: 22px;
  background: #0a0908;
}
.v3__gl {
  width: 100%;
  height: clamp(380px, 60vh, 640px);
}
.v3__gl :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: grab;
}
.v3__ov {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  text-align: center;
  color: var(--a-muted);
  background: rgb(12 10 9 / 0.7);
}
.v3__bar {
  position: absolute;
  left: 12px;
  right: 12px;
  top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.v3__bar button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: rgb(12 10 9 / 0.82);
  color: var(--a-ink);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.v3__bar button[aria-pressed='true'] {
  background: var(--a-gold);
  border-color: var(--a-gold);
  color: var(--a-on-gold);
  font-weight: 700;
}
.v3__bar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.v3__hint {
  position: absolute;
  left: 14px;
  bottom: 12px;
  font-size: 12px;
  color: var(--a-muted);
  pointer-events: none;
}
.v3__tip {
  position: absolute;
  z-index: 3;
  display: grid;
  gap: 2px;
  padding: 8px 12px;
  border: 1px solid var(--a-line-strong);
  border-radius: 12px;
  background: rgb(12 10 9 / 0.96);
  font-size: 13px;
  pointer-events: none;
}
.v3__tip em {
  font-style: normal;
  color: var(--a-ok);
}
.v3__tip em[data-st='sold'],
.v3__tip em[data-st='held'] {
  color: #ff9a8a;
}
</style>
