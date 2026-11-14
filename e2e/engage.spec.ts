import { expect, test } from '@playwright/test'

// Banner cookie, kalender, venue. Banner cookie memakai keadaan bersih (tanpa pilihan tersimpan).
test.describe('cookie', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('banner muncul, pilihan tersimpan ke BE dan tidak muncul lagi', async ({ page }) => {
    const puts: { analytics: boolean; marketing: boolean }[] = []
    page.on('request', (r) => {
      if (r.method() === 'PUT' && r.url().includes('/cookie-consent')) puts.push(r.postDataJSON())
    })
    await page.goto('/events')
    const banner = page.locator('[data-test=cookie-banner]')
    await expect(banner).toBeVisible()
    await page.locator('[data-test=ck-essential]').click()
    await expect(banner).toBeHidden()
    expect(puts).toEqual([{ analytics: false, marketing: false }])
    await page.reload()
    await expect(page.locator('[data-test=cookie-banner]')).toBeHidden()
  })

  test('atur pilihan: analitik saja, lalu dibuka lagi dari footer', async ({ page }) => {
    await page.goto('/events')
    await page.getByRole('button', { name: /atur pilihan|choose/i }).click()
    await page.locator('[data-test=ck-analytics]').click()
    const res = page.waitForResponse(
      (r) => r.url().includes('/cookie-consent') && r.request().method() === 'PUT',
    )
    await page.locator('[data-test=ck-save]').click()
    expect((await res).request().postDataJSON()).toEqual({ analytics: true, marketing: false })
    await expect(page.locator('[data-test=cookie-banner]')).toBeHidden()
    await page.locator('[data-test=cookie-settings]').click()
    await expect(page.locator('[data-test=cookie-banner]')).toBeVisible()
  })
})

test('kalender: bulan memuat konser, tanggal bisa dipilih, navigasi bulan jalan', async ({
  page,
}) => {
  await page.goto('/kalender')
  await expect(page.locator('[data-test=cal-month]')).toBeVisible()
  const next = page.locator('[data-test=cal-next]')
  // Cari bulan (maks 12 ke depan) yang punya konser demo.
  let found = false
  for (let i = 0; i < 12 && !found; i++) {
    await page.waitForLoadState('networkidle')
    found =
      (await page.locator('[data-test=cal-day]').locator(':scope:not([disabled])').count()) > 0
    if (!found) await next.click()
  }
  expect(found).toBeTruthy()
  const day = page.locator('[data-test=cal-day]').locator(':scope:not([disabled])').first()
  await day.click()
  await expect(day).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-test=cal-events]').locator('li').first()).toBeVisible()
  await next.click()
  await expect(page).toHaveURL(/bulan=\d{4}-\d{2}/)
})

test('kalender: lompat bulan dan tahun lewat dropdown tanpa mengetik', async ({ page }) => {
  await page.goto('/kalender')
  await page.locator('[data-test=cal-select-year]').selectOption('2027')
  await page.locator('[data-test=cal-select-month]').selectOption('3')
  await expect(page).toHaveURL(/bulan=2027-03/)
  await expect(page.locator('[data-test=cal-select-year]')).toHaveValue('2027')
  await expect(page.locator('[data-test=cal-select-month]')).toHaveValue('3')
  await page.locator('[data-test=cal-this]').click()
  await expect(page).not.toHaveURL(/bulan=/)
  await page.locator('[data-test=cal-nextmonth]').click()
  await expect(page).toHaveURL(/bulan=\d{4}-\d{2}/)
})

test('venue: daftar, detail dengan peta dan konser', async ({ page }) => {
  await page.goto('/venue')
  await expect(page.locator('[data-test=venues]').locator('li').first()).toBeVisible()
  await expect(page.locator('[data-test=venues] img').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/venues-list.png' })
  await page.locator('[data-test=venue-search]').fill('zzzz-tidak-ada')
  await expect(page.getByText(/venue tidak ditemukan|no venues found/i)).toBeVisible()
  await page.locator('[data-test=venue-search]').fill('')
  await page.locator('[data-test=venues]').locator('a').first().click()
  await expect(page.locator('[data-test=venue]')).toBeVisible()
  const img = page.locator('[data-test=venue-photo] img')
  await expect(img).toBeVisible()
  expect(await img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(100)
  // Lisensi CC BY/BY-SA mewajibkan atribusi: kredit harus tampil bersama foto.
  await expect(page.locator('[data-test=venue-credit]')).toContainText('Foto:')
  await expect(page.getByRole('link', { name: /petunjuk arah|directions/i }).first()).toBeVisible()
})
