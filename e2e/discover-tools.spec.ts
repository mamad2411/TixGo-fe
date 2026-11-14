import { expect, test } from '@playwright/test'

import { EMAIL, uiLogin } from './helpers'

// Saran pencarian, halaman koleksi "Lihat semua", rekomendasi beraksi, terakhir dilihat.
test.describe('alat bantu pencarian & penemuan', () => {
  test('saran pencarian: dikelompokkan per jenis, bisa dipilih dengan keyboard, Enter mencari biasa', async ({
    page,
  }) => {
    await page.goto('/artis') // header memuat kotak cari global
    const input = page.locator('[data-test=search-input]')
    await input.click()
    await input.fill('jaz')
    const panel = page.locator('[data-test=suggest]')
    await expect(panel).toBeVisible()
    await expect(panel.locator('[data-kind=genre]')).toContainText('Jazz')
    await expect(panel.locator('[data-kind=query]')).toContainText('jaz')
    // keyboard: panah turun memilih baris, Escape menutup
    await input.press('ArrowDown')
    await expect(panel.locator('[aria-selected=true]')).toHaveCount(1)
    await input.press('Escape')
    await expect(panel).toBeHidden()
    // Enter tanpa pilihan aktif = pencarian biasa
    await input.fill('jazz')
    await input.press('Enter')
    await expect(page).toHaveURL(/\/events\?q=jazz/)
  })

  test('saran pencarian: memilih konser membuka detailnya; tanpa hasil menawarkan pencarian', async ({
    page,
  }) => {
    await page.goto('/artis')
    const input = page.locator('[data-test=search-input]')
    await input.fill('rimba')
    const first = page.locator('[data-test=suggest] [data-kind=event]').first()
    await expect(first).toBeVisible()
    await first.click()
    await expect(page).toHaveURL(/\/events\/[a-z0-9-]+$/)
    await page.goto('/artis')
    await input.fill('zzzzqq')
    await expect(page.locator('[data-test=suggest]')).toContainText(/tidak ada saran/i)
  })

  test('riwayat pencarian muncul saat kotak kosong dan bisa dihapus', async ({ page }) => {
    await page.goto('/artis')
    const input = page.locator('[data-test=search-input]')
    await input.fill('indie')
    await input.press('Enter')
    await expect(page).toHaveURL(/q=indie/)
    await page.goto('/artis')
    await page.locator('[data-test=search-input]').click()
    await expect(page.locator('[data-test=suggest] [data-kind=recent]').first()).toContainText(
      'indie',
    )
    await page.locator('[data-test=suggest]').getByRole('button', { name: /hapus/i }).click()
    await expect(page.locator('[data-test=suggest] [data-kind=recent]')).toHaveCount(0)
  })

  test('Lihat semua: Hampir habis dan Segera dibuka punya halaman koleksi sendiri dengan filter', async ({
    page,
  }) => {
    await page.goto('/events')
    for (const [kind, title] of [
      ['hot', /hampir habis/i],
      ['soon', /segera dibuka/i],
    ] as const) {
      await page.goto('/events')
      const link = page.locator(`a[data-test=rail-all][href*="koleksi=${kind}"]`)
      await expect(link).toBeVisible()
      await link.click()
      await expect(page).toHaveURL(new RegExp(`koleksi=${kind}`))
      await expect(page.locator('[data-test=collection-head]')).toContainText(title)
      await expect(page.locator('[data-test=event-list] li').first()).toBeVisible()
    }
    // semua konser + filter berhalaman
    await page.goto('/events')
    await page.locator('[data-test=all-link]').click()
    await expect(page).toHaveURL(/koleksi=all/)
    await expect(page.locator('[data-test=collection-head]')).toContainText(/semua konser/i)
    await expect(page.locator('[data-test=event-list] li').first()).toBeVisible()
    // koleksi tidak valid tidak merusak halaman
    await page.goto('/events?koleksi=ngawur')
    await expect(page.locator('[data-test=event-list]').first()).toBeVisible()
  })

  test('Mungkin kamu suka: tamu melihat "Lagi ramai" dengan aksi; sembunyikan lalu tampilkan lagi', async ({
    page,
  }) => {
    await page.goto('/events')
    const rec = page.locator('[data-test=recommended]')
    await expect(rec).toBeVisible()
    await expect(rec).toContainText(/lagi ramai/i)
    const items = rec.locator('[data-test=rec-item]')
    expect(await items.count()).toBeGreaterThan(3)
    await expect(items.first().locator('[data-test=rec-reason]')).not.toBeEmpty()
    const firstTitle = await items.first().locator('a').first().getAttribute('href')
    await items.first().locator('[data-test=rec-hide]').click()
    // daftar terisi lagi dari konser lain: yang disembunyikan tidak muncul lagi
    await expect(items.first().locator('a').first()).not.toHaveAttribute('href', firstTitle ?? '')
    await rec.locator('[data-test=rec-reset]').click()
    await expect(items.first().locator('a').first()).toHaveAttribute('href', firstTitle ?? '')
    // tamu menekan Ingatkan -> diarahkan masuk
    await rec.locator('[data-test=rec-remind]').first().click()
    await expect(page).toHaveURL(/\/masuk\?next=/)
  })

  test('akun masuk: tombol Ingatkan pada rekomendasi tersimpan dan konsisten', async ({ page }) => {
    const who = EMAIL[test.info().project.name]!
    await uiLogin(page, who, '/events')
    // Ingatkan hanya untuk konser yang penjualannya belum dibuka (BE menolak yang sudah dijual); yang lain punya "Lihat tiket"
    const btn = page.locator('[data-test=rec-remind]').first()
    await expect(btn).toBeVisible()
    const was = (await btn.getAttribute('aria-pressed')) === 'true'
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/reminders') && ['POST', 'DELETE'].includes(r.request().method()),
      ),
      btn.click(),
    ])
    await expect(btn).toHaveAttribute('aria-pressed', String(!was))
    // kembalikan
    await Promise.all([page.waitForResponse((r) => r.url().includes('/reminders')), btn.click()])
    await expect(btn).toHaveAttribute('aria-pressed', String(was))
  })

  test('terakhir dilihat: muncul setelah membuka konser, bisa dihapus', async ({ page }) => {
    await page.goto('/events')
    await expect(page.locator('[data-test=viewed]')).toHaveCount(0)
    await page.locator('[data-test=event-list] a').first().click()
    await expect(page).toHaveURL(/\/events\/[a-z0-9-]+$/)
    await expect(page.locator('h1').first()).toBeVisible() // detail selesai dimuat -> sudah tercatat
    await page.goto('/events')
    await expect(page.locator('[data-test=viewed]')).toBeVisible()
    await page.locator('[data-test=viewed-clear]').click()
    await expect(page.locator('[data-test=viewed]')).toHaveCount(0)
  })
})
