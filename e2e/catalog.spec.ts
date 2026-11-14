import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Akun demo bawaan `cmd/seed` (email + HP terverifikasi). Data katalog: `cmd/seed-demo`.
const DEMO = { email: 'rani@tixgo.local', password: 'Demo-Pass-123!' }

async function login(page: Page, next = '/events'): Promise<void> {
  await page.goto(`/masuk?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').fill(DEMO.email)
  await page.locator('#password').fill(DEMO.password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.locator('[data-test=acct]')).toBeVisible()
}

/** Di ponsel kontrol Kota/Kapan/Harga ada di balik tombol "Filter". */
async function openFilters(page: Page): Promise<void> {
  await page.getByRole('region', { name: 'Cari dan filter konser' }).waitFor() // tunggu render dulu
  const toggle = page.getByRole('button', { name: /^Filter/ })
  if (!(await toggle.isVisible())) return // desktop: panel selalu terbuka
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 })
  }).toPass()
}

async function imagesLoaded(
  page: Page,
  selector: string,
): Promise<{ total: number; broken: number }> {
  return page.evaluate(async (sel) => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>(sel)]
    const settle = async (i: HTMLImageElement) => {
      i.scrollIntoView({ block: 'center' }) // gambar lazy baru dimuat saat terlihat
      for (let t = 0; t < 50 && !(i.complete && i.naturalWidth > 0); t++) {
        await new Promise((r) => setTimeout(r, 100))
      }
    }
    for (const i of imgs) await settle(i)
    return {
      total: imgs.length,
      broken: imgs.filter((i) => !i.complete || i.naturalWidth === 0).length,
    }
  }, selector)
}

test.describe('katalog', () => {
  test('spotlight: bisa dijeda dan berpindah slide', async ({ page }) => {
    await page.goto('/events')
    const hero = page.getByRole('region', { name: 'Konser unggulan' })
    await expect(hero).toBeVisible()
    const title = hero.locator('h2')
    const first = await title.textContent()
    await hero.getByRole('button', { name: /Jeda otomatis geser|Putar otomatis geser/ }).click()
    await expect(hero.getByRole('button', { name: 'Putar otomatis geser' })).toBeVisible()
    await hero.locator('.hero__dot').nth(2).click()
    await expect(title).not.toHaveText(first ?? '')
  })

  test('semua poster benar-benar termuat (tanpa gambar rusak)', async ({ page }) => {
    await page.goto('/events')
    await page.locator('[data-test=event-card]').first().waitFor()
    const r = await imagesLoaded(page, '[data-test=event-list] img')
    expect(r.total).toBeGreaterThanOrEqual(10)
    expect(r.broken).toBe(0)
  })

  test('filter kota & genre lewat query-string, hapus filter, dan state kosong', async ({
    page,
  }) => {
    await page.goto('/events')
    await openFilters(page)
    await page.getByLabel('Kota', { exact: true }).selectOption('Bandung')
    await expect(page).toHaveURL(/city=Bandung/)
    await expect(page.locator('[data-test=count]')).toHaveText('3 konser')
    for (const c of await page.locator('[data-test=event-card]').all())
      await expect(c).toContainText('Bandung')

    await page.getByRole('button', { name: /^Jazz/ }).click()
    await expect(page).toHaveURL(/genre=Jazz/)
    await expect(page.locator('[data-test=count]')).toHaveText('1 konser')

    await page.goBack() // riwayat browser memulihkan filter sebelumnya
    await expect(page).not.toHaveURL(/genre=Jazz/)
    await expect(page.locator('[data-test=count]')).toHaveText('3 konser')

    await page.locator('[data-test=clear-filters]').click()
    await expect(page.getByRole('region', { name: 'Konser unggulan' })).toBeVisible()

    await page.goto('/events?q=zzzz-tidak-ada')
    await expect(page.locator('[data-state=empty]')).toBeVisible()
    await page
      .locator('[data-state=empty]')
      .getByRole('button', { name: 'Hapus pencarian' })
      .click()
    await expect(page.locator('[data-test=event-card]').first()).toBeVisible()
  })

  test('kartu membuka halaman detail', async ({ page }) => {
    await page.goto('/events?genre=Rock')
    await page.getByRole('link', { name: 'Rimba Rock Fest 2026' }).click()
    await expect(page).toHaveURL(/\/events\/rimba-rock-fest$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Rimba Rock Fest 2026' }),
    ).toBeVisible()
  })
})

test.describe('favorit', () => {
  test('tamu diarahkan masuk, lalu favorit tersimpan di server dan bertahan setelah reload', async ({
    page,
  }, info) => {
    // Akun demo dipakai bersama project desktop & mobile (paralel): pakai konser berbeda agar tidak saling menimpa.
    const mobile = info.project.name === 'mobile-375'
    const T = mobile ? 'Kirana Orkestra: Malam Nusantara' : 'Malam Jazz Bandung'
    const genre = mobile ? 'Klasik' : 'Jazz'
    await page.goto(`/events?genre=${genre}`)
    const heart = page.getByRole('button', { name: `Simpan ${T} ke favorit` })
    await heart.click()
    await expect(page).toHaveURL(/\/masuk\?next=/)
    await page.getByLabel('Email').fill(DEMO.email)
    await page.locator('#password').fill(DEMO.password)
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`genre=${genre}`)) // kembali ke halaman semula

    const on = page.getByRole('button', { name: `Hapus ${T} dari favorit` })
    const off = page.getByRole('button', { name: `Simpan ${T} ke favorit` })
    await page.waitForLoadState('networkidle') // tunggu daftar favorit akun selesai dimuat
    if (await on.isVisible().catch(() => false)) await on.click() // bersihkan sisa run sebelumnya
    await expect(off).toBeEnabled() // aktif setelah favorit akun termuat
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/me/favorites/') && r.request().method() === 'POST',
      ),
      off.click(),
    ])
    await expect(on).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('button', { name: `Hapus ${T} dari favorit` })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: `Hapus ${T} dari favorit` }).click() // kembalikan
    await expect(page.getByRole('button', { name: `Simpan ${T} ke favorit` })).toBeVisible()
  })
})

test.describe('detail & aksi', () => {
  test('tier, stepper berbatas, dan total perkiraan dari harga server', async ({ page }) => {
    await page.goto('/events/rimba-rock-fest')
    await expect(page.getByText('Konser ini memakai antrean adil')).toBeVisible()
    const total = page.locator('[data-test=total]')
    await expect(total).toContainText('288.750')
    await page.getByRole('button', { name: 'Tambah jumlah' }).click()
    await expect(page.locator('[data-test=qty]')).toHaveText('2')
    await expect(total).toContainText('577.500') // 2 x 288.750 (harga akhir per tiket dari server)
    for (let i = 0; i < 8; i++)
      await page
        .getByRole('button', { name: 'Tambah jumlah' })
        .click({ force: true, trial: false })
        .catch(() => {})
    await expect(page.locator('[data-test=qty]')).toHaveText('6') // maks 6 per pesanan
    await expect(page.getByRole('button', { name: 'Tambah jumlah' })).toBeDisabled()
    await page.getByRole('complementary', { name: 'Tiket' }).getByText('VIP Standing').click()
    await expect(total).toContainText('4.095.000') // 6 x 682.500
  })

  test('bagikan menyalin tautan; kalender .ics valid', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/events/rimba-rock-fest')
    await page.locator('[data-test=share]').click()
    await expect(page.getByText('Tautan disalin.')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      '/events/rimba-rock-fest',
    )

    const href = await page.locator('[data-test=ics]').getAttribute('href')
    const res = await page.request.get(href!)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/calendar')
    expect(await res.text()).toContain('BEGIN:VEVENT')
  })

  test('segera dibuka: hitung mundur + ingatkan (butuh login)', async ({ page }) => {
    await page.goto('/events/horizon-electronic-festival')
    await expect(page.locator('[data-test=countdown]')).toBeVisible()
    await page.locator('[data-test=remind]').click()
    await expect(page).toHaveURL(/\/masuk\?next=/)
    await login(page, '/events/horizon-electronic-festival')
    await page.locator('[data-test=remind]').click()
    await expect(page.locator('[data-test=remind]')).toHaveAttribute('aria-pressed', 'true')
    await page.locator('[data-test=remind]').click() // kembalikan
    await expect(page.locator('[data-test=remind]')).toHaveAttribute('aria-pressed', 'false')
  })

  test('habis: waitlist butuh login; konser wajib antre menampilkan info antrean untuk akun terverifikasi', async ({
    page,
  }) => {
    await page.goto('/events/dara-tur-terakhir')
    await page.locator('[data-test=waitlist]').click()
    await expect(page).toHaveURL(/\/masuk\?next=/)
    await login(page, '/events/rimba-rock-fest')
    await page.locator('[data-test=buy]').click()
    await expect(page.getByText('Antre adil', { exact: true })).toBeVisible() // konser wajib antre: halaman antre = tahap berikutnya
  })

  test('slug tidak ada -> state tidak ditemukan', async ({ page }) => {
    await page.goto('/events/tidak-ada-konser-ini')
    await expect(page.locator('[data-state=error]')).toContainText('tidak ditemukan')
  })
})

test.describe('aksesibilitas & responsif', () => {
  for (const path of ['/events', '/events/rimba-rock-fest', '/events?city=Jakarta']) {
    test(`axe + tanpa overflow + gambar termuat: ${path}`, async ({ page }) => {
      await page.goto(path)
      await page.locator('main#konten img').first().waitFor()
      await page.waitForTimeout(1500)
      const res = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      expect(
        res.violations.map(
          (v) =>
            `${v.id}: ${v.nodes
              .map((n) => n.target.join(' '))
              .slice(0, 4)
              .join(' | ')}`,
        ),
      ).toEqual([])
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(over).toBeLessThanOrEqual(0)
    })
  }
})
