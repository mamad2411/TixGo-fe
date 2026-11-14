import type { PublicTier } from '@/api/events'
import { tierColor } from '@/utils/tiers'

export type BlockKind =
  | 'stage'
  | 'screen'
  | 'catwalk'
  | 'zone'
  | 'barricade'
  | 'foh'
  | 'tower'
  | 'bar'
  | 'toilet'
  | 'medic'
  | 'merch'
  | 'charging'
  | 'gate'
  | 'exit'
  | 'ada'
  | 'lounge'

/** Satu objek denah. x,y = sudut kiri-atas pada bidang 2D (y positif ke arah penonton); height = tinggi 3D. */
export interface Block {
  id: string
  kind: BlockKind
  x: number
  y: number
  w: number
  h: number
  height: number
  color: string
  label?: string
  tierId?: string
}

export interface Zone {
  block: Block
  tier: PublicTier
  /** posisi pusat zona (untuk kamera "lihat dari sini"). */
  cx: number
  cy: number
}

export interface FestivalLayout {
  blocks: Block[]
  zones: Zone[]
  viewBox: { x: number; y: number; w: number; h: number }
}

const NEUTRAL: Record<string, string> = {
  stage: '#e9dfc4',
  screen: '#2a2f3a',
  catwalk: '#cdbb8c',
  barricade: '#8d846f',
  foh: '#3b4a5c',
  tower: '#566170',
  bar: '#8a5a2b',
  toilet: '#3f6a7a',
  medic: '#a8403a',
  merch: '#6b4a8a',
  charging: '#4a7a55',
  gate: '#d9b979',
  exit: '#a8403a',
  ada: '#3f6fa8',
  lounge: '#7a5a2a',
}

/** Panggung untuk acara bernomor (digambar di atas kursi). Lebar mengikuti lebar blok kursi. */
export function seatedStage(stageW: number): Block[] {
  const W = stageW
  return [
    {
      id: 'stage',
      kind: 'stage',
      x: -W / 2,
      y: -170,
      w: W,
      h: 130,
      height: 26,
      color: NEUTRAL.stage!,
      label: 'PANGGUNG',
    },
    {
      id: 'screen',
      kind: 'screen',
      x: -W * 0.42,
      y: -176,
      w: W * 0.84,
      h: 6,
      height: 96,
      color: NEUTRAL.screen!,
    },
  ]
}

const blk = (
  id: string,
  kind: BlockKind,
  x: number,
  y: number,
  w: number,
  h: number,
  height: number,
  label?: string,
  color?: string,
  tierId?: string,
): Block => ({
  id,
  kind,
  x,
  y,
  w,
  h,
  height,
  color: color ?? NEUTRAL[kind] ?? '#888',
  label,
  tierId,
})

/**
 * Denah festival berdiri dari kategori tiket nyata. Termahal = pit terdekat panggung; kategori lain berlapis
 * ke belakang. Fasilitas (bar, toilet, P3K, FOH, menara, pintu, akses disabilitas) adalah standar tata letak
 * festival, bukan data venue -- UI menyatakannya sebagai ilustrasi.
 */
export function festivalLayout(tiers: PublicTier[]): FestivalLayout {
  const sorted = [...tiers].sort((a, b) => b.final_price - a.final_price).slice(0, 5)
  const idxOf = (t: PublicTier) =>
    Math.max(
      0,
      tiers.findIndex((x) => x.id === t.id),
    )
  const blocks: Block[] = []
  const zones: Zone[] = []

  blocks.push(blk('stage', 'stage', -190, -170, 380, 130, 30, 'PANGGUNG'))
  blocks.push(blk('screenL', 'screen', -340, -160, 130, 12, 96, 'LED'))
  blocks.push(blk('screenR', 'screen', 210, -160, 130, 12, 96, 'LED'))
  blocks.push(blk('catwalk', 'catwalk', -22, -40, 44, 180, 7, 'Catwalk'))

  const n = Math.max(1, sorted.length)
  const top = -30
  const bottom = 640
  const gap = 16
  let y = top
  const place = (i: number, h: number, w: number) => {
    const t = sorted[i]
    if (!t) return
    const b = blk(`zone-${t.id}`, 'zone', -w / 2, y, w, h, 3, t.name, tierColor(idxOf(t)), t.id)
    blocks.push(b)
    zones.push({ block: b, tier: t, cx: 0, cy: y + h * 0.5 })
    y += h + gap
  }
  if (n === 1) place(0, bottom - top, 680)
  else {
    place(0, 250, 520) // pit depan
    const rest = n - 1
    const each = (bottom - (y + 0) - gap * (rest - 1)) / rest
    for (let i = 1; i < n; i++) place(i, each, 560 + (i - 1) * 70)
  }
  // barikade depan pit + pemisah antar zona
  blocks.push(blk('bar-front', 'barricade', -260, -34, 520, 7, 14))
  for (const z of zones.slice(1)) {
    blocks.push(blk(`bar-${z.block.id}`, 'barricade', z.block.x, z.block.y - 9, z.block.w, 5, 12))
  }

  // FOH & menara di zona tengah-belakang
  const mid = zones[Math.min(zones.length - 1, Math.max(0, zones.length - 1))]!
  const fy = mid.block.y + mid.block.h * 0.38
  blocks.push(blk('foh', 'foh', -55, fy, 110, 64, 30, 'FOH'))
  blocks.push(blk('towerL', 'tower', -330, fy + 10, 26, 26, 120))
  blocks.push(blk('towerR', 'tower', 304, fy + 10, 26, 26, 120))
  blocks.push(blk('ada', 'ada', -250, fy + 4, 100, 70, 10, 'Disabilitas'))
  if (tiers.some((t) => /vip|platinum|lounge|cliffside/i.test(t.name))) {
    blocks.push(blk('lounge', 'lounge', 170, fy + 4, 100, 70, 14, 'Lounge VIP'))
  }

  // sisi kiri & kanan: F&B, toilet, merch, P3K, charging
  const sideL = -500
  const sideR = 390
  const fac: [string, BlockKind, number, number, string][] = [
    ['barL', 'bar', 90, 76, 'F&B'],
    ['wcL', 'toilet', 230, 76, 'Toilet'],
    ['merch', 'merch', 370, 76, 'Merch'],
    ['barR', 'bar', 90, 76, 'F&B'],
    ['wcR', 'toilet', 230, 76, 'Toilet'],
    ['medic', 'medic', 370, 76, 'P3K'],
  ]
  fac.forEach(([id, kind, fy2, h, label], i) => {
    blocks.push(blk(id, kind, i < 3 ? sideL : sideR, fy2, 110, h, 18, label))
  })
  blocks.push(blk('charging', 'charging', sideL, 490, 110, 56, 12, 'Charging'))
  blocks.push(blk('gateA', 'gate', -300, 690, 170, 26, 6, 'Pintu A'))
  blocks.push(blk('gateB', 'gate', 130, 690, 170, 26, 6, 'Pintu B'))
  blocks.push(blk('exitL', 'exit', -530, 560, 22, 70, 6, 'Exit'))
  blocks.push(blk('exitR', 'exit', 508, 560, 22, 70, 6, 'Exit'))

  return { blocks, zones, viewBox: { x: -560, y: -240, w: 1120, h: 1010 } }
}
