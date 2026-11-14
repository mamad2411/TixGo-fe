import { computed, ref } from 'vue'

import { getPushKey, removePushSubscription, savePushSubscription } from '@/api/push'

// Status push di perangkat ini. Urutan cek mengikuti apa yang bisa dilakukan pengguna:
// unsupported (peramban tak bisa) -> unconfigured (server belum punya kunci) -> denied (diblokir di peramban)
// -> off / on (langganan aktif atau tidak).
export type PushState = 'loading' | 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on'

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
const bytesToB64 = (buf: ArrayBuffer | null): string => {
  if (!buf) return ''
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function usePush() {
  const state = ref<PushState>('loading')
  const busy = ref(false)
  const supported = computed(
    () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  )

  async function registration(): Promise<ServiceWorkerRegistration> {
    return (
      (await navigator.serviceWorker.getRegistration('/sw.js')) ??
      (await navigator.serviceWorker.register('/sw.js'))
    )
  }

  async function refresh(): Promise<void> {
    if (!supported.value) {
      state.value = 'unsupported'
      return
    }
    try {
      if (!(await getPushKey())) {
        state.value = 'unconfigured'
        return
      }
      if (Notification.permission === 'denied') {
        state.value = 'denied'
        return
      }
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      state.value = sub ? 'on' : 'off'
    } catch {
      state.value = 'unsupported'
    }
  }

  /** Meminta izin lalu berlangganan; true bila aktif. Melempar galat BE/peramban agar pemanggil menampilkannya. */
  async function enable(): Promise<boolean> {
    busy.value = true
    try {
      const key = await getPushKey()
      if (!key) {
        state.value = 'unconfigured'
        return false
      }
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        state.value = perm === 'denied' ? 'denied' : 'off'
        return false
      }
      const reg = await registration()
      await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64ToBytes(key),
        }))
      await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: bytesToB64(sub.getKey('p256dh')),
        auth: bytesToB64(sub.getKey('auth')),
      })
      state.value = 'on'
      return true
    } finally {
      busy.value = false
    }
  }

  async function disable(): Promise<void> {
    busy.value = true
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      state.value = 'off'
    } finally {
      busy.value = false
    }
  }

  return { state, busy, refresh, enable, disable }
}
