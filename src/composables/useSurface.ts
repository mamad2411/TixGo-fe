import { onMounted } from 'vue'

/**
 * Warna kanvas dokumen (body) mengikuti permukaan yang sedang tampil.
 * Tanpa ini, halaman gelap yang memudar saat transisi memperlihatkan krem bawaan `--kertas`
 * di belakangnya (terlihat seperti kilatan warna), dan overscroll di macOS ikut krem.
 *
 * Nilai sengaja TIDAK dihapus saat unmount: kanvas tetap memakai permukaan terakhir supaya
 * jeda antar-layout saat transisi tidak berkedip. Permukaan terang menetapkan 'light' sendiri.
 */
export function useSurface(surface: 'dark' | 'light'): void {
  onMounted(() => {
    document.documentElement.dataset.surface = surface
  })
}
