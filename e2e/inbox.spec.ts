import { expect, test } from '@playwright/test'

import { apiLogin, EMAIL, insertNotice, uiLogin } from './helpers'

// Bel notifikasi di header, kotak masuk di /notifikasi, dan halaman "Yang kuikuti".
test.describe('notifikasi dan diikuti', () => {
  test.describe.configure({ mode: 'serial' })
  const who = () => EMAIL[test.info().project.name]!

  test('bel: judul manusiawi, badge, tandai dibaca lewat klik, tandai semua', async ({
    page,
    request,
  }) => {
    insertNotice(who())
    await uiLogin(page, who(), '/events')
    const bell = page.locator('[data-test=bell]')
    await expect(page.locator('[data-test=bell-count]')).toBeVisible()
    await bell.click()
    const panel = page.locator('[data-test=bell-panel]')
    await expect(panel).toBeVisible()
    await expect(panel.getByText('Konser Uji Bel').first()).toBeVisible()
    // Kunci templat mentah tidak boleh bocor ke UI.
    await expect(panel).not.toContainText(/[a-z]+_[a-z]+/)
    await panel.locator('[data-test=bell-readall]').click()
    await expect(page.locator('[data-test=bell-count]')).toBeHidden()
    // Hitungan di server ikut nol (bukan hanya di UI).
    const token = await apiLogin(request, who())
    const r = await request.get('/api/v1/me/notifications/unread-count', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect((await r.json()).data.unread).toBe(0)
  })

  test('halaman notifikasi: filter belum dibaca, klik membuka tujuan dan menandai dibaca', async ({
    page,
  }) => {
    insertNotice(who())
    await uiLogin(page, who(), '/notifikasi')
    const inbox = page.locator('[data-test=inbox]')
    await expect(inbox.locator('[data-test=notice]').first()).toBeVisible()
    await inbox.locator('[data-test=nt-unread]').click()
    const item = inbox.locator('[data-test=notice]').first()
    await expect(item).toContainText('Konser Uji Bel')
    await item.click()
    await expect(page).toHaveURL(/\/pesanan$/)
    await page.goto('/notifikasi')
    await inbox.locator('[data-test=nt-unread]').click()
    await expect(inbox.getByText(/semua sudah dibaca/i)).toBeVisible()
  })

  test('yang kuikuti: kota dan genre bisa ditambah, artis yang diikuti muncul, bertahan setelah reload', async ({
    page,
  }) => {
    await uiLogin(page, who(), '/diikuti')
    const city = page.locator('[data-test=fol-cities]').getByRole('button', { name: 'Bandung' })
    const was = (await city.getAttribute('aria-pressed')) === 'true'
    await city.click()
    await expect(city).toHaveAttribute('aria-pressed', String(!was))
    await page.reload()
    await expect(
      page.locator('[data-test=fol-cities]').getByRole('button', { name: 'Bandung' }),
    ).toHaveAttribute('aria-pressed', String(!was))
    // kembalikan keadaan awal
    await page.locator('[data-test=fol-cities]').getByRole('button', { name: 'Bandung' }).click()

    // ikuti artis dari halaman artis lalu cek di daftar
    // tunggu daftar ikutan dimuat: tombol dibaca sebelum itu bisa tampak "Ikuti" padahal sudah diikuti
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/me/follows') && r.request().method() === 'GET',
      ),
      page.goto('/artis'),
    ])
    const card = page.locator('[data-test=artists] li').first()
    const name = (await card.locator('strong').first().innerText()).trim()
    const btn = card.getByRole('button')
    await expect(btn).toBeVisible()
    const following = (await btn.getAttribute('aria-pressed')) === 'true'
    if (!following) {
      // tunggu POST selesai sebelum pindah halaman, atau permintaan dibatalkan oleh navigasi
      await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/me/follows') && r.request().method() === 'POST',
        ),
        btn.click(),
      ])
    }
    await page.goto('/diikuti')
    await expect(page.locator('[data-test=fol-artists]')).toContainText(name)
    if (!following) {
      await page.locator('[data-test=fol-artists] [data-test=unfollow]').first().click()
    }
  })
})
