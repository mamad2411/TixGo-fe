import { expect, test } from '@playwright/test'

import { apiLogin, buyerEmail, newVerifiedUser, paidOrder, ticketIdOf, uiLogin } from './helpers'

test.describe('ringkasan akun & tiket layar penuh', () => {
  test('ringkasan menunjukkan konser berikutnya, checklist, jalan pintas; tiket layar penuh dibuka/ditutup', async ({
    page,
    request,
  }) => {
    const email = await buyerEmail(request)
    const token = await apiLogin(request, email)
    const tid = await ticketIdOf(request, token, await paidOrder(request, email, token))

    await uiLogin(page, email, '/ringkasan')
    // h1 halaman masuk masih ada sesaat selama transisi halaman: persempit ke judul akun
    await expect(page.locator('h1.ac__title')).toContainText('Halo,')
    await expect(page.locator('[data-test=ov-next]')).toContainText('Konser berikutnya')
    await expect(page.locator('[data-test=ov-open]')).toBeVisible()
    // akun baru: email + HP terverifikasi, foto & 2FA belum -> 2/4
    await expect(page.locator('[data-test=ov-steps]')).toContainText('2/4')
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    await expect(page.getByRole('link', { name: /Voucher/ }).first()).toBeVisible()

    await page.locator('[data-test=ov-open]').click()
    await expect(page).toHaveURL(/\/tiket\/[0-9A-Z]{26}$/)
    await page.locator('[data-test=qr-full]').click()
    const ov = page.locator('[data-test=qr-overlay]')
    await expect(ov).toBeVisible()
    await expect(ov.locator('img')).toBeVisible()
    await expect(ov).toContainText('Naikkan kecerahan')
    await page.keyboard.press('Escape')
    await expect(ov).toHaveCount(0)
    await page.locator('[data-test=qr-full]').click()
    await page.locator('[data-test=qr-close]').click()
    await expect(ov).toHaveCount(0)
    expect(tid).toBeTruthy()
  })

  test('akun tanpa tiket: kartu kosong ramah dengan satu ajakan', async ({ page, request }) => {
    const email = await newVerifiedUser(request)
    await uiLogin(page, email, '/ringkasan')
    const empty = page.locator('[data-test=ov-empty]')
    await expect(empty).toContainText('Belum ada konser di jadwalmu')
    await empty.getByRole('link', { name: 'Cari konser' }).click()
    await expect(page).toHaveURL(/\/events$/)
  })
})
