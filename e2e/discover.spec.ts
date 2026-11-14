import { expect, test, type Page } from '@playwright/test'

async function openFilters(page: Page): Promise<void> {
  await page.getByRole('region', { name: 'Cari dan filter konser' }).waitFor() // tunggu render dulu
  const toggle = page.getByRole('button', { name: /^Filter/ })
  if (!(await toggle.isVisible())) return // desktop: panel selalu terbuka
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 })
  }).toPass()
}
const count = (page: Page) => page.locator('[data-test=count]')

test.describe('filter v2', () => {
  test('harga, status, dan kapan menyaring lewat API; chip aktif bisa dihapus satu-satu', async ({
    page,
  }) => {
    await page.goto('/events')
    await openFilters(page)

    await page.getByLabel('Harga', { exact: true }).selectOption('gt500')
    await expect(page).toHaveURL(/price=gt500/)
    const n1 = Number((await count(page).textContent())?.match(/\d+/)?.[0])
    expect(n1).toBeGreaterThan(0)
    expect(n1).toBeLessThan(14)

    await page.getByLabel('Status', { exact: true }).selectOption('upcoming')
    await expect(page).toHaveURL(/status=upcoming/)
    await expect(page.getByRole('link', { name: 'Horizon Electronic Festival' })).toBeVisible()

    const chips = page.locator('[data-test=active-filters]')
    await expect(chips).toContainText('Di atas Rp500 rb')
    await chips.getByRole('button', { name: /Hapus filter Di atas Rp500 rb/ }).click()
    await expect(page).not.toHaveURL(/price=/)
    await expect(page).toHaveURL(/status=upcoming/) // hanya satu filter yang hilang

    await page.getByLabel('Kapan', { exact: true }).selectOption('7d')
    await expect(page).toHaveURL(/when=7d/)
    await expect(page.locator('[data-state=empty]')).toBeVisible() // tidak ada yang segera dibuka dalam 7 hari
  })

  test('tab genre berikon: pilih, URL, dan "Semua" mengembalikan jelajah', async ({ page }) => {
    await page.goto('/events')
    await page.getByRole('button', { name: /^Rock/ }).click()
    await expect(page).toHaveURL(/genre=Rock/)
    await expect(page.getByRole('button', { name: /^Rock/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    for (const c of await page.locator('[data-test=event-card]').all())
      await expect(c).toContainText(/rock/i)
    await page.getByRole('button', { name: /^Semua/ }).click()
    await expect(page.getByRole('region', { name: 'Konser unggulan' })).toBeVisible()
  })

  test('parameter URL liar diabaikan (tidak merusak halaman)', async ({ page }) => {
    await page.goto('/events?status=<script>&when=kapan-saja&price=gratis&sort=acak')
    await expect(page.locator('[data-test=event-card]').first()).toBeVisible()
    await expect(page.getByRole('region', { name: 'Konser unggulan' })).toBeVisible()
  })

  test('urutan terpopuler tidak menghilangkan hasil', async ({ page }) => {
    await page.goto('/events')
    await openFilters(page)
    await page.getByLabel('Urutkan', { exact: true }).selectOption('popular')
    await expect(page).toHaveURL(/sort=popular/)
    await expect(count(page)).toHaveText('14 konser')
    // urutan hanya mengatur grid; hero + thumbnail tetap ada
    const hero = page.getByRole('region', { name: 'Konser unggulan' })
    await expect(hero).toBeVisible()
    expect(await hero.locator('.hero__thumb img').count()).toBeGreaterThanOrEqual(3)
  })
})

test.describe('detail: denah, venue, navigasi', () => {
  test('acara bernomor: denah teater dari API dengan seksi, kursi terjual, dan 3D', async ({
    page,
  }) => {
    await page.goto('/events/kirana-orkestra-malam')
    await page.locator('[data-test=view-2d]').click() // tab Zona jadi awal; denah dibuka eksplisit
    const map = page.getByRole('application', { name: /Denah 646 kursi/ })
    await expect(map).toBeVisible()
    expect(await map.locator('[data-seat]').count()).toBe(646)
    expect(await map.locator('.is-sold').count()).toBeGreaterThan(100) // status nyata dari /seats/status
    expect(await map.locator('.is-available').count()).toBeGreaterThan(100)
    await expect(map.getByText('Orkestra Tengah').first()).toBeVisible() // chip zona (Loge + Orchestra)
    await expect(page.getByText('PANGGUNG', { exact: true }).first()).toBeVisible()

    await page.locator('[data-test=view-3d]').click()
    const gl = page.locator('[data-test=venue-3d] canvas')
    await expect(gl).toBeVisible({ timeout: 45_000 }) // three + GLB dimuat lazy; dev server bisa mengoptimasi dependensi
    const box = await gl.boundingBox()
    expect(box!.width).toBeGreaterThan(200)
    await expect(page.getByRole('button', { name: 'Dari atas' })).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole('button', { name: 'Dari kursiku' })).toBeDisabled() // belum ada kursi dipilih
  })

  test('acara festival: denah zona dari tier + fasilitas; klik zona memilih kategori', async ({
    page,
  }) => {
    await page.goto('/events/rimba-rock-fest')
    await page.locator('[data-test=view-2d]').click() // tab Zona jadi awal; denah dibuka eksplisit
    const plan = page.getByRole('group', { name: /Denah festival/ })
    await expect(plan).toBeVisible()
    const zones = plan.getByRole('button')
    await expect(zones).toHaveCount(2)
    await expect(zones.first()).toContainText('VIP Standing') // pit (termahal) digambar paling dekat panggung
    const vip = plan.getByRole('button', { name: /VIP Standing/ })
    await vip.click()
    await expect(vip).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-test=total]')).toContainText('682.500') // panel tiket ikut berubah
    for (const k of ['Toilet', 'P3K', 'Pintu masuk', 'Barikade', 'FOH (sound & lighting)'])
      await expect(page.getByRole('list', { name: 'Legenda denah' }).getByText(k)).toBeVisible()
    await page.locator('[data-test=view-3d]').click()
    await expect(page.locator('[data-test=venue-3d] canvas')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole('button', { name: 'Dari VIP Standing' })).toBeVisible({
      timeout: 45_000,
    })
  })

  test('kartu venue: kapasitas, zona waktu, tautan peta & rute valid', async ({ page }) => {
    await page.goto('/events/horizon-electronic-festival')
    await expect(page.getByText('WITA')).toBeVisible() // Bali = zona waktu venue, bukan perangkat
    const route = page.getByRole('link', { name: 'Petunjuk arah' })
    await expect(route).toHaveAttribute(
      'href',
      /google\.com\/maps\/dir\/\?api=1&destination=-8\.8106%2C115\.1675/,
    )
    await expect(route).toHaveAttribute('rel', /noopener/)
  })

  test('tab section melompat ke bagian dan menandai yang aktif', async ({ page }) => {
    await page.goto('/events/rimba-rock-fest')
    const tabs = page.getByRole('navigation', { name: 'Bagian halaman' })
    await tabs.getByRole('link', { name: 'Lokasi' }).click()
    await expect(page.locator('#lokasi')).toBeInViewport()
    await expect(tabs.getByRole('link', { name: 'Lokasi' })).toHaveClass(/is-on/)
  })

  test('footer: jelajah per kota membawa ke katalog terfilter', async ({ page }) => {
    await page.goto('/events/rimba-rock-fest')
    await page
      .getByRole('navigation', { name: 'Jelajah per kota' })
      .getByRole('link', { name: 'Medan' })
      .click()
    await expect(page).toHaveURL(/city=Medan/)
    await expect(count(page)).toHaveText('1 konser')
  })
})
