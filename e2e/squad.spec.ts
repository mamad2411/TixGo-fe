import { expect, test, type APIRequestContext } from '@playwright/test'

import { newVerifiedUser, uiLogin } from './helpers'

// Squad dengan BE nyata (dua pengguna). Aturan inti (hold anak, kebijakan bayar, sweep) diuji di BE: squad_test.go.
// Di sini yang dijaga: ketua membuat dari halaman event, teman gabung lewat tautan, bayar bagianku -> halaman bayar,
// ketua membatalkan, dan daftar/kode.
async function gaEventSlug(request: APIRequestContext): Promise<string> {
  const list = await (await request.get('/api/v1/events')).json()
  for (const e of list.data as { slug: string }[]) {
    const ev = (await (await request.get(`/api/v1/events/${e.slug}`)).json()).data
    if (
      ev?.sale_state === 'onsale' &&
      !ev.has_seatmap &&
      !ev.queue_required &&
      (ev.tiers?.[0]?.available ?? 0) >= 4 &&
      ev.max_per_order >= 2
    )
      return e.slug
  }
  throw new Error('tidak ada event umum yang sedang dijual dengan stok >= 4')
}

test.describe('squad', () => {
  test('ketua membuat, teman gabung lewat tautan dan bayar bagiannya, ketua membatalkan', async ({
    page,
    browser,
    request,
  }) => {
    const slug = await gaEventSlug(request)
    const leader = await newVerifiedUser(request)
    const mate = await newVerifiedUser(request)

    // ketua: dari halaman event
    await uiLogin(page, leader, `/events/${slug}`)
    await page.locator('[data-test=squad-start]').click()
    await page.locator('[data-test=squad-size]').fill('2')
    await page.locator('[data-test=squad-create]').click()
    await expect(page).toHaveURL(/\/squads\/[0-9A-Z]{26}$/)
    await expect(page.locator('[data-test=back]')).toHaveCount(1)
    const code = (await page.locator('[data-test=squad-code]').textContent())!.trim()
    expect(code).toMatch(/^[A-Z0-9]{8}$/)
    await expect(page.locator('[data-test=squad-members] li')).toHaveCount(2) // ketua + 1 slot kosong
    await expect(page.locator('[data-test=squad-timer]')).toBeVisible()

    // teman: buka tautan undangan, gabung, bayar bagianku
    const ctx = await browser.newContext(test.info().project.use as never)
    const p2 = await ctx.newPage()
    await uiLogin(p2, mate, `/squad/${code}`)
    await expect(p2.locator('[data-test=join-code]')).toHaveText(code)
    await p2.locator('[data-test=join-btn]').click()
    await expect(p2).toHaveURL(/\/squads\/[0-9A-Z]{26}$/)
    await expect(p2.locator('[data-test=squad-members] li[data-status=joined]')).toHaveCount(2)
    await p2.locator('[data-test=squad-pay]').click()
    // acara berbatas usia: BE menolak dulu (422), halaman meminta konfirmasi, lalu kirim ulang
    await expect(p2.locator('[data-test=squad-age]')).toBeVisible()
    await expect(p2.locator('[data-test=squad-pay]')).toBeDisabled()
    await p2.locator('[data-test=squad-age-ok]').check()
    await p2.locator('[data-test=squad-pay]').click()
    await expect(p2).toHaveURL(/\/pesanan\/[0-9A-Z]{26}\/bayar$/)
    await ctx.close()

    // ketua: batalkan (melepas hold supaya stok tidak bocor antar tes)
    await page.reload()
    await page.locator('[data-test=squad-cancel]').click()
    await page.locator('[data-test=squad-cancel-yes]').click()
    await expect(page.getByText(/Dibatalkan/).first()).toBeVisible()
  })

  test('daftar squad: kode salah ditolak di klien, kode benar ke halaman gabung', async ({
    page,
    request,
  }) => {
    const u = await newVerifiedUser(request)
    await uiLogin(page, u, '/squad-saya')
    await expect(page.locator('[data-test=back]')).toHaveCount(1)
    await page.locator('[data-test=code-input]').fill('abc')
    await page.locator('[data-test=code-go]').click()
    await expect(page).toHaveURL(/\/squad-saya$/)
    await page.locator('[data-test=code-input]').fill('abcd2345')
    await page.locator('[data-test=code-go]').click()
    await expect(page).toHaveURL(/\/squad\/ABCD2345$/)
    await page.locator('[data-test=join-btn]').click()
    await expect(page.locator('[data-test=join-err]')).toBeVisible() // kode tak dikenal: pesan BE tampil
  })
})
