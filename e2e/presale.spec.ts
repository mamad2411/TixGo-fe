import { expect, test } from '@playwright/test'

import { buyerEmail, uiLogin } from './helpers'

// Presale & fans di panel tiket. Fase disisipkan ke respons event di jaringan (membuat fase butuh organizer + kode);
// logika BE (kode salah dikunci 15 menit, hanya sebelum fase fan mulai) diuji di BE: phase_test.go.
const day = 86_400_000
const phases = () => [
  {
    id: 'P1'.padEnd(26, '0'),
    name: 'Presale Kartu',
    audience: 'code',
    starts_at: new Date(Date.now() + 2 * day).toISOString(),
    ends_at: new Date(Date.now() + 3 * day).toISOString(),
  },
  {
    id: 'P2'.padEnd(26, '0'),
    name: 'Fans Early',
    audience: 'fan',
    starts_at: new Date(Date.now() + 4 * day).toISOString(),
    ends_at: new Date(Date.now() + 5 * day).toISOString(),
  },
]

test.describe('presale dan fans', () => {
  test('kode salah menampilkan pesan BE, kode benar membuka akses; daftar fans tersimpan', async ({
    page,
    request,
  }) => {
    const slug = (await (await request.get('/api/v1/events')).json()).data[0].slug as string
    await page.route(new RegExp(`/api/v1/events/${slug}$`), async (r) => {
      const res = await r.fetch()
      const j = await res.json()
      j.data.phases = phases()
      await r.fulfill({ response: res, json: j })
    })
    let tries = 0
    await page.route(`**/api/v1/events/${slug}/presale/redeem`, (r) => {
      tries++
      return tries === 1
        ? r.fulfill({
            status: 400,
            json: { error: { code: 'PRESALE_CODE_INVALID', message: 'kode presale tidak valid' } },
          })
        : r.fulfill({ json: { data: phases()[0] } })
    })
    let fans = 0
    await page.route(`**/api/v1/events/${slug}/fan-registration`, (r) => {
      fans++
      return r.fulfill({ status: 204 })
    })

    await uiLogin(page, await buyerEmail(request), `/events/${slug}`)
    const box = page.locator('[data-test=presale]')
    await expect(box).toBeVisible()
    await expect(box).toContainText('Presale Kartu')

    await page.locator('[data-test=presale-redeem]').click() // kosong: ditolak di klien
    await expect(page.locator('[data-test=presale-err]')).toBeVisible()
    expect(tries).toBe(0)
    await page.locator('[data-test=presale-code]').fill('salah')
    await page.locator('[data-test=presale-redeem]').click()
    await expect(page.locator('[data-test=presale-err]')).toBeVisible()
    await page.locator('[data-test=presale-code]').fill('benar')
    await page.locator('[data-test=presale-redeem]').click()
    await expect(page.locator('[data-test=presale-ok]')).toContainText('Presale Kartu')

    await page.locator('[data-test=fan-register]').click()
    await expect(page.locator('[data-test=fan-done]')).toBeVisible()
    expect(fans).toBe(1)
    await page.reload() // status terdaftar bertahan (tanpa endpoint baca)
    await expect(page.locator('[data-test=fan-done]')).toBeVisible()
    await expect(page.locator('[data-test=fan-register]')).toHaveCount(0)
  })

  test('event tanpa fase khusus: tidak ada kotaknya', async ({ page, request }) => {
    const slug = (await (await request.get('/api/v1/events')).json()).data[0].slug as string
    await page.route(new RegExp(`/api/v1/events/${slug}$`), async (r) => {
      const res = await r.fetch()
      const j = await res.json()
      j.data.phases = []
      await r.fulfill({ response: res, json: j })
    })
    await page.goto(`/events/${slug}`)
    await expect(page.locator('[data-test=presale]')).toHaveCount(0)
  })
})
