import { ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark'
const KEY = 'tixgo.mode'

function read(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* penyimpanan diblokir: pakai bawaan */
  }
  return 'light'
}

// Satu sumber untuk seluruh aplikasi pelanggan. 'light' = gaya landing (hero gelap + bagian krem),
// 'dark' = semua permukaan gelap. Disimpan per-peramban; tanpa penyimpanan tetap berfungsi.
export const mode = ref<ThemeMode>(read())

watch(mode, (v) => {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    /* abaikan */
  }
})

export function toggleMode(): void {
  mode.value = mode.value === 'dark' ? 'light' : 'dark'
}
