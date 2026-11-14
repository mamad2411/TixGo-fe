import { expect, test } from '@playwright/test'

import { apiLogin, buyerEmail, paidOrder, ticketIdOf, uiLogin } from './helpers'

test.describe('tiket digital', () => {
  test.describe.configure({ mode: 'serial' })

  test('buka tiket: QR tampil, kirim (buat+batalkan tautan), jual ulang (pasang+batal)', async ({
    page,
    request,
  }) => {
    const email = await buyerEmail(request)
    const token = await apiLogin(request, email)
    const tid = await ticketIdOf(request, token, await paidOrder(request, email, token))

    await uiLogin(page, email, '/tiket')
    // daftar tiket: kartu bergaya tiket (poster + blok tanggal + hitung mundur) dengan tab Akan datang/Riwayat
    const card = page
      .locator('[data-test=ticket-card]')
      .filter({ has: page.locator(`a[href$="/tiket/${tid}"]`) })
    await expect(card).toBeVisible()
    await expect(card.locator('.tc__date')).toBeVisible()
    await expect(card).toContainText(/hari lagi|Hari ini|Besok/)
    await expect(page.getByRole('button', { name: /Akan datang/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: /Riwayat/ }).click()
    await expect(card).toHaveCount(0)
    await page.getByRole('button', { name: /Akan datang/ }).click()
    await page.locator(`a[href$="/tiket/${tid}"]`).click()
    await expect(page).toHaveURL(new RegExp(`/tiket/${tid}$`))
    await expect(page.locator('[data-test=ticket]')).toBeVisible()
    await expect(page.locator('[data-test=qr]')).toBeVisible()
    const first = await page.locator('[data-test=qr]').getAttribute('src')
    expect(first).toMatch(/^data:image\/png/)

    // kirim: tautan dibuat lalu dibatalkan
    await page.locator('[data-test=open-transfer]').click()
    await page.locator('[data-test=transfer-email]').fill('salah')
    await page.locator('[data-test=transfer-create]').click()
    await expect(page.getByRole('alert').filter({ hasText: 'Format email' })).toBeVisible()
    await page.locator('[data-test=transfer-email]').fill('')
    await page.locator('[data-test=transfer-create]').click()
    await expect(page.locator('[data-test=transfer-link]')).toHaveValue(/^https?:\/\//)
    await page.locator('[data-test=transfer-revoke]').click()
    await expect(page.locator('[data-test=transfer-link]')).toHaveCount(0)
    await page.keyboard.press('Escape')

    // jual ulang: harga kosong ditolak, valid dipasang lalu dibatalkan
    await page.locator('[data-test=open-resale]').click()
    await page.locator('[data-test=resale-create]').click()
    await expect(page.getByRole('alert').filter({ hasText: 'minimal Rp1.000' })).toBeVisible()
    await page.locator('[data-test=resale-price]').fill('1000')
    await page.locator('[data-test=resale-create]').click()
    // sebagian event melarang resale: pesan BE harus tampil spesifik; selain itu pasang lalu batalkan
    const blocked = page.getByRole('alert').filter({ hasText: /tidak mengizinkan|plafon/ })
    const listed = page.locator('[data-test=listing]')
    await expect(blocked.or(listed)).toBeVisible()
    if (await blocked.isVisible()) return
    await page.getByRole('button', { name: 'Batalkan penjualan' }).click()
    await expect(page.locator('[data-test=listing]')).toHaveCount(0)
  })
})
