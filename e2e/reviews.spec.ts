import { expect, test } from '@playwright/test'

import { apiLogin, buyerEmail, paidOrder, ticketIdOf, uiLogin } from './helpers'

// Ulasan. Tiket nyata dibeli, lalu statusnya "used" dipalsukan di jaringan (menandai tiket terpakai butuh
// perangkat gate). Aturan BE (hanya tiket used, 409 dobel, moderasi) diuji di backend: reviews_test.go.
const review = (i: number, rating = 5) => ({
  id: `R${i}`.padEnd(26, '0'),
  rating,
  body: `Ulasan nomor ${i}`,
  author: 'Sari',
  created_at: '2026-10-01T10:00:00Z',
  ...(i === 1 ? { organizer_reply: 'Terima kasih sudah hadir' } : {}),
})

test.describe('ulasan', () => {
  test('halaman event: ringkasan, balasan, muat lebih, laporkan', async ({ page, request }) => {
    const slug = (await (await request.get('/api/v1/events')).json()).data[0].slug as string
    const all = Array.from({ length: 12 }, (_, i) => review(i + 1))
    await page.route(`**/api/v1/events/${slug}/reviews*`, (r) => {
      const p = Number(new URL(r.request().url()).searchParams.get('page') ?? '1')
      return r.fulfill({
        json: { data: { count: 12, average: 4.6, reviews: all.slice((p - 1) * 10, p * 10) } },
      })
    })
    let reported = ''
    await page.route('**/api/v1/reviews/*/report', (r) => {
      reported = r.request().postData() ?? ''
      return r.fulfill({ status: 204 })
    })
    await page.goto(`/events/${slug}`)
    await expect(page.locator('[data-test=reviews-avg]')).toHaveText('4.6')
    const items = page.locator('[data-test=review-item]')
    await expect(items).toHaveCount(10)
    await expect(items.first()).toContainText('Terima kasih sudah hadir')
    await page.locator('[data-test=reviews-more]').click()
    await expect(items).toHaveCount(12)
    await expect(page.locator('[data-test=reviews-more]')).toHaveCount(0)

    // tamu diminta masuk dulu
    await items.first().locator('[data-test=review-report]').click()
    await expect(page).toHaveURL(/\/masuk/)
    expect(reported).toBe('')
  })

  test('kosong dan tanpa rata-rata di bawah 5 ulasan', async ({ page, request }) => {
    const slug = (await (await request.get('/api/v1/events')).json()).data[0].slug as string
    await page.route(`**/api/v1/events/${slug}/reviews*`, (r) =>
      r.fulfill({ json: { data: { count: 0, reviews: [] } } }),
    )
    await page.goto(`/events/${slug}`)
    await expect(page.locator('[data-test=reviews-empty]')).toBeVisible()
    await expect(page.locator('[data-test=reviews-avg]')).toHaveCount(0)
  })

  test('detail tiket terpakai: wajib bintang, kirim, lalu terima kasih', async ({
    page,
    request,
  }) => {
    const email = await buyerEmail(request)
    const token = await apiLogin(request, email)
    const tid = await ticketIdOf(request, token, await paidOrder(request, email, token))
    await page.route(new RegExp(`/api/v1/tickets/${tid}$`), async (r) => {
      const res = await r.fetch()
      const j = await res.json()
      j.data.status = 'used'
      await r.fulfill({ response: res, json: j })
    })
    let sent: { rating: number; body: string } | null = null
    await page.route(`**/api/v1/tickets/${tid}/review`, (r) => {
      sent = r.request().postDataJSON()
      return r.fulfill({ status: 201, json: { data: { status: 'published' } } })
    })
    await uiLogin(page, email, `/tiket/${tid}`)
    await expect(page.locator('[data-test=review-form]')).toBeVisible()
    await page.locator('[data-test=review-send]').click() // tanpa bintang
    await expect(page.locator('[data-test=review-err]')).toBeVisible()
    expect(sent).toBeNull()
    await page.locator('[data-test=star-4]').click()
    await page.locator('[data-test=review-body]').fill('Mantap, suara jernih')
    await page.locator('[data-test=review-send]').click()
    await expect(page.locator('[data-test=review-done]')).toBeVisible()
    expect(sent).toEqual({ rating: 4, body: 'Mantap, suara jernih' })
  })
})
