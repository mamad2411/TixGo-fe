import { http, type Envelope } from './client'
import { newIdempotencyKey } from './orders'
import type { OrderView } from './orders'

// Squad checkout: satu ketua menahan N kursi, teman bergabung lewat kode dan masing-masing bayar bagiannya.
export interface SquadMember {
  user_id: string
  name: string
  seat_id?: string
  seat_label?: string
  status: 'joined' | 'paid' | 'released'
  leader: boolean
}
export interface Squad {
  id: string
  code: string
  event_id: string
  event_title?: string
  event_slug?: string
  size: number
  policy: 'release_unpaid' | 'cancel_all'
  status: 'forming' | 'holding' | 'completed' | 'cancelled' | 'expired'
  expires_at?: string
  members: SquadMember[]
  open_slots: number
  paid: number
  hold_id?: string
  my_hold_id?: string
}
export interface SquadCreateBody {
  size: number
  policy: Squad['policy']
  tier_id?: string
  seat_ids?: string[]
}
export async function createSquad(
  slug: string,
  body: SquadCreateBody,
  admissionToken?: string,
): Promise<Squad> {
  const r = await http.post<Envelope<Squad>>(`/events/${encodeURIComponent(slug)}/squads`, body, {
    headers: admissionToken ? { 'X-Admission-Token': admissionToken } : undefined,
  })
  return r.data.data
}
export async function mySquads(): Promise<Squad[]> {
  const r = await http.get<Envelope<Squad[]>>('/me/squads')
  return r.data.data
}
export async function getSquad(id: string): Promise<Squad> {
  const r = await http.get<Envelope<Squad>>(`/squads/${encodeURIComponent(id)}`)
  return r.data.data
}
export async function joinSquad(code: string): Promise<Squad> {
  const r = await http.post<Envelope<Squad>>('/squads/join', { code })
  return r.data.data
}
export async function inviteToSquad(id: string, email: string): Promise<void> {
  await http.post(`/squads/${encodeURIComponent(id)}/invite`, { email })
}
/** "Bayar bagianku": membuat order biasa untuk slotmu; lanjut bayar di /pesanan/:id/bayar. */
export async function paySquad(
  id: string,
  opts: { ageConfirmed?: boolean } = {},
  key = newIdempotencyKey(),
): Promise<{ hold_id: string; order: OrderView }> {
  const r = await http.post<Envelope<{ hold_id: string; order: OrderView }>>(
    `/squads/${encodeURIComponent(id)}/pay`,
    opts.ageConfirmed ? { age_confirmed: true } : {},
    { headers: { 'Idempotency-Key': key } },
  )
  return r.data.data
}
export async function extendSquad(id: string): Promise<Squad> {
  const r = await http.post<Envelope<Squad>>(`/squads/${encodeURIComponent(id)}/extend`)
  return r.data.data
}
export async function cancelSquad(id: string): Promise<void> {
  await http.delete(`/squads/${encodeURIComponent(id)}`)
}
