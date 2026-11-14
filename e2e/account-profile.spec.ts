import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

// Akun terpisah per project agar proyek paralel tidak saling menimpa foto/voucher.
const EMAIL: Record<string, string> = {
  'chromium-desktop': 'sari@tixgo.local',
  'mobile-375': 'rani@tixgo.local',
}
const PASSWORD = 'Demo-Pass-123!'
const PHOTOS = join(process.cwd(), 'src/assets/photos')

async function login(page: Page): Promise<void> {
  const email = EMAIL[test.info().project.name] ?? 'sari@tixgo.local'
  await page.goto('/masuk?next=%2Fakun')
  await page.getByLabel('Email').fill(email)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.locator('[data-test=acct]')).toBeVisible()
}

test.describe('akun: foto profil & voucher', () => {
  test.describe.configure({ mode: 'serial' })

  test('foto profil: unggah, potong, tampil di kepala akun, lalu hapus', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(/\/akun$/)
    const header = page.locator('.acs__head')
    // bersihkan sisa run yang terputus, lalu pastikan awalnya inisial
    if (await page.locator('[data-test=avatar-remove]').isVisible()) {
      await page.locator('[data-test=avatar-remove]').click()
    }
    await expect(header.locator('img')).toHaveCount(0)
    const file = readdirSync(PHOTOS).find((f) => /\.(jpe?g|png|webp)$/i.test(f))!
    await page.locator('[data-test=avatar-file]').setInputFiles(join(PHOTOS, file))
    await expect(page.getByText('Atur foto profil')).toBeVisible()
    await page.locator('[data-test=avatar-save]').click()
    await expect(header.locator('img')).toBeVisible()
    // foto juga tampil di tombol akun pada header situs (bukan ikon generik)
    await expect(page.locator('[data-test=head-avatar] img')).toBeVisible()
    await expect(header.locator('img')).toHaveJSProperty('complete', true)
    expect(
      await header.locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth),
    ).toBeGreaterThan(0)
    await page.locator('[data-test=avatar-remove]').click()
    await expect(header.locator('img')).toHaveCount(0)
    await expect(page.locator('[data-test=head-avatar] img')).toHaveCount(0)
  })

  test('foto profil: tipe salah ditolak di klien', async ({ page }) => {
    await login(page)
    await page.locator('[data-test=avatar-file]').setInputFiles({
      name: 'x.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('bukan gambar'),
    })
    await expect(page.getByText('Pilih gambar JPG, PNG, atau WebP.')).toBeVisible()
  })

  test('voucher: kode salah ditolak, kode benar masuk dompet, bisa dihapus', async ({ page }) => {
    await login(page)
    await page.goto('/voucher')
    await expect(page.getByRole('heading', { name: 'Voucher', level: 1 })).toBeVisible()
    await page.locator('[data-test=voucher-code]').fill('ab')
    await page.locator('[data-test=voucher-redeem]').click()
    await expect(page.getByRole('alert').filter({ hasText: 'minimal 3' })).toBeVisible()
    await page.locator('[data-test=voucher-code]').fill('TIDAKADA')
    await page.locator('[data-test=voucher-redeem]').click()
    await expect(
      page.getByRole('alert').filter({ hasText: /tidak ditemukan|tidak valid/ }),
    ).toBeVisible()
    await page.locator('[data-test=voucher-code]').fill('neon25')
    await page.locator('[data-test=voucher-redeem]').click()
    const card = page.locator('[data-test=vouchers] li', { hasText: 'NEON25' })
    await expect(card).toBeVisible()
    await expect(card).toContainText('25%')
    await expect(card.getByRole('link', { name: 'Pakai di event' })).toBeVisible()
    await card.getByRole('button', { name: /Hapus voucher NEON25/ }).click()
    await expect(card).toHaveCount(0)
  })
})
