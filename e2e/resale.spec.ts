import { expect, test } from '@playwright/test'

import { EMAIL, uiLogin } from './helpers'

// Jual-beli ulang sisi customer. Aturan harga/plafon/penjual-tak-boleh-beli-sendiri diuji di BE (resale_test.go);
// di sini yang dijaga: tampilan, alur beli -> halaman bayar, dan pengisian rekening pencairan.
const L = (n: number) => ({
  id: `L${n}`.padEnd(26, '0'),
  price: 150000,
  face_price: 150000,
  buyer_fee: 7500,
  buyer_pays: 157500,
  seat_label: n === 1 ? 'A-12' : undefined,
  tier_name: 'Tribun',
  created_at: '2026-11-01T10:00:00Z',
})

test.describe('jual-beli ulang', () => {
  test('event: daftar listing, beli membawa ke halaman bayar; tamu diminta masuk', async ({
    page,
    request,
  }) => {
    const slug = (await (await request.get('/api/v1/events')).json()).data[0].slug as string
    await page.route(`**/api/v1/events/${slug}/resale`, (r) =>
      r.fulfill({ json: { data: { cap_pct: 120, listings: [L(1), L(2)] } } }),
    )
    await page.goto(`/events/${slug}`)
    const items = page.locator('[data-test=resale-item]')
    await expect(items).toHaveCount(2)
    await expect(items.first()).toContainText('A-12')
    await expect(items.first()).toContainText('Rp')
    await expect(page.locator('[data-test=resale]')).toContainText('120%')
    await items.first().locator('[data-test=resale-buy]').click()
    await expect(page).toHaveURL(/\/masuk/) // tamu
  })

  test('event tanpa resale: tidak ada bagiannya', async ({ page, request }) => {
    const slug = (await (await request.get('/api/v1/events')).json()).data[0].slug as string
    await page.route(`**/api/v1/events/${slug}/resale`, (r) =>
      r.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'tidak ada' } } }),
    )
    await page.goto(`/events/${slug}`)
    await expect(page.locator('[data-test=reviews]')).toBeVisible()
    await expect(page.locator('[data-test=resale]')).toHaveCount(0)
  })

  test('halaman Jual-beli: batalkan listing, isi rekening pencairan', async ({ page }) => {
    await uiLogin(page, EMAIL[test.info().project.name]!, '/ringkasan')
    let listings = [
      {
        id: 'LA'.padEnd(26, '0'),
        price: 100000,
        face_price: 100000,
        buyer_fee: 0,
        buyer_pays: 0,
        status: 'active',
        ticket_id: 'T1'.padEnd(26, '0'),
        created_at: '2026-11-01T10:00:00Z',
      },
    ]
    let sent: unknown = null
    await page.route('**/api/v1/me/resale/listings', (r) => r.fulfill({ json: { data: listings } }))
    await page.route('**/api/v1/resale/listings/*', (r) => {
      listings = []
      return r.fulfill({ status: 204 })
    })
    await page.route('**/api/v1/me/resale/payouts', (r) =>
      r.fulfill({
        json: {
          data: [
            {
              id: 'P1'.padEnd(26, '0'),
              listing_id: 'LB',
              amount: 95000,
              status: 'awaiting_account',
              created_at: '2026-11-02T10:00:00Z',
            },
          ],
        },
      }),
    )
    await page.route('**/api/v1/resale/payouts/*/account', (r) => {
      sent = r.request().postDataJSON()
      return r.fulfill({ status: 204 })
    })
    await page.goto('/jual-beli')
    await expect(page.locator('[data-test=back]')).toHaveCount(1)
    await page.locator('[data-test=payout-edit]').click()
    await page.locator('[data-test=acc-save]').click() // kosong: ditolak di klien
    expect(sent).toBeNull()
    await page.locator('[data-test=acc-bank]').fill('BCA')
    await page.locator('[data-test=acc-name]').fill('Budi Santoso')
    await page.locator('[data-test=acc-no]').fill('1234 5678')
    await page.locator('[data-test=acc-save]').click()
    await expect
      .poll(() => sent)
      .toEqual({ bank_code: 'BCA', account_name: 'Budi Santoso', account_no: '1234 5678' })
    await page.locator('[data-test=listing-cancel]').click()
    await expect(page.locator('[data-test=listing-cancel]')).toHaveCount(0)
  })
})
