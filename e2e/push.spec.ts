import { expect, test } from '@playwright/test'

import { buyerEmail, uiLogin } from './helpers'

// Kartu notifikasi perangkat. Berlangganan sungguhan butuh layanan push peramban + kunci VAPID server, jadi yang diuji
// di sini adalah keputusan tampilan di tiap keadaan (dev BE belum punya VAPID = "belum tersedia", bukan tombol rusak).
test.describe('notifikasi perangkat', () => {
  test('BE tanpa kunci VAPID: dijelaskan, tidak ada tombol', async ({ page, request }) => {
    // deterministik: dev BE kini punya VAPID, jadi keadaan "tanpa kunci" dibuat lewat respons tiruan
    await page.route('**/api/v1/me/push/key', (r) =>
      r.fulfill({ json: { data: { vapid_public_key: '' } } }),
    )
    await uiLogin(page, await buyerEmail(request), '/notifikasi')
    const card = page.locator('[data-test=push-card]')
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('data-state', 'unconfigured')
    await expect(page.locator('[data-test=push-toggle]')).toHaveCount(0)
  })

  test('kunci ada + izin belum diminta: tombol Aktifkan tampil', async ({ page, request }) => {
    await page.addInitScript(() => {
      // Chromium headless melapor 'denied' bawaan; keadaan nyata pengguna baru adalah 'default'
      Object.defineProperty(Notification, 'permission', { get: () => 'default' })
    })
    await page.route('**/api/v1/me/push/key', (r) =>
      r.fulfill({
        json: {
          data: {
            vapid_public_key:
              'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
          },
        },
      }),
    )
    await uiLogin(page, await buyerEmail(request), '/notifikasi')
    await expect(page.locator('[data-test=push-card]')).toHaveAttribute('data-state', 'off')
    await expect(page.locator('[data-test=push-toggle]')).toBeVisible()
  })

  test('izin diblokir peramban: pengguna diberi tahu cara memulihkan', async ({
    page,
    request,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Notification, 'permission', { get: () => 'denied' })
    })
    await page.route('**/api/v1/me/push/key', (r) =>
      r.fulfill({
        json: {
          data: {
            vapid_public_key:
              'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
          },
        },
      }),
    )
    await uiLogin(page, await buyerEmail(request), '/notifikasi')
    await expect(page.locator('[data-test=push-card]')).toHaveAttribute('data-state', 'denied')
    await expect(page.locator('[data-test=push-toggle]')).toHaveCount(0)
  })
})
