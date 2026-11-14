import { newIdempotencyKey } from './orders'
import { http, type Envelope } from './client'
import type { OrderView } from './orders'

// Jual-beli ulang tiket berplafon (harga jual <= plafon % dari harga asli). Sisi penjual (pasang/batal)
// ada di api/account.ts; di sini sisi pembeli dan pencairan hasil jual.
export interface EventListing {
  id: string
  price: number
  face_price: number
  buyer_fee: number
  buyer_pays: number
  seat_label?: string
  tier_name?: string
  created_at: string
}
export interface EventResale {
  cap_pct: number
  listings: EventListing[]
}
export async function getEventResale(slug: string): Promise<EventResale> {
  const r = await http.get<Envelope<EventResale>>(`/events/${encodeURIComponent(slug)}/resale`)
  return r.data.data
}
/** Memesan listing (ditahan 10 menit) dan membuat order pending; lanjut bayar di /pesanan/:id/bayar. */
export async function buyListing(listingId: string, key = newIdempotencyKey()): Promise<OrderView> {
  const r = await http.post<Envelope<OrderView>>(
    `/resale/listings/${encodeURIComponent(listingId)}/buy`,
    {},
    { headers: { 'Idempotency-Key': key } },
  )
  return r.data.data
}

export interface SellerPayout {
  id: string
  listing_id: string
  amount: number
  status: 'awaiting_account' | 'ready' | 'paid'
  bank_code?: string
  account_name?: string
  created_at: string
  paid_at?: string
}
export async function myPayouts(): Promise<SellerPayout[]> {
  const r = await http.get<Envelope<SellerPayout[]>>('/me/resale/payouts')
  return r.data.data
}
export async function setPayoutAccount(
  id: string,
  body: { bank_code: string; account_name: string; account_no: string },
): Promise<void> {
  await http.put(`/resale/payouts/${encodeURIComponent(id)}/account`, body)
}
