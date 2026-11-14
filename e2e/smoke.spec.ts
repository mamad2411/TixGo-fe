import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('beranda memuat dan berjudul TixGo', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/TixGo/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Malam yang')
})

test('tidak ada overflow horizontal di 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('/_kit: tidak ada pelanggaran aksesibilitas serius/kritis (axe)', async ({ page }) => {
  await page.goto('/_kit')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious,
    JSON.stringify(serious.map((v) => [v.id, v.help, v.nodes.map((n) => n.html.slice(0, 160))])),
  ).toEqual([])
})
