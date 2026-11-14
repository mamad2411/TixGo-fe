import { http, type Envelope } from './client'
import type { Page } from './events'
import type { OrgEvent } from './organizer'

// Panel admin. Bentuk mengikuti service.EventView / service.BusinessDashboard (OpenAPI admin masih longgar).
const P = '/admin'

export interface FunnelStage {
  stage: string
  count: number
  /** 0..1 terhadap tahap sebelumnya */
  conversion_from_prev: number
}
export interface BusinessDashboard {
  funnel: FunnelStage[]
  median_checkout_sec: number
  paid_orders: number
  payment_methods: Record<string, unknown>[]
}
export type ReviewFilter = 'in_review' | 'approved' | 'published' | ''

export async function getBusiness(): Promise<BusinessDashboard> {
  const r = await http.get<Envelope<BusinessDashboard>>(`${P}/analytics/business`)
  return r.data.data
}
export async function listReviewEvents(status: ReviewFilter, page = 1): Promise<Page<OrgEvent>> {
  const r = await http.get<Page<OrgEvent>>(`${P}/events/review`, {
    params: { status: status || undefined, page, per_page: 20 },
  })
  return r.data
}
export async function getReviewEvent(id: string): Promise<OrgEvent> {
  const r = await http.get<Envelope<OrgEvent>>(`${P}/events/${id}`)
  return r.data.data
}
/** approve -> approved; reject -> kembali ke draf + alasan (alasan WAJIB untuk reject; BE memvalidasi). */
export async function reviewEvent(
  id: string,
  decision: 'approve' | 'reject',
  note = '',
): Promise<OrgEvent> {
  const r = await http.post<Envelope<OrgEvent>>(`${P}/events/${id}/review`, { decision, note })
  return r.data.data
}

// ---- organizer & KYB (BE: admin.go) ----
export interface Organizer {
  id: string
  name: string
  type: string
  legal_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  kyb_status: 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'needs_info' | string
  kyb_reason?: string | null
  status: 'active' | 'suspended' | string
  can_sell_paid: boolean
  created_at: string
}
export interface KybDoc {
  id: string
  kind: string
  created_at: string
}
export interface KybBank {
  id: string
  bank_code: string
  account_no_masked: string
  account_name: string
  verified: boolean
  usable: boolean
}
export interface KybItem extends Organizer {
  owner_user_id: string
  documents?: KybDoc[]
  banks?: KybBank[]
}
export async function listOrganizers(status: string, page = 1): Promise<Page<Organizer>> {
  const r = await http.get<Page<Organizer>>(`${P}/kyb`, {
    params: { status: status || undefined, page, per_page: 20 },
  })
  return r.data
}
export async function getOrganizer(id: string): Promise<KybItem> {
  const r = await http.get<Envelope<KybItem>>(`${P}/kyb/${id}`)
  return r.data.data
}
export async function documentUrl(id: string, docId: string): Promise<string> {
  const r = await http.get<Envelope<{ url: string }>>(`${P}/kyb/${id}/documents/${docId}/url`)
  return r.data.data.url
}
export async function reviewKyb(
  id: string,
  decision: 'approve' | 'reject' | 'needs_info',
  reason = '',
): Promise<void> {
  await http.post(`${P}/kyb/${id}/review`, { decision, reason })
}
export async function setOrganizerSuspended(id: string, suspended: boolean): Promise<void> {
  await http.post(`${P}/organizers/${id}/${suspended ? 'suspend' : 'unsuspend'}`)
}

// ---- pengguna (BE: adminusers.go) ----
export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  status: 'active' | 'blocked' | string
  mfa_enabled: boolean
  created_at: string
  last_login_at?: string
  risk_score: number
  orders?: number
  tickets?: number
}
export interface RiskSignal {
  id?: string
  kind?: string
  signal?: string
  score?: number
  detail?: unknown
  created_at?: string
}
/** BE mengembalikan daftar polos (tanpa meta total): halaman berikutnya ada bila hasil memenuhi satu halaman. */
export async function searchUsers(
  q: { q?: string; role?: string; status?: string },
  page = 1,
  perPage = 20,
): Promise<{ data: AdminUser[]; hasMore: boolean }> {
  const r = await http.get<Envelope<AdminUser[]>>(`${P}/users`, {
    params: {
      q: q.q || undefined,
      role: q.role || undefined,
      status: q.status || undefined,
      page,
      per_page: perPage,
    },
  })
  const data = r.data.data ?? []
  return { data, hasMore: data.length >= perPage }
}
export async function getUser(id: string): Promise<AdminUser> {
  const r = await http.get<Envelope<AdminUser>>(`${P}/users/${id}`)
  return r.data.data
}
export async function userSignals(id: string): Promise<RiskSignal[]> {
  const r = await http.get<Envelope<RiskSignal[]>>(`${P}/users/${id}/risk-signals`)
  return r.data.data ?? []
}
export async function blockUser(id: string, reason: string): Promise<void> {
  await http.post(`${P}/users/${id}/block`, { reason })
}
export async function unblockUser(id: string): Promise<void> {
  await http.post(`${P}/users/${id}/unblock`)
}
export async function setUserRole(id: string, role: string): Promise<void> {
  await http.put(`${P}/users/${id}/role`, { role })
}

// ---- pencairan (BE: finance.go; peran finance/admin + MFA) ----
export interface Payout {
  id: string
  organizer_id: string
  organizer_name?: string
  amount: number
  status: 'requested' | 'approved' | 'rejected' | 'processing' | 'paid' | 'failed' | string
  bank_code?: string
  account_name?: string
  account_no?: string
  account_last4?: string
  requested_by: string
  approved_by?: string | null
  note?: string | null
  has_proof: boolean
  created_at: string
  paid_at?: string | null
}
export async function listPayouts(status: string, page = 1): Promise<Page<Payout>> {
  const r = await http.get<Page<Payout>>(`${P}/finance/payouts`, {
    params: { status: status || undefined, page, per_page: 20 },
  })
  return r.data
}
export async function payoutAction(
  id: string,
  action: 'approve' | 'reject' | 'process' | 'fail',
  note = '',
): Promise<Payout> {
  const r = await http.post<Envelope<Payout>>(
    `${P}/finance/payouts/${id}/${action}`,
    action === 'reject' || action === 'fail' ? { note } : undefined,
  )
  return r.data.data
}
export async function payoutMarkPaid(id: string, proof: File, note = ''): Promise<Payout> {
  const f = new FormData()
  f.append('proof', proof)
  if (note) f.append('note', note)
  const r = await http.post<Envelope<Payout>>(`${P}/finance/payouts/${id}/mark-paid`, f)
  return r.data.data
}
