import { expect, test, type Page } from '@playwright/test'

const DEMO = { email: 'bimo@tixgo.local', password: 'Demo-Pass-123!' }

async function login(page: Page, next: string): Promise<void> {
  await page.goto(`/masuk?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').fill(DEMO.email)
  await page.locator('#password').fill(DEMO.password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.locator('[data-test=acct]')).toBeVisible()
}

test.describe('checkout -> pesanan -> bayar', () => {
  test.describe.configure({ mode: 'serial' })

  test('validasi form, buat pesanan, halaman bayar, batalkan', async ({ page }) => {
    await login(page, '/events/kirana-orkestra-malam')
    await page.locator('[data-test=auto-pick]').click()
    await page.locator('[data-test=buy]').click()
    await expect(page).toHaveURL(/\/checkout\/[0-9A-Z]{26}$/)

    // pemegang tiket 1 terisi dari akun; kosongkan nama tiket 2 lalu coba lanjut tanpa setuju
    const cards = page.locator('[data-test=holders] li')
    await expect(cards).toHaveCount(2)
    await expect(cards.nth(0).getByLabel('Nama lengkap')).not.toHaveValue('')
    await page.locator('[data-test=pay]').click()
    await expect(page.getByRole('alert').filter({ hasText: 'Centang persetujuan' })).toBeVisible()
    await expect(cards.nth(1).getByLabel('Nama lengkap')).toBeFocused()

    await page.getByRole('button', { name: 'Samakan dengan tiket 1' }).click()
    await page.locator('[data-test=agree]').check()
    await page.locator('[data-test=pay]').click()

    await expect(page).toHaveURL(/\/pesanan\/[0-9A-Z]{26}\/bayar$/)
    await expect(page.locator('[data-state=pending]')).toBeVisible()
    await expect(page.locator('[data-test=order-total]')).toBeVisible()
    await expect(page.locator('[data-test=pay-now]')).toBeEnabled()

    // batalkan -> pesanan ditutup
    await page.getByRole('button', { name: 'Batalkan pesanan' }).click()
    await page.getByRole('button', { name: 'Ya, batalkan' }).click()
    await expect(page.locator('[data-state=closed]')).toBeVisible()
  })
})
