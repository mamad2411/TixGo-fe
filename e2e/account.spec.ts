import { expect, test, type Page } from '@playwright/test'

const DEMO = { email: 'bimo@tixgo.local', password: 'Demo-Pass-123!' }

async function login(page: Page): Promise<void> {
  await page.goto('/masuk?next=%2Fevents')
  await page.getByLabel('Email').fill(DEMO.email)
  await page.locator('#password').fill(DEMO.password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.locator('[data-test=acct]')).toBeVisible()
}
async function pick(page: Page, name: string): Promise<void> {
  await page.locator('[data-test=acct]').click()
  await page.getByRole('menuitem', { name }).click()
}

test.describe('akun pelanggan', () => {
  test.describe.configure({ mode: 'serial' })

  test('menu header membuka Tiket, Pesanan, Favorit, Profil', async ({ page }) => {
    await login(page)
    await pick(page, 'Tiket saya')
    await expect(page).toHaveURL(/\/tiket$/)
    await expect(page.getByRole('heading', { name: 'Tiket saya', level: 1 })).toBeVisible()
    await pick(page, 'Favorit')
    await expect(page).toHaveURL(/\/favorit$/)
    await pick(page, 'Pesanan')
    await expect(page).toHaveURL(/\/pesanan$/)
    await pick(page, 'Profil')
    await expect(page).toHaveURL(/\/akun$/)
    await expect(page.locator('[data-test=profile-save]')).toBeDisabled()
    await page.getByLabel('Nama lengkap').fill('X')
    await page.locator('[data-test=profile-save]').click()
    await expect(page.getByRole('alert').filter({ hasText: 'minimal 2' })).toBeVisible()
  })

  test('pesanan menunggu bayar tampil di header dan daftar pesanan', async ({ page }) => {
    await login(page)
    await page.goto('/events/kirana-orkestra-malam')
    await page.locator('[data-test=auto-pick]').click()
    await page.locator('[data-test=buy]').click()
    await page.getByRole('button', { name: 'Samakan dengan tiket 1' }).click()
    await page.locator('[data-test=agree]').check()
    await page.locator('[data-test=pay]').click()
    await expect(page).toHaveURL(/\/bayar$/)
    await expect(page.locator('[data-test=pending-chip]')).toBeVisible()
    await page.goto('/pesanan')
    await expect(
      page.locator('[data-test=orders] a', { hasText: 'Bayar sekarang' }).first(),
    ).toBeVisible()
    // bersihkan: batalkan pesanan
    await page.locator('[data-test=orders] a', { hasText: 'Bayar sekarang' }).first().click()
    await page.getByRole('button', { name: 'Batalkan pesanan' }).click()
    await page.getByRole('button', { name: 'Ya, batalkan' }).click()
    await expect(page.locator('[data-state=closed]')).toBeVisible()
  })
})
