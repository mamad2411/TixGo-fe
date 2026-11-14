import { expect, test } from '@playwright/test'

import { apiLogin, buyerEmail, newOrder, paidOrder, uiLogin } from './helpers'

test.describe('refund pembeli', () => {
  test.describe.configure({ mode: 'serial' })
  test('pesanan lunas -> lihat kelayakan -> ajukan -> status tampil di pesanan', async ({
    page,
    request,
  }) => {
    const email = await buyerEmail(request)
    const token = await apiLogin(request, email)
    const id = await paidOrder(request, email, token)

    await uiLogin(page, email, `/pesanan/${id}`)
    await expect(page.locator('[data-state=paid]')).toBeVisible()
    await expect(page.locator('[data-test=see-tickets]')).toBeVisible()
    await expect(page.locator('[data-test=invoice]')).toBeVisible()

    // pusat refund bisa dicapai dari menu akun di header dan memuat pesanan ini
    await page.locator('[data-test=acct]').click()
    await page.getByRole('menuitem', { name: 'Refund' }).click()
    await expect(page).toHaveURL(/\/refund$/)
    await expect(
      page.locator('[data-test=refund-can] a', { hasText: 'Cek & ajukan refund' }).first(),
    ).toBeVisible()
    await page.goto(`/pesanan/${id}`)
    await page.locator('[data-test=ask-refund]').click()
    await expect(page).toHaveURL(new RegExp(`/pesanan/${id}/refund$`))
    // jumlah ditunjukkan sebelum mengajukan; potongan kebijakan 10% terlihat
    await expect(page.locator('[data-test=refund-amount]')).toContainText('Rp')
    await expect(page.getByText('Potongan kebijakan')).toBeVisible()

    // belum menyetujui dampak -> ditolak di klien
    await page.locator('[data-test=refund-submit]').click()
    await expect(page.getByRole('alert').filter({ hasText: 'Centang persetujuan' })).toBeVisible()

    await page.getByLabel('Salah beli (jumlah/kategori)').check()
    await page.locator('[data-test=refund-detail]').fill('Tes otomatis')
    await page.locator('[data-test=refund-agree]').check()
    await page.locator('[data-test=refund-submit]').click()

    await expect(page).toHaveURL(new RegExp(`/pesanan/${id}$`))
    const card = page.locator('[data-test=refund-card]')
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute(
      'data-status',
      /requested|approved|refunding|awaiting_account|refunded/,
    )
    // refund tampil di pusat refund dengan timeline
    await page.goto('/refund')
    await expect(
      page.locator('[data-test=refund-tracked] [data-test=refund-card]').first(),
    ).toBeVisible()
    await page.goto(`/pesanan/${id}`)
    // pesanan tidak lagi menawarkan refund kedua
    await expect(page.locator('[data-test=ask-refund]')).toHaveCount(0)
  })

  test('pesanan belum lunas: halaman refund menolak dengan alasan', async ({ page, request }) => {
    const email = await buyerEmail(request)
    const token = await apiLogin(request, email)
    const { id, headers } = await newOrder(request, email, token)
    await uiLogin(page, email, `/pesanan/${id}/refund`)
    await expect(page.locator('[data-test=refund-blocked]')).toContainText('Hanya pesanan lunas')
    await expect(page.locator('[data-test=refund-blocked]')).not.toContainText('REFUND_NOT_ALLOWED')
    await expect(page.locator('[data-test=refund-submit]')).toHaveCount(0)
    await request.post(`/api/v1/orders/${id}/cancel`, { headers }) // bersihkan stok
  })
})
