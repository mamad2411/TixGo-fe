import { http, type Envelope } from './client'

// Bentuk kartu katalog mengikuti service.EventCard (backend/internal/service/catalog.go).
export interface EventCard {
  id: string
  slug: string
  title: string
  genre: string | null
  poster_url?: string
  starts_at: string
  tz: string
  venue_name: string
  city: string
  min_price: number | null
  min_final_price: number | null
  sale_state: 'upcoming' | 'onsale' | 'full_booked' | 'sold_out' | 'ended' | 'paused' | 'cancelled'
  next_phase_at?: string
  schedule_state: string
  remaining: number
  almost_gone: boolean
  artist_names: string[]
  queue_required: boolean
}

export interface Page<T> {
  data: T[]
  meta: { page: number; per_page: number; total: number }
}

export interface EventQuery {
  q?: string
  city?: string
  genre?: string
  status?: 'upcoming' | 'onsale' | 'soldout'
  sort?: 'date' | 'new' | 'popular'
  date_from?: string
  date_to?: string
  price_min?: number
  price_max?: number
  page?: number
  per_page?: number
}

export async function listEvents(
  query: EventQuery,
  signal?: AbortSignal,
): Promise<Page<EventCard>> {
  const r = await http.get<Page<EventCard>>('/events', { params: query, signal })
  return r.data
}

export interface PublicTier {
  id: string
  name: string
  price: number
  fee: number
  final_price: number
  color: string | null
  capacity: number
  available: number
  held: number
  status: 'available' | 'almost_gone' | 'full_booked' | 'sold_out' | 'unavailable'
}

export interface ArtistView {
  id: string
  slug: string
  name: string
  bio: string | null
  image_url?: string
}

export interface VenueView {
  id: string
  name: string
  city: string
  address: string | null
  lat: number | null
  lng: number | null
  tz: string
  capacity: number | null
  image_url?: string
  /** Atribusi foto (wajib untuk lisensi CC BY/BY-SA) dan tautan sumbernya. */
  image_credit?: string
  image_source?: string
}

export interface PublicEvent extends EventCard {
  description: string | null
  doors_at: string | null
  ends_at: string | null
  venue: VenueView | null
  artists: ArtistView[]
  tiers: PublicTier[]
  phases: { id: string; name: string; audience: string; starts_at: string; ends_at: string }[]
  mode: 'general' | 'seated'
  age_min: number | null
  max_per_order: number
  max_per_account: number
  queue_opens_at?: string
  refund_summary: string
  previous_starts_at?: string
  sales_paused_reason?: string | null
  has_seatmap: boolean
}

export async function getEvent(slug: string, signal?: AbortSignal): Promise<PublicEvent> {
  const r = await http.get<Envelope<PublicEvent>>(`/events/${encodeURIComponent(slug)}`, { signal })
  return r.data.data
}

// ---- aksi pengguna (butuh login) ----
export async function listFavorites(): Promise<EventCard[]> {
  const r = await http.get<Envelope<EventCard[]>>('/me/favorites')
  return r.data.data
}
export async function addFavorite(eventId: string): Promise<void> {
  await http.post(`/me/favorites/${eventId}`)
}
export async function removeFavorite(eventId: string): Promise<void> {
  await http.delete(`/me/favorites/${eventId}`)
}
export async function setReminder(slug: string): Promise<void> {
  await http.post(`/events/${encodeURIComponent(slug)}/reminders`)
}
export async function removeReminder(slug: string): Promise<void> {
  await http.delete(`/events/${encodeURIComponent(slug)}/reminders`)
}
export async function joinWaitlist(slug: string, tierId: string, qty: number): Promise<void> {
  await http.post(`/events/${encodeURIComponent(slug)}/waitlist`, { tier_id: tierId, qty })
}

export interface WaitlistEntry {
  id: string
  event_id: string
  event_title: string
  event_slug: string
  tier_id: string
  tier_name: string
  qty: number
  /** BE hanya mengembalikan yang masih aktif: menunggu atau sedang ditawari. */
  status: 'waiting' | 'offered'
  offered_until?: string
  hold_id?: string
}
export async function listWaitlists(): Promise<WaitlistEntry[]> {
  const r = await http.get<Envelope<WaitlistEntry[]>>('/waitlists')
  return r.data.data
}
export async function leaveWaitlist(slug: string, tierId: string): Promise<void> {
  await http.delete(`/events/${encodeURIComponent(slug)}/waitlist/${encodeURIComponent(tierId)}`)
}

export interface SalePhaseView {
  id: string
  name: string
  audience: string
  starts_at: string
  ends_at: string
}
/** Menukar kode presale: membuka akses ke fase penjualan khusus. BE mengunci 15 menit setelah 5 kode salah. */
export async function redeemPresale(slug: string, code: string): Promise<SalePhaseView> {
  const r = await http.post<Envelope<SalePhaseView>>(
    `/events/${encodeURIComponent(slug)}/presale/redeem`,
    { code },
  )
  return r.data.data
}
/** Mendaftar jadi fans untuk fase fan (hanya sebelum fase mulai). Penyelenggara memilih pesertanya. */
export async function registerFan(slug: string): Promise<void> {
  await http.post(`/events/${encodeURIComponent(slug)}/fan-registration`)
}

/** URL .ics untuk "tambah ke kalender" (publik, diunduh browser). */
export function calendarUrl(slug: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  return `${base}/events/${encodeURIComponent(slug)}/calendar.ics`
}

// ---- denah (hanya acara bernomor; has_seatmap) & ketersediaan per kategori ----
export interface Seatmap {
  sections: { id: string; name: string; tier_id: string }[]
  seats: {
    id: string
    section_id: string
    tier_id: string
    row: string
    no: string
    label: string
    x: number
    y: number
    accessible: boolean
  }[]
}
export interface Availability {
  tiers: { id: string; available: number; held: number; sold: number; status: string }[]
  generated_at: string
}
export async function getSeatmap(slug: string, signal?: AbortSignal): Promise<Seatmap> {
  const r = await http.get<Envelope<Seatmap>>(`/events/${encodeURIComponent(slug)}/seatmap`, {
    signal,
  })
  return r.data.data
}
export async function getAvailability(slug: string, signal?: AbortSignal): Promise<Availability> {
  const r = await http.get<Envelope<Availability>>(
    `/events/${encodeURIComponent(slug)}/availability`,
    {
      signal,
    },
  )
  return r.data.data
}

export interface SeatStatuses {
  held: string[]
  sold: string[]
  blocked: string[]
}
/** Kursi yang tidak tersedia. Kursi lain = tersedia. Cache server 2 detik. */
export async function getSeatStatuses(slug: string, signal?: AbortSignal): Promise<SeatStatuses> {
  const r = await http.get<Envelope<SeatStatuses>>(
    `/events/${encodeURIComponent(slug)}/seats/status`,
    {
      signal,
    },
  )
  return r.data.data
}
