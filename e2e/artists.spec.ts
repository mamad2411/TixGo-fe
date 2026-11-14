import { expect, test } from '@playwright/test'

import { apiLogin, buyerEmail, uiLogin } from './helpers'

test.describe('artis & ikuti', () => {
  test('daftar artis bisa dicari; tamu diarahkan masuk saat mengikuti', async ({ page }) => {
    await page.goto('/events')
    await page.locator('[data-test=nav-artists]').click()
    await expect(page).toHaveURL(/\/artis$/)
    const cards = page.locator('[data-test=artists] li')
    await expect(cards.first()).toBeVisible()
    const all = await cards.count()
    expect(all).toBeGreaterThan(3)
    await page.locator('[data-test=artist-search]').fill('Aurora')
    await expect(cards).toHaveCount(1)
    await page.locator('[data-test=artist-search]').fill('zzzz-tidak-ada')
    await expect(page.getByText('Artis tidak ditemukan')).toBeVisible()
    await page.locator('[data-test=artist-search]').fill('')
    await cards.first().locator('[data-test=follow]').click()
    await expect(page).toHaveURL(/\/masuk\?next=/) // tamu
  })

  test('detail artis: konser mendatang; ikuti tersimpan di server dan bertahan setelah reload', async ({
    page,
    request,
  }) => {
    const email = await buyerEmail(request)
    // mulai dari "belum diikuti" (sisa run terputus tidak boleh memengaruhi)
    const token = await apiLogin(request, email)
    await request.delete('/api/v1/me/follows/artist/aurora-prisma', {
      headers: { Authorization: `Bearer ${token}` },
    })
    await uiLogin(page, email, '/artis/aurora-prisma')
    await expect(page.locator('[data-test=artist]')).toContainText('Aurora Prisma')
    await expect(page.locator('[data-test=artist-events] li').first()).toBeVisible()
    await expect(page.locator('[data-test=back]')).toHaveCount(1)
    const btn = page.locator('[data-test=follow]')
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/me/follows') && r.request().method() === 'POST',
      ),
      btn.click(),
    ])
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.locator('[data-test=follow]')).toHaveAttribute('aria-pressed', 'true')
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/me/follows/artist/') && r.request().method() === 'DELETE',
      ),
      page.locator('[data-test=follow]').click(),
    ])
    await expect(page.locator('[data-test=follow]')).toHaveAttribute('aria-pressed', 'false')
  })
})
