import { http, type Envelope } from './client'
import type { Artist } from './artists'
import type { Page, VenueView } from './events'

// Bentuk mengikuti service.EventView / TierInput / VenueInput (backend/internal/service).
export interface OrgTier {
  id: string
  name: string
  price: number
  quota: number
  sold: number
  held: number
  comp_quota: number
  color: string | null
}
export interface RefundPolicy {
  type: 'non_refundable' | 'refundable'
  refundable_until?: string
  deduction_pct?: number
  fee_refundable: boolean
}
export interface OrgEvent {
  id: string
  slug: string
  title: string
  description: string
  genre: string | null
  poster_url?: string
  venue: VenueView | null
  starts_at: string
  doors_at: string | null
  ends_at: string | null
  mode: 'seated' | 'general'
  status:
    'draft' | 'in_review' | 'approved' | 'published' | 'paused' | 'cancelled' | 'finished' | string
  max_per_order: number
  max_per_account: number
  refund_policy: RefundPolicy
  artists: Artist[]
  tiers: OrgTier[]
  created_at: string
}
export interface OrgEventInput {
  venue_id?: string
  title?: string
  description?: string
  genre?: string
  poster_asset_id?: string
  starts_at?: string
  doors_at?: string
  ends_at?: string
  mode?: 'seated' | 'general'
  max_per_order?: number
  max_per_account?: number
  refund_policy?: RefundPolicy
  artist_ids?: string[]
}
export interface VenueInput {
  name?: string
  city?: string
  address?: string
  lat?: number
  lng?: number
  tz?: string
  capacity?: number
  image_asset_id?: string
  image_credit?: string
}
export interface ArtistInput {
  name?: string
  bio?: string
  image_asset_id?: string
}
export interface TierInput {
  name?: string
  price?: number
  quota?: number
}

const P = '/organizer'
type Kind = 'poster' | 'artist' | 'venue'
/** Unggah gambar lewat jalur resmi (diproses jadi varian 400/800/1600); mengembalikan id aset. */
export async function uploadMedia(kind: Kind, file: Blob, name = 'upload.jpg'): Promise<string> {
  const fd = new FormData()
  fd.append('kind', kind)
  fd.append('file', file, name)
  const r = await http.post<Envelope<{ id: string }>>('/media', fd)
  return r.data.data.id
}

export async function listOrgEvents(page = 1): Promise<Page<OrgEvent>> {
  const r = await http.get<Page<OrgEvent>>(`${P}/events`, { params: { page, per_page: 50 } })
  return r.data
}
export async function getOrgEvent(id: string): Promise<OrgEvent> {
  const r = await http.get<Envelope<OrgEvent>>(`${P}/events/${id}`)
  return r.data.data
}
export async function createOrgEvent(b: OrgEventInput): Promise<OrgEvent> {
  const r = await http.post<Envelope<OrgEvent>>(`${P}/events`, b)
  return r.data.data
}
export async function updateOrgEvent(id: string, b: OrgEventInput): Promise<OrgEvent> {
  const r = await http.patch<Envelope<OrgEvent>>(`${P}/events/${id}`, b)
  return r.data.data
}
export async function eventAction(
  id: string,
  a: 'submit' | 'publish' | 'withdraw',
): Promise<OrgEvent> {
  const r = await http.post<Envelope<OrgEvent>>(`${P}/events/${id}/${a}`, {})
  return r.data.data
}
export async function addTier(id: string, b: TierInput): Promise<void> {
  await http.post(`${P}/events/${id}/tiers`, b)
}
export async function updateTier(id: string, tid: string, b: TierInput): Promise<void> {
  await http.patch(`${P}/events/${id}/tiers/${tid}`, b)
}
export async function deleteTier(id: string, tid: string): Promise<void> {
  await http.delete(`${P}/events/${id}/tiers/${tid}`)
}
export async function createVenue(b: VenueInput): Promise<VenueView> {
  const r = await http.post<Envelope<VenueView>>(`${P}/venues`, b)
  return r.data.data
}
export async function updateVenue(id: string, b: VenueInput): Promise<VenueView> {
  const r = await http.patch<Envelope<VenueView>>(`${P}/venues/${id}`, b)
  return r.data.data
}
export async function createArtist(b: ArtistInput): Promise<Artist> {
  const r = await http.post<Envelope<Artist>>(`${P}/artists`, b)
  return r.data.data
}
export async function updateArtist(id: string, b: ArtistInput): Promise<Artist> {
  const r = await http.patch<Envelope<Artist>>(`${P}/artists/${id}`, b)
  return r.data.data
}

// ---- penjualan & peserta (BE: analytics.go, attendee.go) ----
export interface SeriesPoint {
  t: string
  orders: number
  tickets: number
  revenue: number
}
export interface FunnelStage {
  stage: string
  count: number
  conversion_from_prev: number
}
export interface Attendee {
  ticket_id: string
  status: 'valid' | 'used' | 'void' | 'refunded' | 'transferred' | string
  origin: string
  entry_number?: string
  seat_label?: string
  attendee_name?: string
  tier_id: string
  tier: string
  owner_email: string
  checked_in_at?: string
  issued_at: string
}
export interface AttendeeQuery {
  q?: string
  status?: string
  tier_id?: string
  page?: number
}

