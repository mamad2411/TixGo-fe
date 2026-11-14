import { defineStore } from 'pinia'
import { ref } from 'vue'

import { listNotices, markNoticesRead, type Notice, unreadNotices } from '@/api/me'

/** Kotak masuk in-app: hitungan belum dibaca + beberapa terbaru untuk bel di header. */
export const useNoticesStore = defineStore('notices', () => {
  const unread = ref(0)
  const recent = ref<Notice[]>([])
  const failed = ref(false)
  let at = 0

  async function refresh(locale: string, force = false): Promise<void> {
    if (!force && Date.now() - at < 20_000) return
    at = Date.now()
    try {
      const [n, items] = await Promise.all([unreadNotices(), listNotices(locale, 8)])
      unread.value = n
      recent.value = items
      failed.value = false
    } catch {
      failed.value = true // bel opsional: galat tidak boleh mengganggu header, tetapi ditandai
    }
  }
  /** ids kosong = semua. Hitungan diambil ulang dari BE agar tidak salah hitung. */
  async function read(ids: string[], locale: string): Promise<void> {
    await markNoticesRead(ids)
    await refresh(locale, true)
  }
  function clear(): void {
    unread.value = 0
    recent.value = []
    at = 0
  }
  return { unread, recent, failed, refresh, read, clear }
})
