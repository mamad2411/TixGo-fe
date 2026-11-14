import { expect, test } from '@playwright/test'

import { buyerEmail, uiLogin } from './helpers'

test.describe('antre adil', () => {
  test('beli di event wajib-antre membawa ke ruang tunggu; gabung lalu keluar', async ({
    page,
    request,
  }) => {
    const email = await buyerEmail(request)
    await uiLogin(page, email, '/events/rimba-rock-fest')
    await page.locator('[data-test=buy]').click()
    await expect(page).toHaveURL(/\/events\/rimba-rock-fest\/antre$/)
    const q = page.locator('[data-test=queue]')
    await expect(q).toBeVisible()
    await expect(q).toContainText('Antre adil')

    // sisa run sebelumnya: keluar dulu supaya mulai dari "belum gabung"
    const leaveBtn = page.getByRole('button', { name: 'Keluar dari antrean' })
    if (await leaveBtn.isVisible().catch(() => false)) {
      await leaveBtn.click()
      await expect(q).toHaveAttribute('data-state', 'none')
    }
    await expect(q).toHaveAttribute('data-state', 'none')
    await expect(q).toContainText('Datang lebih awal tidak membuatmu lebih depan')
    await page.locator('[data-test=queue-join]').click()
    await expect(q).toHaveAttribute('data-state', /waiting_room|queued|admitted/)
    if ((await q.getAttribute('data-state')) !== 'admitted') {
      await page.getByRole('button', { name: 'Keluar dari antrean' }).click()
      await expect(q).toHaveAttribute('data-state', 'none')
    }
  })

  test('halaman antre punya tombol kembali ke event', async ({ page, request }) => {
    const email = await buyerEmail(request)
    await uiLogin(page, email, '/events/rimba-rock-fest/antre')
    await expect(page.locator('[data-test=back]')).toHaveCount(1)
  })
})
