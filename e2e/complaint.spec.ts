import { expect, test } from '@playwright/test'

// Pengaduan privasi + riwayat versi legal. POST pengaduan dimock agar tidak menumpuk baris di DB dev dan tidak
// menghabiskan batas 5/jam; aturan BE (validasi, rute ke penanggung jawab) diuji di backend.
test.describe('pengaduan privasi', () => {
  test('tamu: validasi klien, galat BE tampil, lalu berhasil', async ({ page }) => {
    let calls = 0
    let sent: Record<string, string> | null = null
    await page.route('**/api/v1/privacy/complaints', (r) => {
      calls++
      if (calls === 1)
        return r.fulfill({
          status: 429,
          json: { error: { code: 'RATE_LIMITED', message: 'terlalu banyak permintaan' } },
        })
      sent = r.request().postDataJSON()
      return r.fulfill({ status: 204 })
    })
    await page.goto('/pengaduan-privasi')
    await expect(page.locator('[data-test=back]')).toHaveCount(1)
    await page.locator('[data-test=pc-send]').click() // kosong
    await expect(page.getByRole('alert')).toHaveCount(3)
    expect(calls).toBe(0)
    await page.locator('[data-test=pc-email]').fill('warga@contoh.id')
    await page.locator('[data-test=pc-subject]').fill('Data saya masih ada')
    await page
      .locator('[data-test=pc-body]')
      .fill('Saya sudah minta hapus akun tetapi masih menerima email promosi.')
    await page.locator('[data-test=pc-send]').click()
    await expect(page.locator('[data-test=pc-err]')).toBeVisible() // 429: pesan tampil, form tetap ada
    await page.locator('[data-test=pc-send]').click()
    await expect(page.locator('[data-test=complaint-done]')).toContainText('warga@contoh.id')
    expect(sent).toMatchObject({ email: 'warga@contoh.id', subject: 'Data saya masih ada' })
  })

  test('halaman legal: riwayat versi + tautan ke pengaduan', async ({ page }) => {
    await page.route('**/api/v1/legal/privacy/versions*', (r) =>
      r.fulfill({
        json: {
          data: [
            {
              id: 'V2'.padEnd(26, '0'),
              kind: 'privacy',
              locale: 'id',
              version: 2,
              title: 'Privasi',
              published_at: '2026-10-01T00:00:00Z',
              created_at: '2026-09-30T00:00:00Z',
            },
            {
              id: 'V1'.padEnd(26, '0'),
              kind: 'privacy',
              locale: 'id',
              version: 1,
              title: 'Privasi',
              published_at: '2026-01-01T00:00:00Z',
              created_at: '2025-12-30T00:00:00Z',
            },
            {
              id: 'V3'.padEnd(26, '0'),
              kind: 'privacy',
              locale: 'id',
              version: 3,
              title: 'Privasi',
              published_at: null,
              created_at: '2026-11-01T00:00:00Z',
            },
          ],
        },
      }),
    )
    await page.goto('/legal/privacy')
    const hist = page.locator('[data-test=legal-versions]')
    await expect(hist).toBeVisible()
    await hist.locator('summary').click()
    await expect(hist.locator('li')).toHaveCount(2) // draf yang belum terbit tidak ditampilkan
    await page.locator('[data-test=to-complaint]').click()
    await expect(page).toHaveURL(/\/pengaduan-privasi$/)
  })
})
