import type { EventQuery } from '@/api/events'

export interface Filters {
  q: string
  city: string
  genre: string
  status: '' | 'onsale' | 'upcoming' | 'soldout'
  when: '' | '7d' | '30d' | '90d' | 'weekend'
  price: '' | 'lt200' | '200-500' | 'gt500'
  sort: '' | 'new' | 'popular'
  /** Koleksi: hot = hampir habis, soon = segera dibuka, all = semua konser (berhalaman, dengan filter). */
  koleksi: '' | 'hot' | 'soon' | 'all'
}

export const EMPTY_FILTERS: Filters = {
  q: '',
  city: '',
  genre: '',
  status: '',
  when: '',
  price: '',
  sort: '',
  koleksi: '',
}

const KOLEKSI = ['hot', 'soon', 'all'] as const
const WHEN = ['7d', '30d', '90d', 'weekend'] as const
const PRICE = ['lt200', '200-500', 'gt500'] as const
const STATUS = ['onsale', 'upcoming', 'soldout'] as const
const SORT = ['new', 'popular'] as const

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | '' =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : ''

/** Query-string -> Filters. Nilai tak dikenal dibuang (URL bisa diketik/dirusak orang). */
export function filtersFromQuery(q: Record<string, unknown>): Filters {
  const s = (v: unknown) => (typeof v === 'string' ? v.slice(0, 100) : '')
  return {
    q: s(q.q),
    city: s(q.city),
    genre: s(q.genre),
    status: pick(q.status, STATUS),
    when: pick(q.when, WHEN),
    price: pick(q.price, PRICE),
    sort: pick(q.sort, SORT),
    koleksi: pick(q.koleksi, KOLEKSI),
  }
}

/** Jumlah filter yang menyaring hasil (urutan tidak dihitung). */
export function activeCount(f: Filters): number {
  return [f.q, f.city, f.genre, f.status, f.when, f.price].filter(Boolean).length
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** Rentang tanggal [from, to) untuk preset "kapan". `now` bisa disuntik untuk tes. */
export function whenRange(
  w: Filters['when'],
  now = new Date(),
): { from: string; to: string } | null {
  if (!w) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (w === 'weekend') {
    const dow = today.getDay() // 0 = Minggu
    const toSat = (6 - dow + 7) % 7
    const sat = dow === 0 ? addDays(today, -1) : addDays(today, toSat)
    const start = sat < today ? today : sat
    return { from: ymd(start), to: ymd(addDays(sat, 2)) }
  }
  const days = w === '7d' ? 7 : w === '30d' ? 30 : 90
  return { from: ymd(today), to: ymd(addDays(today, days)) }
}

const PRICE_RANGE: Record<(typeof PRICE)[number], { min?: number; max?: number }> = {
  lt200: { max: 199_999 },
  '200-500': { min: 200_000, max: 500_000 },
  gt500: { min: 500_001 },
}

/** Filters -> parameter /events. */
export function toApiQuery(
  f: Filters,
  page: number,
  perPage: number,
  now = new Date(),
): EventQuery {
  const r = whenRange(f.when, now)
  const p = f.price ? PRICE_RANGE[f.price] : undefined
  // Koleksi menetapkan status penjualannya sendiri; "hot" disaring lagi di klien (almost_gone dihitung di BE).
  const status = f.koleksi === 'hot' ? 'onsale' : f.koleksi === 'soon' ? 'upcoming' : f.status
  return {
    q: f.q || undefined,
    city: f.city || undefined,
    genre: f.genre || undefined,
    status: status || undefined,
    sort: f.sort || undefined,
    date_from: r?.from,
    date_to: r?.to,
    price_min: p?.min,
    price_max: p?.max,
    page,
    per_page: perPage,
  }
}
