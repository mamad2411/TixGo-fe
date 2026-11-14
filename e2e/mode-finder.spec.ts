import { expect, test } from '@playwright/test'

test('toggle mode gelap/terang mengganti kelas, tersimpan setelah muat ulang', async ({ page }) => {
  await page.goto('/events')
  const app = page.locator('.app').first()
  await expect(app).not.toHaveClass(/is-dark/)
  await page.locator('[data-test=mode-toggle]').click()
  await expect(app).toHaveClass(/is-dark/)
  await page.reload()
  await expect(page.locator('.app').first()).toHaveClass(/is-dark/)
  await page.locator('[data-test=mode-toggle]').click()
  await expect(page.locator('.app').first()).not.toHaveClass(/is-dark/)
})

test('festival: dropdown zona mengganti kategori terpilih', async ({ page }) => {
  await page.goto('/events/rimba-rock-fest')
  await page.locator('[data-test=view-2d]').click() // tab Zona jadi awal; denah dibuka eksplisit
  const sel = page.locator('[data-test=zone-select]')
  await expect(sel).toBeVisible()
  const vip = sel.locator('option', { hasText: 'VIP Standing' })
  await sel.selectOption(await vip.getAttribute('value'))
  await expect(page.locator('.fp__zone.is-on')).toBeVisible()
  await expect(page.locator('.fp__zone.is-on')).toHaveAttribute('aria-label', /VIP Standing/)
})

test('bernomor: pencari kursi bertingkat menambah kursi tanpa klik peta', async ({ page }) => {
  await page.goto('/events/kirana-orkestra-malam')
  await page.locator('[data-test=find-tier]').selectOption({ index: 1 })
  const seat = page.locator('[data-test=find-seat]')
  await seat.selectOption({ index: 1 })
  await expect(page.locator('[data-test=tray]')).toBeVisible()
})

test('zoom denah festival memperkecil viewBox dan tombol reset memulihkan', async ({ page }) => {
  await page.goto('/events/rimba-rock-fest')
  await page.locator('[data-test=view-2d]').click() // tab Zona jadi awal; denah dibuka eksplisit
  const svg = page.locator('.fp svg[role=group]')
  await svg.scrollIntoViewIfNeeded()
  const before = await svg.getAttribute('viewBox')
  await page.getByRole('button', { name: 'Perbesar', exact: true }).click()
  expect(await svg.getAttribute('viewBox')).not.toBe(before)
  await page.getByRole('button', { name: 'Kembalikan ukuran' }).click()
  expect(await svg.getAttribute('viewBox')).toBe(before)
})