export async function getSales(
  id: string,
  from: Date,
  to: Date,
  bucket: 'day' | 'hour' = 'day',
): Promise<SeriesPoint[]> {
  const r = await http.get<Envelope<SeriesPoint[]>>(`${P}/events/${id}/analytics/sales`, {
    params: { bucket, from: from.toISOString(), to: to.toISOString() },
  })
  return r.data.data
}
export async function getFunnel(id: string): Promise<FunnelStage[]> {
  const r = await http.get<Envelope<FunnelStage[]>>(`${P}/events/${id}/analytics/funnel`)
  return r.data.data
}
export async function listAttendees(id: string, q: AttendeeQuery): Promise<Page<Attendee>> {
  const r = await http.get<Page<Attendee>>(`${P}/events/${id}/attendees`, {
    params: {
      q: q.q || undefined,
      status: q.status || undefined,
      tier_id: q.tier_id || undefined,
      page: q.page ?? 1,
      per_page: 25,
    },
  })
  return r.data
}
/** Unduh CSV peserta (butuh header Authorization, jadi lewat klien HTTP lalu disimpan sebagai berkas). */
export async function downloadAttendeesCsv(id: string, q: AttendeeQuery): Promise<void> {
  const r = await http.get<Blob>(`${P}/events/${id}/attendees.csv`, {
    responseType: 'blob',
    params: { q: q.q || undefined, status: q.status || undefined, tier_id: q.tier_id || undefined },
  })
  const url = URL.createObjectURL(r.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `peserta-${id}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
export async function ticketAction(
  id: string,
  tid: string,
  action: 'void' | 'reissue' | 'rename',
  body?: { name: string },
): Promise<void> {
  await http.post(`${P}/events/${id}/tickets/${tid}/${action}`, body)
}

// ---- kontrol event & promo (BE: organizer_events.go, lifecycle.go, promo.go) ----
export interface Promo {
  id: string
  code: string
  kind: 'percent' | 'fixed'
  value: number
  max_uses: number | null
  used: number
  max_per_account: number
  starts_at: string | null
  ends_at: string | null
  min_total: number
  tier_ids: string[]
  active: boolean
}
export interface PromoInput {
  code: string
  kind: 'percent' | 'fixed'
  value: number
  max_uses?: number
  max_per_account?: number
  starts_at?: string
  ends_at?: string
  min_total?: number
  tier_ids?: string[]
}
export interface PromoReport {
  redemptions: number
  discount_total: number
  revenue: number
}

export async function pauseSales(id: string, reason: string): Promise<OrgEvent> {
  const r = await http.post<Envelope<OrgEvent>>(`${P}/events/${id}/pause-sales`, { reason })
  return r.data.data
}
export async function resumeSales(id: string): Promise<OrgEvent> {
  const r = await http.post<Envelope<OrgEvent>>(`${P}/events/${id}/resume-sales`)
  return r.data.data
}
export async function rescheduleEvent(
  id: string,
  b: { starts_at: string; ends_at?: string; doors_at?: string },
): Promise<OrgEvent> {
  const r = await http.post<Envelope<OrgEvent>>(`${P}/events/${id}/reschedule`, b)
  return r.data.data
}
export async function postponeEvent(id: string): Promise<OrgEvent> {
  const r = await http.post<Envelope<OrgEvent>>(`${P}/events/${id}/postpone`)
  return r.data.data
}
export async function cancelEvent(id: string, reason: string): Promise<OrgEvent> {
  const r = await http.post<Envelope<OrgEvent>>(`${P}/events/${id}/cancel`, { reason })
  return r.data.data
}
export async function duplicateEvent(
  id: string,
  b: { title?: string; starts_at: string; ends_at?: string },
): Promise<OrgEvent> {
  const r = await http.post<Envelope<OrgEvent>>(`${P}/events/${id}/duplicate`, b)
  return r.data.data
}
export async function listPromos(id: string): Promise<Promo[]> {
  const r = await http.get<Envelope<Promo[]>>(`${P}/events/${id}/promos`)
  return r.data.data
}
export async function createPromo(id: string, b: PromoInput): Promise<Promo> {
  const r = await http.post<Envelope<Promo>>(`${P}/events/${id}/promos`, b)
  return r.data.data
}
export async function patchPromo(
  id: string,
  pid: string,
  b: { active?: boolean; max_uses?: number; starts_at?: string; ends_at?: string },
): Promise<Promo> {
  const r = await http.patch<Envelope<Promo>>(`${P}/events/${id}/promos/${pid}`, b)
  return r.data.data
}
export async function promoReport(id: string, pid: string): Promise<PromoReport> {
  const r = await http.get<Envelope<PromoReport>>(`${P}/events/${id}/promos/${pid}/report`)
  return r.data.data
}
