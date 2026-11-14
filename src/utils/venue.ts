import type { PublicTier, Seatmap, SeatStatuses } from '@/api/events'
import { tierColor } from '@/utils/tiers'

export type SeatState = 'available' | 'sold' | 'held' | 'blocked'

export interface SeatVM {
  id: string
  sectionId: string
  sectionName: string
  tierId: string
  tierName: string
  price: number
  color: string
  row: string
  no: string
  label: string
  x: number
  y: number
  /** derajat putar agar kursi menghadap panggung (0,0). */
  rot: number
  accessible: boolean
  state: SeatState
}

export interface SectionVM {
  id: string
  name: string
  /** titik label: sedikit di depan baris pertama (menuju panggung). */
  lx: number
  ly: number
  seats: number
  free: number
}

export interface RowLabel {
  key: string
  text: string
  x: number
  y: number
}

/** Gabungkan geometri, status, dan tier menjadi model tampilan. Kursi `blocked` tidak digambar. */
export function buildSeats(map: Seatmap, st: SeatStatuses | null, tiers: PublicTier[]): SeatVM[] {
  const secName = new Map(map.sections.map((s) => [s.id, s.name]))
  const tierIdx = new Map(tiers.map((t, i) => [t.id, i]))
  const tierBy = new Map(tiers.map((t) => [t.id, t]))
  const sold = new Set(st?.sold ?? [])
  const held = new Set(st?.held ?? [])
  const blocked = new Set(st?.blocked ?? [])
  const out: SeatVM[] = []
  for (const s of map.seats) {
    if (blocked.has(s.id)) continue
    const t = tierBy.get(s.tier_id)
    out.push({
      id: s.id,
      sectionId: s.section_id,
      sectionName: secName.get(s.section_id) ?? '',
      tierId: s.tier_id,
      tierName: t?.name ?? '',
      price: t?.final_price ?? 0,
      color: tierColor(tierIdx.get(s.tier_id) ?? 0),
      row: s.row,
      no: s.no,
      label: s.label,
      x: s.x,
      y: s.y,
      rot: (-Math.atan2(s.x, s.y) * 180) / Math.PI,
      accessible: s.accessible,
      state: sold.has(s.id) ? 'sold' : held.has(s.id) ? 'held' : 'available',
    })
  }
  return out
}

export function sectionsOf(seats: SeatVM[]): SectionVM[] {
  const by = new Map<string, SeatVM[]>()
  for (const s of seats) (by.get(s.sectionId) ?? by.set(s.sectionId, []).get(s.sectionId)!).push(s)
  return [...by.entries()].map(([id, list]) => {
    // baris terdekat panggung = radius terkecil
    const rad = (s: SeatVM) => Math.hypot(s.x, s.y)
    const minR = Math.min(...list.map(rad))
    const front = list.filter((s) => rad(s) < minR + 6)
    const cx = front.reduce((a, s) => a + s.x, 0) / front.length
    const cy = front.reduce((a, s) => a + s.y, 0) / front.length
    const k = (minR - 54) / minR
    return {
      id,
      name: list[0]!.sectionName,
      lx: cx * k,
      ly: cy * k,
      seats: list.length,
      free: list.filter((s) => s.state === 'available').length,
    }
  })
}

/** Huruf baris di ujung kiri tiap baris per seksi (dipakai sebagai penunjuk, bukan data). */
export function rowLabels(seats: SeatVM[]): RowLabel[] {
  const rows = new Map<string, SeatVM[]>()
  for (const s of seats) {
    const k = `${s.sectionId}|${s.row}`
    ;(rows.get(k) ?? rows.set(k, []).get(k)!).push(s)
  }
  const out: RowLabel[] = []
  for (const [key, list] of rows) {
    const left = list.reduce((a, b) => (a.x < b.x ? a : b))
    const R = Math.hypot(left.x, left.y) || 1
    // 20 satuan ke arah tangen kiri busur: (-cosθ, sinθ) dengan cosθ=y/R, sinθ=x/R
    out.push({ key, text: left.row, x: left.x - (20 * left.y) / R, y: left.y + (20 * left.x) / R })
  }
  return out
}

export function bounds(seats: SeatVM[]): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const s of seats) {
    if (s.x < minX) minX = s.x
    if (s.x > maxX) maxX = s.x
    if (s.y < minY) minY = s.y
    if (s.y > maxY) maxY = s.y
  }
  return { minX, maxX, minY, maxY }
}

export interface Sector {
  key: string
  sectionName: string
  tierName: string
  color: string
  price: number
  d: string
  /** pusat label */
  cx: number
  cy: number
  total: number
  free: number
}

const pol = (r: number, a: number) =>
  `${(r * Math.sin(a)).toFixed(1)} ${(r * Math.cos(a)).toFixed(1)}`

/**
 * Bidang zona (sektor cincin) per seksi x kategori: tampilan awal peta sebelum kursi muncul saat zoom.
 * Sudut 0 = lurus ke depan panggung; x = r sin a, y = r cos a.
 */
export function sectors(seats: SeatVM[]): Sector[] {
  const by = new Map<string, SeatVM[]>()
  for (const s of seats) {
    const k = `${s.sectionId}|${s.tierId}`
    ;(by.get(k) ?? by.set(k, []).get(k)!).push(s)
  }
  const out: Sector[] = []
  for (const [key, list] of by) {
    const rs = list.map((s) => Math.hypot(s.x, s.y))
    const as = list.map((s) => Math.atan2(s.x, s.y))
    const rMin = Math.min(...rs) - 15
    const rMax = Math.max(...rs) + 15
    const mid = (rMin + rMax) / 2
    const pad = 14 / mid
    const a1 = Math.min(...as) - pad
    const a2 = Math.max(...as) + pad
    const large = a2 - a1 > Math.PI ? 1 : 0
    const d = `M ${pol(rMin, a1)} A ${rMin} ${rMin} 0 ${large} 0 ${pol(rMin, a2)} L ${pol(rMax, a2)} A ${rMax} ${rMax} 0 ${large} 1 ${pol(rMax, a1)} Z`
    const am = (a1 + a2) / 2
    const first = list[0]!
    out.push({
      key,
      sectionName: first.sectionName,
      tierName: first.tierName,
      color: first.color,
      price: first.price,
      d,
      cx: mid * Math.sin(am),
      cy: mid * Math.cos(am),
      total: list.length,
      free: list.filter((s) => s.state === 'available').length,
    })
  }
  return out
}
