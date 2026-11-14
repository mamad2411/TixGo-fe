import { expect, test } from '@playwright/test'

import { EMAIL, uiLogin } from './helpers'

// Halaman Waitlist saya. Data BE dimock di tingkat jaringan agar status "offered" deterministik
// (membuat tawaran asli butuh stok habis lalu kembali; itu sudah diuji di BE: waitlist_test.go).
const soon = () => new Date(Date.now() + 9 * 60_000).toISOString()
const rows = () => [
  {
    id: 'W1'.padEnd(26, '0'),
    event_id: 'E1'.padEnd(26, '0'),
    event_title: 'Konser Tawaran',
    event_slug: 'konser-tawaran',
    tier_id: 'T1'.padEnd(26, '0'),
    tier_name: 'Festival',
    qty: 2,
    status: 'offered',
    offered_until: soon(),
    hold_id: 'H1'.padEnd(26, '0'),
  },
  {
    id: 'W2'.padEnd(26, '0'),
    event_id: 'E2'.padEnd(26, '0'),
    event_title: 'Konser Antre',
    event_slug: 'konser-antre',
    tier_id: 'T2'.padEnd(26, '0'),
    tier_name: 'VIP',
    qty: 1,
    status: 'waiting',
  },
]

test.describe('waitlist saya', () => {
  test('tawaran tampil di atas, beli ke checkout, keluar menghapus baris', async ({ page }) => {
    await uiLogin(page, EMAIL[test.info().project.name]!, '/ringkasan')
    let list = rows()
    await page.route('**/api/v1/waitlists', (r) => r.fulfill({ json: { data: list } }))
    await page.route('**/api/v1/events/konser-antre/waitlist/*', (r) => {
      list = list.filter((x) => x.event_slug !== 'konser-antre')
      return r.fulfill({ status: 204 })
    })
    await page.goto('/waitlist')
    const items = page.locator('[data-test=waitlist-list] li')
    await expect(items).toHaveCount(2)
    await expect(items.first()).toHaveAttribute('data-status', 'offered') // yang ditawari paling atas
    await expect(items.first().locator('[data-test=wl-buy]')).toHaveAttribute(
      'href',
      /\/checkout\/H1/,
    )
    await expect(page.locator('[data-test=back]')).toHaveCount(1)
    await items.nth(1).locator('[data-test=wl-leave]').click()
    await expect(items).toHaveCount(1)
  })

  test('kosong: ajakan cari event', async ({ page }) => {
    await uiLogin(page, EMAIL[test.info().project.name]!, '/ringkasan')
    await page.route('**/api/v1/waitlists', (r) => r.fulfill({ json: { data: [] } }))
    await page.goto('/waitlist')
    await expect(page.locator('[data-state=empty]')).toBeVisible()
  })
})
