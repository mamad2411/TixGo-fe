import { http, type Envelope } from './client'
import type { Page } from './events'

// ---- notifikasi ----
export interface Notice {
  id: string
  template: string
  channel: string
  status: string
  created_at: string
  /** Dirender BE dari templat; kosong bila templat tidak dikenal. */
  title: string
  body: string
  read: boolean
}
export type Prefs = Record<string, Record<string, boolean>>
export const PREF_CATEGORIES = ['reminders', 'follows', 'broadcasts', 'marketing'] as const
export const PREF_CHANNELS = ['email', 'push'] as const
export async function listNotices(locale = 'id', perPage = 30): Promise<Notice[]> {
  const r = await http.get<Envelope<Notice[]>>('/me/notifications', {
    params: { per_page: perPage, locale },
  })
  return r.data.data
}
export async function unreadNotices(): Promise<number> {
  const r = await http.get<Envelope<{ unread: number }>>('/me/notifications/unread-count')
  return r.data.data.unread
}
/** ids kosong = tandai semua dibaca. */
export async function markNoticesRead(ids: string[] = []): Promise<void> {
  await http.post('/me/notifications/read', { ids })
}
export async function getPrefs(): Promise<Prefs> {
  const r = await http.get<Envelope<Prefs>>('/me/notification-prefs')
  return r.data.data
}
export async function setPref(category: string, channel: string, enabled: boolean): Promise<void> {
  await http.put('/me/notification-prefs', { category, channel, enabled })
}

// ---- keamanan ----
export interface Device {
  session_id: string
  label: string
  ip?: string
  created_at: string
  last_seen_at?: string
  current: boolean
}
export interface MfaSetup {
  secret: string
  provisioning_uri: string
}
export async function listDevices(): Promise<Device[]> {
  const r = await http.get<Envelope<Device[]>>('/me/devices')
  return r.data.data
}
export async function revokeDevice(id: string): Promise<void> {
  await http.delete(`/me/devices/${id}`)
}
export async function logoutAll(): Promise<void> {
  await http.post('/auth/logout-all', {}, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
}
export async function mfaSetup(): Promise<MfaSetup> {
  const r = await http.post<Envelope<MfaSetup>>('/me/mfa/totp/setup')
  return r.data.data
}
export async function mfaConfirm(code: string): Promise<string[]> {
  const r = await http.post<Envelope<{ recovery_codes: string[] }>>('/me/mfa/totp/confirm', {
    code,
  })
  return r.data.data.recovery_codes
}
export async function mfaDisable(password: string, code: string): Promise<void> {
  await http.post('/me/mfa/totp/disable', { password, code })
}
export async function mfaRecovery(password: string): Promise<string[]> {
  const r = await http.post<Envelope<{ recovery_codes: string[] }>>('/me/mfa/totp/recovery-codes', {
    password,
  })
  return r.data.data.recovery_codes
}
export async function requestEmailChange(
  email: string,
  password: string,
  sf: { mfa_method?: string; mfa_code?: string } = {},
): Promise<void> {
  await http.post('/me/email', { email, password, ...sf })
}

// ---- privasi ----
export interface PrivacyExport {
  id: string
  status: string
  expires_at?: string
  created_at: string
  url?: string
}
export async function listExports(): Promise<PrivacyExport[]> {
  const r = await http.get<Envelope<PrivacyExport[]>>('/me/privacy/exports')
  return r.data.data
}
export async function requestExport(): Promise<PrivacyExport> {
  const r = await http.post<Envelope<PrivacyExport>>('/me/privacy/exports')
  return r.data.data
}
export async function deleteAccount(
  password: string,
  reason?: string,
  sf: { mfa_method?: string; mfa_code?: string } = {},
): Promise<void> {
  await http.post('/me/privacy/delete-account', { password, reason, ...sf })
}

// ---- bantuan ----
export type SupportCategory = 'payment' | 'ticket' | 'refund' | 'account' | 'event' | 'other'
export const SUPPORT_CATEGORIES: SupportCategory[] = [
  'payment',
  'ticket',
  'refund',
  'account',
  'event',
  'other',
]
export interface SupportTicket {
  id: string
  number: number
  category: SupportCategory
  subject: string
  status: string
  priority: string
  order_id?: string
  created_at: string
  updated_at: string
}
export interface SupportMessage {
  id: string
  author: string
  from_staff: boolean
  body: string
  created_at: string
}
export interface SupportThread {
  ticket: SupportTicket
  messages: SupportMessage[]
}
export async function listSupport(): Promise<SupportTicket[]> {
  const r = await http.get<Page<SupportTicket> | Envelope<SupportTicket[]>>('/support/tickets')
  const b = r.data as { data: SupportTicket[] }
  return b.data
}
export async function createSupport(body: {
  category: SupportCategory
  subject: string
  body: string
  order_id?: string
}): Promise<SupportTicket> {
  const r = await http.post<Envelope<SupportTicket>>('/support/tickets', body)
  return r.data.data
}
export async function getSupport(id: string): Promise<SupportThread> {
  const r = await http.get<Envelope<SupportThread>>(`/support/tickets/${id}`)
  return r.data.data
}
export async function replySupport(id: string, body: string): Promise<void> {
  await http.post(`/support/tickets/${id}/messages`, { body })
}
export async function closeSupport(id: string): Promise<void> {
  await http.post(`/support/tickets/${id}/close`)
}

export interface Consent {
  id: string
  document_id: string
  accepted_at: string
  kind: string
  locale: string
  version: number
  title: string
}
export interface PendingDoc {
  id: string
  kind: string
  title: string
  version: number
}
export interface PrivacyRequest {
  id: string
  kind: string
  status: string
  due_at?: string
  created_at: string
}
export async function getConsents(): Promise<{ accepted: Consent[]; pending: PendingDoc[] }> {
  const r = await http.get<Envelope<{ accepted: Consent[]; pending: PendingDoc[] }>>('/me/consents')
  return r.data.data
}
export async function listPrivacyRequests(): Promise<PrivacyRequest[]> {
  const r = await http.get<Envelope<PrivacyRequest[]>>('/me/privacy/requests')
  return r.data.data
}
