import { http, type Envelope } from './client'

// Web Push. Kunci VAPID publik datang dari BE (null bila belum dikonfigurasi: fitur disembunyikan, bukan gagal).
export async function getPushKey(): Promise<string | null> {
  const r = await http.get<Envelope<{ vapid_public_key: string | null }>>('/me/push/key')
  return r.data.data.vapid_public_key
}
export async function savePushSubscription(sub: {
  endpoint: string
  p256dh: string
  auth: string
}): Promise<void> {
  await http.post('/me/push/subscriptions', sub)
}
export async function removePushSubscription(endpoint: string): Promise<void> {
  await http.delete('/me/push/subscriptions', { data: { endpoint } })
}
