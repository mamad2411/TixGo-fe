import type { Zone } from '@/utils/festival'
import type { SeatVM } from '@/utils/venue'

// Panduan zona: menjelaskan LETAK tiap zona/seksi terhadap panggung tanpa membuka denah penuh.
// Semua dihitung dari koordinat yang sudah ada (panggung di titik asal, y positif ke arah penonton).

export type Depth = 'front' | 'mid' | 'back'
export type Side = 'left' | 'center' | 'right'

export interface GuideItem {
  id: string
  tierId: string
  name: string
  tierName: string
  color: string
  price: number
  free: number
  total: number
  cx: number
  cy: number
  depth: Depth
  side: Side
  /** kumpulan titik kursi (satu path, stroke bulat) untuk acara bernomor. */
  dots?: string
  /** kotak zona untuk acara berdiri. */
  rect?: { x: number; y: number; w: number; h: number }
}

type Raw = Omit<GuideItem, 'depth' | 'side'>

/** Beri label depan/tengah/belakang (berdasar jarak ke panggung) dan kiri/tengah/kanan (dari sisi penonton). */
export function classify(items: Raw[], origin: { x: number; y: number }): GuideItem[] {
  const dist = items.map((i) => Math.hypot(i.cx - origin.x, i.cy - origin.y))
  const minD = Math.min(...dist)
  const maxD = Math.max(...dist)
  const half = Math.max(1, ...items.map((i) => Math.abs(i.cx - origin.x)))
  return items.map((it, n) => {
    const f = maxD - minD < 1 ? 0.5 : (dist[n]! - minD) / (maxD - minD)
    const dx = it.cx - origin.x
    return {
      ...it,
      depth: f < 0.34 ? 'front' : f < 0.67 ? 'mid' : 'back',
      side: Math.abs(dx) <= half * 0.22 ? 'center' : dx < 0 ? 'left' : 'right',
    }
  })
}

const r1 = (n: number): number => Math.round(n * 10) / 10

/** Satu item per seksi bernomor. Posisi = rata-rata kursi; titik-titik kursi digambar sebagai satu path. */
export function seatGuide(seats: SeatVM[]): GuideItem[] {
  const by = new Map<string, SeatVM[]>()
  for (const s of seats) {
    const list = by.get(s.sectionId)
    if (list) list.push(s)
    else by.set(s.sectionId, [s])
  }
  const raw: Raw[] = []
  for (const [id, list] of by) {
    const first = list[0]!
    let sx = 0
    let sy = 0
    let d = ''
    let free = 0
    for (const s of list) {
      sx += s.x
      sy += s.y
      d += `M${r1(s.x)} ${r1(s.y)}h0`
      if (s.state === 'available') free++
    }
    raw.push({
      id,
      tierId: first.tierId,
      name: first.sectionName,
      tierName: first.tierName,
      color: first.color,
      price: first.price,
      free,
      total: list.length,
      cx: sx / list.length,
      cy: sy / list.length,
      dots: d,
    })
  }
  raw.sort((a, b) => Math.hypot(a.cx, a.cy) - Math.hypot(b.cx, b.cy))
  return classify(raw, { x: 0, y: 0 })
}

/** Satu item per zona acara berdiri/festival; origin = pusat blok panggung. */
export function zoneGuide(
  zones: Zone[],
  stage: { x: number; y: number; w: number; h: number },
): GuideItem[] {
  const raw: Raw[] = zones.map((z) => ({
    id: z.tier.id,
    tierId: z.tier.id,
    name: z.tier.name,
    tierName: z.tier.name,
    color: z.block.color,
    price: z.tier.final_price,
    free: z.tier.available,
    total: z.tier.capacity,
    cx: z.cx,
    cy: z.cy,
    rect: { x: z.block.x, y: z.block.y, w: z.block.w, h: z.block.h },
  }))
  return classify(raw, { x: stage.x + stage.w / 2, y: stage.y + stage.h / 2 })
}
