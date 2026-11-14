import { computed, onScopeDispose, ref, toValue, type MaybeRefOrGetter } from 'vue'

import { splitDuration } from '@/utils/format'

/**
 * Hitung mundur ke `target` (ISO/Date). Tiap detik membaca jam perangkat; selisih dihitung ulang dari
 * `Date.now()` (bukan dikurangi 1 per tick) supaya tidak melenceng saat tab tertidur.
 * Dasar untuk timer hold kursi dan buka-penjualan (F2/F3); jangan dipakai sebagai sumber kebenaran —
 * server tetap yang memutuskan kedaluwarsa.
 */
export function useCountdown(target: MaybeRefOrGetter<string | Date | null | undefined>) {
  const now = ref(Date.now())
  const id = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  onScopeDispose(() => clearInterval(id))

  const remainingMs = computed(() => {
    const t = toValue(target)
    return t ? new Date(t).getTime() - now.value : 0
  })
  const parts = computed(() => splitDuration(remainingMs.value))
  const done = computed(() => remainingMs.value <= 0)
  return { remainingMs, parts, done }
}
