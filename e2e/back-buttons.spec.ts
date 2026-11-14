import { expect, test } from '@playwright/test'

import { EMAIL, uiLogin } from './helpers'

// Setiap halaman non-puncak wajib punya TEPAT satu tombol kembali (tidak ada jalan buntu, tidak dobel).
const ROUTES = [
  '/ringkasan',
  '/tiket',
  '/pesanan',
  '/refund',
  '/voucher',
  '/favorit',
  '/notifikasi',
  '/akun',
  '/keamanan',
  '/privasi',
  '/bantuan',
  '/legal/terms',
  '/claim/tokentidakada',
  '/diikuti',
  '/waitlist',
  '/jual-beli',
  '/squad-saya',
  '/pengaduan-privasi',
  '/artis',
  '/venue',
  '/kalender',
  '/events?koleksi=hot',
  '/halaman-ngawur',
]

test.describe('tombol kembali', () => {
  test('ada tepat satu di setiap halaman akun/legal/klaim/404', async ({ page }) => {
    await uiLogin(page, EMAIL[test.info().project.name]!, '/tiket')
    for (const r of ROUTES) {
      await page.goto(r)
      await expect(page.locator('[data-test=back]'), r).toHaveCount(1)
      await expect(page.locator('[data-test=back]'), r).toBeVisible()
    }
  })

  test('tanpa riwayat: halaman akun kembali ke Ringkasan, Ringkasan ke katalog', async ({
    page,
  }) => {
    await uiLogin(page, EMAIL[test.info().project.name]!, '/keamanan')
    await page.goto('/keamanan') // muat langsung: tanpa riwayat aplikasi sebelumnya
    await page.locator('[data-test=back]').click()
    await expect(page).toHaveURL(/\/ringkasan$/)
    const fresh = await page.context().newPage() // tab baru = tanpa riwayat; sesi login ikut lewat cookie
    await fresh.goto('/ringkasan')
    await fresh.locator('[data-test=back]').click()
    await expect(fresh).toHaveURL(/\/events$/)
  })
})
