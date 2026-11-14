import { expect, test } from '@playwright/test'

import { EMAIL, uiLogin } from './helpers'

test.describe('akun: notifikasi, keamanan, privasi, bantuan', () => {
  test.describe.configure({ mode: 'serial' })
  const who = () => EMAIL[test.info().project.name]!

  test('navigasi samping memuat semua bagian akun', async ({ page }) => {
    await uiLogin(page, who(), '/akun')
    for (const [name, url] of [
      ['Notifikasi', /\/notifikasi$/],
      ['Keamanan', /\/keamanan$/],
      ['Privasi & data', /\/privasi$/],
      ['Bantuan', /\/bantuan$/],
      ['Voucher', /\/voucher$/],
    ] as const) {
      await page.getByRole('navigation', { name: /akun/i }).getByRole('link', { name }).click()
      await expect(page).toHaveURL(url)
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
    }
  })

  test('preferensi notifikasi tersimpan di server dan bertahan setelah reload', async ({
    page,
  }) => {
    await uiLogin(page, who(), '/notifikasi')
    const sw = page.locator('[data-test=pref-marketing-email]')
    await expect(sw).toBeVisible()
    const before = await sw.isChecked()
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/me/notification-prefs') && r.request().method() === 'PUT',
      ),
      sw.setChecked(!before),
    ])
    await page.reload()
    await expect(page.locator('[data-test=pref-marketing-email]')).toBeChecked({ checked: !before })
    // kembalikan; daftarkan penunggu respons SEBELUM mengubah agar PUT cepat tidak terlewat
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/me/notification-prefs') && r.request().method() === 'PUT',
      ),
      page.locator('[data-test=pref-marketing-email]').setChecked(before),
    ])
  })

  test('keamanan: perangkat ini tampil, 2FA menampilkan QR+secret & menolak kode salah, ganti email divalidasi', async ({
    page,
  }) => {
    await uiLogin(page, who(), '/keamanan')
    await expect(page.locator('[data-test=devices]')).toContainText('Perangkat ini')
    await page.locator('[data-test=mfa-start]').click()
    await expect(page.locator('[data-test=mfa-secret]')).toHaveText(/^[A-Z2-7]{16,}$/)
    await page.locator('[data-test=mfa-code]').fill('12')
    await page.locator('[data-test=mfa-confirm]').click()
    await expect(page.getByRole('alert').filter({ hasText: '6 digit' })).toBeVisible()
    await page.locator('[data-test=mfa-code]').fill('000000')
    await page.locator('[data-test=mfa-confirm]').click()
    await expect(page.locator('[data-test=recovery]')).toHaveCount(0) // kode salah tidak mengaktifkan
    await page.getByRole('button', { name: 'Batal' }).click()
    await page.locator('[data-test=mail-new]').fill('bukan-email')
    await page.locator('[data-test=mail-submit]').click()
    await expect(page.getByRole('alert').filter({ hasText: 'Format email' })).toBeVisible()
  })

  test('privasi: ekspor data diminta, hapus akun menolak sandi salah (tanpa menghapus)', async ({
    page,
  }) => {
    await uiLogin(page, who(), '/privasi')
    const rows = page.locator('[data-test=export] li')
    const n = await rows.count()
    await page.locator('[data-test=export-ask]').click()
    // BE membatasi 3 ekspor/hari/akun: baris baru muncul, atau pesan batas tampil (bukan diam)
    const limited = page.getByText(/terlalu banyak|terlalu sering|coba lagi/i)
    await expect(rows.nth(n).or(limited).first()).toBeVisible()
    await page.locator('[data-test=delete-open]').click()
    await page.locator('[data-test=delete-submit]').click()
    await expect(page.getByRole('alert').filter({ hasText: 'kata sandimu' })).toBeVisible()
    await page.locator('[data-test=delete-pw]').fill('SandiSalah-123!')
    await page.locator('[data-test=delete-sure]').check()
    await page.locator('[data-test=delete-submit]').click()
    await expect(page.locator('[data-test=delete]').getByRole('alert')).not.toHaveText('')
    await expect(page.locator('[data-test=delete-open]')).toHaveCount(0) // form tetap terbuka; tidak ada permintaan dibuat
  })

  test('bantuan: validasi, kirim tiket, balas, tutup', async ({ page }) => {
    await uiLogin(page, who(), '/bantuan')
    await page.locator('[data-test=support-submit]').click()
    await expect(page.getByRole('alert').filter({ hasText: 'minimal 5' })).toBeVisible()
    const subject = `Tes otomatis ${Date.now()}`
    await page.locator('[data-test=support-category]').selectOption('ticket')
    await page.locator('[data-test=support-subject]').fill(subject)
    await page.locator('[data-test=support-body]').fill('Ini pesan uji otomatis dari e2e.')
    await page.locator('[data-test=support-submit]').click()
    const row = page.locator('[data-test=support-list] li', { hasText: subject })
    await expect(row).toBeVisible()
    await row.getByRole('link', { name: 'Buka' }).click()
    await expect(page.locator('[data-test=thread]')).toContainText('pesan uji otomatis')
    await page.locator('[data-test=reply-body]').fill('Balasan tambahan dari pembeli.')
    await page.locator('[data-test=reply-send]').click()
    await expect(page.locator('[data-test=thread]')).toContainText('Balasan tambahan')
    await page.locator('[data-test=support-close]').click()
    await expect(page.getByText('sudah ditutup')).toBeVisible()
  })
})
