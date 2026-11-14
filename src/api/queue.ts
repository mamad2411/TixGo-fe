import { http, type Envelope } from './client'

// Antre adil (waiting room): acak saat dibuka, lalu admit bergelombang. Token admisi dikirim sebagai
// header X-Admission-Token saat membuat hold (lihat api/orders.createHold).
export type QueueState = 'none' | 'waiting_room' | 'queued' | 'admitted' | 'expired' | 'done'
export interface QueueStatus {
  state: QueueState
  position?: number
  ahead?: number
  total?: number
  eta_sec?: number
  opens_at?: string
  token?: string
  expires_at?: string
  phase_id?: string
  rules?: string[]
  seed_hash?: string
}
export async function queueStatus(slug: string): Promise<QueueStatus> {
  const r = await http.get<Envelope<QueueStatus>>(
    `/events/${encodeURIComponent(slug)}/queue/status`,
  )
  return r.data.data
}
export async function queueJoin(slug: string): Promise<QueueStatus> {
  const r = await http.post<Envelope<QueueStatus>>(`/events/${encodeURIComponent(slug)}/queue/join`)
  return r.data.data
}
export async function queueLeave(slug: string): Promise<void> {
  await http.delete(`/events/${encodeURIComponent(slug)}/queue`)
}
