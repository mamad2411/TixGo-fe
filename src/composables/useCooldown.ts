import { onScopeDispose, ref } from 'vue'

/** Jeda tombol "kirim ulang". `start(n)` menghitung mundur n detik; `left` = sisa detik (0 = boleh). */
export function useCooldown() {
  const left = ref(0)
  let id: ReturnType<typeof setInterval> | undefined

  function start(seconds: number): void {
    stop()
    left.value = Math.max(0, Math.ceil(seconds))
    if (left.value === 0) return
    id = setInterval(() => {
      left.value -= 1
      if (left.value <= 0) stop()
    }, 1000)
  }
  function stop(): void {
    if (id) clearInterval(id)
    id = undefined
    if (left.value < 0) left.value = 0
  }
  onScopeDispose(stop)
  return { left, start }
}
