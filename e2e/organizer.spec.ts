import { expect, test } from '@playwright/test'
import { join } from 'node:path'

import { cleanupOrganizerTestData, uiLogin, uiLoginMfa } from './helpers'

// Area organizer: hanya untuk peran organizer; venue/artis berfoto; draf event + kategori tiket + ajukan.
const ORG = 'organizer@tixgo.local'
const PHOTO = join(import.meta.dirname, 'fixtures-venue.jpg')

test.describe('organizer', () => {
  test.describe.configure({ mode: 'serial' })
  const stamp = Date.now().toString(36)
  // Spec ini membuat venue/artis/event bernama "... Uji": bersihkan agar tidak mengotori katalog publik.
  test.afterAll(() => cleanupOrganizerTestData())

  test('pelanggan biasa tidak bisa membuka area organizer', async ({ page }) => {
    await uiLogin(page, 'bimo@tixgo.local', '/events')
    await page.goto('/organizer/events')
    await expect(page).toHaveURL(/\/events$/)
  })

  test('tamu dialihkan ke halaman masuk', async ({ page }) => {
    await page.goto('/organizer/events')
    await expect(page).toHaveURL(/\/masuk\?next=/)
  })

  test('venue baru dengan foto dan kredit tampil di katalog publik', async ({ page }) => {
    await uiLoginMfa(page, ORG, '/organizer/venues')
    await page.locator('[data-test=v-name]').fill(`Gedung Uji ${stamp}`)
    await page.locator('[data-test=v-city]').fill('Malang')
    await page.locator('[data-test=img-input]').setInputFiles(PHOTO)
    await expect(page.locator('.iu__img')).toBeVisible()
    await page.getByLabel(/kredit foto/i).fill('Foto: Tim Uji, CC0')
    await page.locator('[data-test=v-save]').click()
    await expect(page.locator('[data-test=venue-list]')).toContainText(`Gedung Uji ${stamp}`)
    await page.goto(`/venue?`)
    await page.locator('[data-test=venue-search]').fill(`Gedung Uji ${stamp}`)
    await expect(page.locator('[data-test=venues] li')).toHaveCount(1)
    await expect(page.locator('[data-test=venues] img')).toBeVisible()
  })

  test('validasi venue: nama kosong ditolak di klien', async ({ page }) => {
    await uiLoginMfa(page, ORG, '/organizer/venues')
    await page.locator('[data-test=v-save]').click()
    await expect(page.locator('[data-test=form-err]')).toContainText(/minimal 2 karakter/i)
  })

  test('artis baru dengan foto', async ({ page }) => {
    await uiLoginMfa(page, ORG, '/organizer/artists')
    await page.locator('[data-test=a-name]').fill(`Artis Uji ${stamp}`)
    await page.locator('[data-test=img-input]').setInputFiles(PHOTO)
    await expect(page.locator('.iu__img')).toBeVisible()
    await page.locator('[data-test=a-save]').click()
    await expect(page.locator('[data-test=artist-list]')).toContainText(`Artis Uji ${stamp}`)
  })

  test('draf event -> kategori tiket -> ajukan; event lengkap tidak bisa dipublikasi sebelum disetujui', async ({
    page,
  }) => {
    await uiLoginMfa(page, ORG, '/organizer/events/new')
    await page.locator('[data-test=e-title]').fill(`Konser Uji ${stamp}`)
    await page
      .locator('[data-test=e-venue]')
      .selectOption({ label: new RegExp(`Gedung Uji ${stamp}`) as never })
      .catch(async () => {
        const opt = page.locator('[data-test=e-venue] option', { hasText: `Gedung Uji ${stamp}` })
        await page
          .locator('[data-test=e-venue]')
          .selectOption((await opt.getAttribute('value')) as string)
      })
    await page.locator('[data-test=e-starts]').fill('2027-03-20T19:00')
    await page.locator('[data-test=e-save]').click()
    await expect(page).toHaveURL(/\/organizer\/events\/[0-9A-Z]{26}$/)
    await expect(page.locator('[data-test=status]')).toContainText('Draf')

    // belum ada tier: ajukan harus gagal dengan daftar yang kurang
    await page.locator('[data-test=e-submit]').click()
    await expect(page.locator('[data-test=missing]')).toContainText(/kategori tiket/i)

    await page.locator('[data-test=t-name]').fill('Reguler')
    await page.locator('[data-test=t-price]').fill('150000')
    await page.locator('[data-test=t-quota]').fill('200')
    await page.locator('[data-test=t-add]').click()
    await expect(page.locator('[data-test=tier-row]')).toContainText('Reguler')

    await page.locator('[data-test=e-submit]').click()
    await expect(page.locator('[data-test=status]')).toContainText('Menunggu review')
    await expect(page.locator('[data-test=e-publish]')).toHaveCount(0)
    await page.goto('/organizer/events')
    await expect(page.locator('[data-test=event-list]')).toContainText(`Konser Uji ${stamp}`)
  })
})
