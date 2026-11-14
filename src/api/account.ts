import type { UserView } from './auth'
import { http, type Envelope } from './client'
import type { Page } from './events'

export interface OrderBrief {
  id: string
  event_slug: string
  event_title: string
  status: string
  total: number
  created_at: string
  expires_at: string
  poster_url?: string
  starts_at: string
}
export interface TicketBrief {
  id: string
  event_slug: string
  event_title: string
  tier_name: string
  seat_label: string | null
  attendee_name: string | null
  status: string
  starts_at: string
  tz: string
  venue_name: string
  qr_available: boolean
  poster_url?: string
}

export async function listOrders(page = 1): Promise<Page<OrderBrief>> {
  const r = await http.get<Page<OrderBrief>>('/orders', { params: { page, per_page: 20 } })
  return r.data
}
export async function listTickets(page = 1): Promise<Page<TicketBrief>> {
  const r = await http.get<Page<TicketBrief>>('/tickets', { params: { page, per_page: 20 } })
  return r.data
}
export async function updateProfile(body: {
  name?: string
  locale?: 'id' | 'en'
  /** id aset hasil unggahan kind=avatar; string kosong = hapus foto */
  avatar_asset_id?: string
}): Promise<UserView> {
  const r = await http.patch<Envelope<UserView>>('/me', body)
  return r.data.data
}
export async function changePassword(
  current: string,
  next: string,
  sf: { mfa_method?: string; mfa_code?: string } = {},
): Promise<void> {
  await http.post('/me/password', { current_password: current, new_password: next, ...sf })
}

/** Unggah foto profil (kind=avatar) lalu pasang ke akun. Blob sudah dipotong persegi di klien. */
export async function setAvatar(blob: Blob): Promise<UserView> {
  const fd = new FormData()
  fd.append('kind', 'avatar')
  fd.append('file', blob, 'avatar.jpg')
  const up = await http.post<Envelope<{ id: string }>>('/media', fd)
  return updateProfile({ avatar_asset_id: up.data.data.id })
}
export const removeAvatar = (): Promise<UserView> => updateProfile({ avatar_asset_id: '' })

export type VoucherStatus = 'available' | 'upcoming' | 'used' | 'expired' | 'exhausted'
export interface Voucher {
  promo_id: string
  code: string
  kind: 'percent' | 'fixed'
  value: number
  min_total: number
  tier_ids: string[]
  starts_at: string | null
  ends_at: string | null
  status: VoucherStatus
  event_id: string
  event_slug: string
  event_title: string
  saved_at: string
}
export async function listVouchers(): Promise<Voucher[]> {
  const r = await http.get<Envelope<Voucher[]>>('/me/vouchers')
  return r.data.data
}
export async function redeemVoucher(code: string): Promise<Voucher[]> {
  const r = await http.post<Envelope<Voucher[]>>('/me/vouchers', { code })
  return r.data.data
}
export async function removeVoucher(promoId: string): Promise<void> {
  await http.delete(`/me/vouchers/${promoId}`)
}

/** URL gambar profil dari avatar_key (= id aset media); varian 400px selalu ada. */
export const avatarUrl = (key?: string | null): string | null =>
  key ? `/api/v1/media/${key}/400.jpg` : null

// ---- detail tiket, QR, kirim tiket, jual ulang ----
export interface TicketDetail extends TicketBrief {
  event_id: string
  doors_at: string | null
  venue_address: string | null
  entry_number: string | null
  origin: string
  event_status: string
  schedule_state: string
  used_at?: string
}
export interface TicketQR {
  payload: string
  step_sec: number
  valid_until: string
}
export interface ClaimLink {
  id: string
  ticket_id: string
  target_email?: string
  expires_at: string
  status: string
  /** hanya ada saat tautan baru dibuat */
  link?: string
}
export interface ResaleListing {
  id: string
  price: number
  face_price: number
  buyer_fee: number
  buyer_pays: number
  status?: string
  ticket_id?: string
  created_at: string
}
export async function getTicket(id: string): Promise<TicketDetail> {
  const r = await http.get<Envelope<TicketDetail>>(`/tickets/${id}`)
  return r.data.data
}
export async function getTicketQR(id: string): Promise<TicketQR> {
  const r = await http.get<Envelope<TicketQR>>(`/tickets/${id}/qr`)
  return r.data.data
}
export async function createTransfer(id: string, email?: string): Promise<ClaimLink> {
  const r = await http.post<Envelope<ClaimLink>>(`/tickets/${id}/transfer`, email ? { email } : {})
  return r.data.data
}
export async function revokeTransfer(id: string): Promise<void> {
  await http.delete(`/tickets/${id}/transfer`)
}
export async function createResale(id: string, price: number): Promise<ResaleListing> {
  const r = await http.post<Envelope<ResaleListing>>(`/tickets/${id}/resale`, { price })
  return r.data.data
}
export async function myListings(): Promise<ResaleListing[]> {
  const r = await http.get<Envelope<ResaleListing[]>>('/me/resale/listings')
  return r.data.data
}
export async function cancelListing(listingId: string): Promise<void> {
  await http.delete(`/resale/listings/${listingId}`)
}

// ---- klaim tiket kiriman ----
export interface ClaimPreview {
  event_title: string
  starts_at: string
  seat_label?: string
  from_name: string
  expires_at: string
  targeted: boolean
}
export async function previewClaim(token: string): Promise<ClaimPreview> {
  const r = await http.get<Envelope<ClaimPreview>>(`/claims/${encodeURIComponent(token)}`)
  return r.data.data
}
export async function acceptClaim(token: string): Promise<TicketBrief> {
  const r = await http.post<Envelope<TicketBrief>>(`/claims/${encodeURIComponent(token)}/accept`)
  return r.data.data
}

// ---- dokumen legal (markdown dari BE) ----
export interface LegalDoc {
  id: string
  kind: string
  locale: string
  version: number
  title: string
  body: string
  published_at?: string
}
export interface LegalVersion {
  id: string
  kind: string
  locale: string
  version: number
  title: string
  published_at: string | null
  created_at: string
}
/** Riwayat versi dokumen legal (semua versi yang pernah dibuat; yang published_at kosong belum terbit). */
export async function getLegalVersions(kind: string, locale: string): Promise<LegalVersion[]> {
  const r = await http.get<Envelope<LegalVersion[]>>(
    `/legal/${encodeURIComponent(kind)}/versions`,
    { params: { locale } },
  )
  return r.data.data
}
export interface ComplaintBody {
  name?: string
  email: string
  subject: string
  body: string
}
/** Pengaduan privasi (publik, dibatasi 5/jam per jaringan). Ditangani penanggung jawab privasi dalam 14 hari. */
export async function sendPrivacyComplaint(b: ComplaintBody): Promise<void> {
  await http.post('/privacy/complaints', b)
}
export async function getLegal(kind: string, locale: string): Promise<LegalDoc> {
  const r = await http.get<Envelope<LegalDoc>>(`/legal/${encodeURIComponent(kind)}`, {
    params: { locale },
  })
  return r.data.data
}
