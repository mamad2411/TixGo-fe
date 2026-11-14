import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { listOrders, type OrderBrief } from '@/api/account'

/** Pesanan yang masih menunggu bayar (untuk penanda di header). */
export const usePendingStore = defineStore('pending', () => {
  const orders = ref<OrderBrief[]>([])
  const active = computed(() =>
    orders.value.filter((o) => o.status === 'pending' && new Date(o.expires_at) > new Date()),
  )

  // Header dan halaman pesanan meminta daftar yang sama; dulu itu jadi dua GET identik setiap
  // pindah halaman. Satu permintaan dipakai bersama, dan hasilnya dianggap segar sesaat.
  const FRESH_MS = 15_000
  let at = 0
  let inflight: Promise<void> | null = null

  function load(): Promise<void> {
    if (inflight) return inflight
    if (Date.now() - at < FRESH_MS) return Promise.resolve()
    inflight = (async () => {
      try {
        orders.value = (await listOrders(1)).data
        at = Date.now()
      } catch {
        orders.value = [] // penanda opsional: galat jaringan tidak boleh mengganggu header
      } finally {
        inflight = null
      }
    })()
    return inflight
  }
  /** Dipakai halaman pesanan agar penanda di header memakai daftar yang baru saja dimuat. */
  function set(list: OrderBrief[]): void {
    orders.value = list
    at = Date.now()
  }
  function clear(): void {
    orders.value = []
    at = 0
  }
  return { orders, active, load, set, clear }
})
