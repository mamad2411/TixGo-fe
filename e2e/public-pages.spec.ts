import { expect, test } from '@playwright/test'

import { EMAIL, PASSWORD, apiLogin, buyerEmail, paidOrder, ticketIdOf, uiLogin } from './helpers'

// Penerima harus akun lain dari pengirim (BE menolak klaim tiket sendiri).
const RECEIVER: Record<string, string> = {
  'chromium-desktop': 'sari@tixgo.local',
  'mobile-375': 'bimo@tixgo.local',
}

test.describe('halaman publik & klaim tiket', () => {
  test('URL tak dikenal menampilkan 404 yang bisa dinavigasi', async ({ page }) => {
    await page.goto('/halaman-ngawur/xyz')
    await expect(page.locator('[data-test=not-found]')).toBeVisible()
    await page.getByRole('link', { name: 'Jelajah konser' }).click()
    await expect(page).toHaveURL(/\/events$/)
  })

  test('dokumen legal tampil dari footer, markdown dirender dan disanitasi', async ({ page }) => {
    await page.goto('/events')
    await page
      .getByRole('navigation', { name: /dokumen/i })
      .getByRole('link', { name: 'Syarat & Ketentuan' })
      .click()
    await expect(page).toHaveURL(/\/legal\/terms$/)
    const doc = page.locator('[data-test=legal-doc]')
    await expect(doc.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(doc.locator('script')).toHaveCount(0)
    await page.locator('#konten').getByRole('link', { name: 'Kebijakan Privasi' }).click()
    await expect(page).toHaveURL(/\/legal\/privacy$/)
  })

  test('kirim tiket -> penerima membuka tautan -> terima -> tiket ada di akunnya', async ({
    page,
    request,
  }) => {
    const sender = await buyerEmail(request)
    const token = await apiLogin(request, sender)
    const tid = await ticketIdOf(request, token, await paidOrder(request, sender, token))
    const h = { Authorization: `Bearer ${token}` }
    const link = await (
      await request.post(`/api/v1/tickets/${tid}/transfer`, { headers: h, data: {} })
    ).json()
    const claimToken = String(link.data.link).split('/claim/')[1]
    expect(claimToken).toBeTruthy()

    // tamu diarahkan masuk dan kembali ke halaman klaim
    await page.goto(`/claim/${claimToken}`)
    await expect(page).toHaveURL(/\/masuk\?next=/)
    await page.getByLabel('Email').fill(RECEIVER[test.info().project.name]!)
    await page.locator('#password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page.locator('[data-test=claim]')).toBeVisible()
    await expect(page.locator('[data-test=claim]')).toContainText('mengirim tiket untukmu')
    await page.locator('[data-test=claim-accept]').click()
    await expect(page).toHaveURL(new RegExp(`/tiket/${tid}$`))
    await expect(page.locator('[data-test=ticket]')).toBeVisible()

    // tautan sekali pakai: kedua kali ditolak dengan pesan spesifik
    await page.goto(`/claim/${claimToken}`)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.locator('[data-test=claim-accept]')).toHaveCount(0)
  })

  test('klaim tiket sendiri ditolak dengan pesan jelas', async ({ page, request }) => {
    const me = await buyerEmail(request)
    const token = await apiLogin(request, me)
    const tid = await ticketIdOf(request, token, await paidOrder(request, me, token))
    const link = await (
      await request.post(`/api/v1/tickets/${tid}/transfer`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {},
      })
    ).json()
    await uiLogin(page, me, `/claim/${String(link.data.link).split('/claim/')[1]}`)
    await page.locator('[data-test=claim-accept]').click()
    await expect(page.getByRole('alert').filter({ hasText: 'tiketmu sendiri' })).toBeVisible()
    await request.delete(`/api/v1/tickets/${tid}/transfer`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  })

  test('tautan klaim ngawur: pesan galat, tanpa tombol terima', async ({ page }) => {
    await uiLogin(page, EMAIL[test.info().project.name]!, '/claim/tokentidakada')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.locator('[data-test=claim-accept]')).toHaveCount(0)
  })
})
