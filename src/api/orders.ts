import { http, type Envelope } from './client'

// Bentuk mengikuti service.HoldView / service.Quote (backend/internal/service/{hold,pricing}.go).
export interface HoldItem {
  seat_id?: string
  label?: string
  tier_id: string
  tier_name: string
  qty: number
  price: number
}
export interface Hold {
  id: string
  event_id: string
  status: string
  expires_at: string
  expires_in: number
  extended_at?: string
  can_extend: boolean
  items: HoldItem[]
  subtotal: number
}
export interface QuoteLine {
  tier_id: string
  name: string
  qty: number
  unit: number
  unit_fee: number
  subtotal: number
}
export interface Quote {
  lines: QuoteLine[]
  addons: { addon_id: string; name: string; qty: number; unit: number; subtotal: number }[]
  subtotal: number
  discount: number
  addons_total: number
  fee: number
  platform_fee: number
  tax: number
  total: number
  currency: string
  promo_code?: string
  fee_payer: string
}

export interface HoldRequest {
  seat_ids?: string[]
  tier_id?: string
  qty?: number
}

export async function createHold(
  slug: string,
  body: HoldRequest,
  admissionToken?: string,
): Promise<Hold> {
  const r = await http.post<Envelope<Hold>>(`/events/${encodeURIComponent(slug)}/holds`, body, {
    headers: admissionToken ? { 'X-Admission-Token': admissionToken } : undefined,
  })
  return r.data.data
}
export async function getHold(id: string): Promise<Hold> {
  const r = await http.get<Envelope<Hold>>(`/holds/${id}`)
  return r.data.data
}
export async function extendHold(id: string): Promise<Hold> {
  const r = await http.post<Envelope<Hold>>(`/holds/${id}/extend`)
  return r.data.data
}
export async function releaseHold(id: string): Promise<void> {
  await http.delete(`/holds/${id}`)
}
/** Rincian harga jujur dari server; `promoCode` kosong = tanpa voucher. */
export async function quote(holdId: string, promoCode?: string): Promise<Quote> {
  const r = await http.post<Envelope<Quote>>('/orders/quote', {
    hold_id: holdId,
    ...(promoCode ? { promo_code: promoCode } : {}),
  })
  return r.data.data
}

// ---- Order & pembayaran (backend/api/openapi.yaml: CreateOrderReq, OrderView, PayResult) ----
export interface Attendee {
  name: string
  email: string
  seat_id?: string
}
export interface CreateOrderBody {
  hold_id: string
  attendees: Attendee[]
  age_confirmed?: boolean
  promo_code?: string
}
export interface OrderItem {
  id: string
  tier_id: string
  tier_name: string
  seat_id: string | null
  seat_label: string | null
  attendee_name: string
  attendee_email: string
  price: number
}
export interface OrderPayment {
  id: string
  status: string
  method: string | null
  redirect_url: string | null
  snap_token: string | null
}
export interface OrderView {
  id: string
  status: string
  event_id: string
  event_slug: string
  event_title: string
  created_at: string
  expires_at: string
  expires_in: number
  paid_at: string | null
  can_pay: boolean
  can_extend: boolean
  invoice_number: string | null
  payment_method: string | null
  payment: OrderPayment | null
  items: OrderItem[]
  quote: Quote
  refund_summary: string
  ticket_ids: string[]
}
export interface PayResult {
  gateway: string
  env: string
  client_key: string
  payment_id: string
  snap_token: string
  redirect_url: string
  reused: boolean
}

/** Idempotency-Key dibuat sekali per percobaan; kirim ulang memakai kunci yang sama. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}
export async function createOrder(body: CreateOrderBody, key: string): Promise<OrderView> {
  const r = await http.post<Envelope<OrderView>>('/orders', body, {
    headers: { 'Idempotency-Key': key },
  })
  return r.data.data
}
export async function getOrder(id: string): Promise<OrderView> {
  const r = await http.get<Envelope<OrderView>>(`/orders/${id}`)
  return r.data.data
}
export async function payOrder(id: string, key: string, method?: string): Promise<PayResult> {
  const r = await http.post<Envelope<PayResult>>(`/orders/${id}/pay`, method ? { method } : {}, {
    headers: { 'Idempotency-Key': key },
  })
  return r.data.data
}
export async function cancelOrder(id: string): Promise<void> {
  await http.post(`/orders/${id}/cancel`)
}

/** Catat persetujuan atas satu dokumen legal berversi (POST /me/consents). */
export async function acceptConsent(documentId: string): Promise<void> {
  await http.post('/me/consents', { document_id: documentId })
}

// ---- refund, invoice ----
export interface RefundEligibility {
  eligible: boolean
  amount: number
  basis?: 'policy' | 'reschedule_window'
  summary: string
  reason?: string
}
export type RefundState =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'awaiting_account'
  | 'refunding'
  | 'refunded'
  | 'refund_failed'
export interface Refund {
  id: string
  order_id: string
  amount: number
  status: RefundState
  method: 'gateway' | 'manual'
  initiated_by: 'buyer' | 'organizer_cancel' | 'admin'
  reason?: string
  note?: string
  needs_account: boolean
  due_at?: string
  created_at: string
}
export async function getRefundEligibility(orderId: string): Promise<RefundEligibility> {
  const r = await http.get<Envelope<RefundEligibility>>(`/orders/${orderId}/refund-eligibility`)
  return r.data.data
}
export async function listOrderRefunds(orderId: string): Promise<Refund[]> {
  const r = await http.get<Envelope<Refund[]>>(`/orders/${orderId}/refunds`)
  return r.data.data
}
export async function requestRefund(orderId: string, reason: string, key: string): Promise<Refund> {
  const r = await http.post<Envelope<Refund>>(
    `/orders/${orderId}/refunds`,
    { reason },
    { headers: { 'Idempotency-Key': key } },
  )
  return r.data.data
}
export async function setRefundAccount(
  refundId: string,
  body: { bank_code: string; account_name: string; account_no: string },
): Promise<Refund> {
  const r = await http.put<Envelope<Refund>>(`/refunds/${refundId}/account`, body)
  return r.data.data
}
/** Unduh invoice PDF (butuh header Authorization, jadi lewat axios lalu simpan lewat <a download>). */
export async function downloadInvoice(orderId: string, filename: string): Promise<void> {
  const r = await http.get<Blob>(`/orders/${orderId}/invoice.pdf`, { responseType: 'blob' })
  const url = URL.createObjectURL(r.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
