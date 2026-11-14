import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Landing (docs/23 §7): gerbang a11y, overflow, reduced-motion, mode sinematik (pin), tanpa galat konsol.

test.describe('landing — umum', () => {
  test('tidak ada galat konsol dan satu h1', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    expect(errors).toEqual([])
  })

  test('axe: tidak ada pelanggaran serius/kritis (WCAG 2.2 AA)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // animasi intro CSS harus selesai: axe membaca opasitas saat itu, bukan keadaan akhir.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          // grain film berjalan tanpa akhir (infinite): hanya tunggu animasi yang berhingga
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished),
      ),
    )
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(
      bad,
      JSON.stringify(bad.map((v) => [v.id, v.nodes.map((n) => n.html.slice(0, 140))])),
    ).toEqual([])
  })

  test('tidak ada overflow horizontal (375 dan 1440)', async ({ page }) => {
    for (const w of [375, 1440]) {
      await page.setViewportSize({ width: w, height: 900 })
      await page.goto('/')
      const o = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(o, `overflow di ${w}px`).toBeLessThanOrEqual(0)
    }
  })

  test('semua anchor navigasi menuju elemen yang ada', async ({ page }) => {
    await page.goto('/')
    const hashes = await page.$$eval('a[href^="#"]', (as) => [
      ...new Set(as.map((a) => a.getAttribute('href')!)),
    ])
    for (const h of hashes) expect(await page.locator(h).count(), h).toBe(1)
  })
})

test.describe('landing — reduced motion', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
  test('tata letak statis: tanpa kelas sinematik, semua teks bagian terlihat', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.landing')).not.toHaveClass(/is-cinematic/)
    for (const name of [/Temukan/, /Pilih kursi langsung/, /Setiap detail/, /Pilih konsermu/]) {
      await expect(page.getByRole('heading', { name }).first()).toBeVisible()
    }
    // kolom manfaat dan manifesto ikut tampil (tidak hanya ada di scrub)
    await expect(page.getByText('Antrean yang adil').first()).toBeVisible()
    await expect(page.locator('[data-m=manifesto]')).toBeVisible()
  })
})

test.describe('landing — sinematik desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test('hero ter-pin dan portal membuka saat di-scroll; akordeon bekerja', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.landing')).toHaveClass(/is-cinematic/)
    const top = async () => (await page.locator('[data-m=stage]').boundingBox())!.y
    expect(await top()).toBeCloseTo(0, 0)
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 400)
      await page.waitForTimeout(80)
    }
    await page.waitForTimeout(1500)
    expect(await top(), 'hero tetap menempel saat scroll 2400px').toBeCloseTo(0, 0)
    const clip = await page
      .locator('[data-m=clip]')
      .evaluate((e) => (e as HTMLElement).style.clipPath)
    expect(clip, 'klip adegan berubah dari kondisi awal').not.toBe('')
    await page.locator('#keunggulan').scrollIntoViewIfNeeded()
    const btn = page.getByRole('button', { name: /Squad/ })
    await btn.click()
    await expect(btn).toHaveAttribute('aria-expanded', 'true')
  })
})
