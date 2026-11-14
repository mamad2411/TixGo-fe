import { expect, test, type Page } from '@playwright/test'

// Akun demo (email + HP terverifikasi). Voucher demo dari cmd/seed-demo: KIRANA50K = potongan Rp50.000.
const DEMO = { email: 'bimo@tixgo.local', password: 'Demo-Pass-123!' }

async function login(page: Page, next: string): Promise<void> {
  await page.goto(`/masuk?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').fill(DEMO.email)
  await page.locator('#password').fill(DEMO.password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.locator('[data-test=acct]')).toBeVisible()
}

test.describe('pilih kursi -> checkout -> voucher', () => {
  test.describe.configure({ mode: 'serial' })

  test('pilih otomatis, tahan kursi, voucher salah/benar, lepas tiket', async ({ page }) => {
    await login(page, '/events/kirana-orkestra-malam')
    await page.locator('[data-test=view-2d]').click() // tab Zona jadi awal; denah dibuka eksplisit
    await expect(page.getByRole('application', { name: /Denah 646 kursi/ })).toBeVisible()
    const buy = page.locator('[data-test=buy]')
    await expect(buy).toBeDisabled() // belum ada kursi

    await page.locator('[data-test=auto-pick]').click()
    await expect(page.locator('[data-test=tray]')).toContainText('2 kursi dipilih')
    await expect(page.locator('[data-test=panel-seats] li')).toHaveCount(2)
    await expect(buy).toContainText('Tahan 2 kursi')
    await buy.click()

    // checkout
    await expect(page).toHaveURL(/\/checkout\/[0-9A-Z]{26}$/)
    await expect(page.locator('[data-test=hold-timer]')).toBeVisible()
    const subtotal = page.locator('[data-test=subtotal]')
    await expect(subtotal).toBeVisible()
    const before = await page.locator('[data-test=grand-total]').textContent()

    await page.getByLabel('Kode voucher').fill('SALAH123')
    await page.locator('[data-test=voucher-apply]').click()
    await expect(page.locator('[data-test=voucher-msg]')).not.toHaveText('') // galat ramah dari server
    await expect(page.locator('[data-test=grand-total]')).toHaveText(before!) // ringkasan tidak berubah

    await page.getByLabel('Kode voucher').fill('kirana50k') // huruf kecil diterima
    await page.locator('[data-test=voucher-apply]').click()
    await expect(page.locator('[data-test=voucher-applied]')).toContainText('KIRANA50K')
    await expect(page.locator('[data-test=discount]')).toContainText('50.000')
    const after = await page.locator('[data-test=grand-total]').textContent()
    const num = (s: string | null) => Number((s ?? '').replace(/[^\d]/g, ''))
    expect(num(before) - num(after)).toBe(50000) // diskon dihitung server

    await page.getByRole('button', { name: 'Lepas voucher' }).click()
    await expect(page.locator('[data-test=grand-total]')).toHaveText(before!)

    await page.locator('[data-test=release]').click() // bebaskan kursi untuk tes lain
    await expect(page).toHaveURL(/\/events\/kirana-orkestra-malam$/)
  })

  test('pilih kursi lewat papan ketik (panah + Enter); batas per pesanan; panel ikut', async ({
    page,
  }) => {
    await login(page, '/events/malam-jazz-bandung')
    await page.locator('[data-test=view-2d]').click() // tab Zona jadi awal; denah dibuka eksplisit
    const map = page.getByRole('application', { name: /Denah \d+ kursi/ })
    await expect(map).toBeVisible()
    await map.focus()
    await page.keyboard.press('Enter') // kursi tersedia pertama yang berfokus
    await expect(page.locator('[data-test=tray]')).toContainText('1 kursi dipilih')
    await page.keyboard.press('Enter') // Enter lagi = batal
    await expect(page.locator('[data-test=tray]')).toHaveCount(0)
    // batas: max_per_order (6) -> pesan jelas, bukan diam
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Enter') // kursi terjual diabaikan; kursi tersedia ditambahkan sampai batas
      await page.keyboard.press('ArrowRight')
    }
    await expect(page.getByText('Maksimal 6 kursi per pesanan.').first()).toBeVisible()
    await expect(page.locator('[data-test=panel-seats] li')).toHaveCount(6)
  })

  test('hold kedaluwarsa/tidak dikenal -> state waktu habis, bukan layar kosong', async ({
    page,
  }) => {
    await login(page, '/events')
    await page.goto('/checkout/01ZZZZZZZZZZZZZZZZZZZZZZZZ')
    await expect(page.locator('[data-state=expired]')).toBeVisible()
  })
})

test.describe('navigasi kembali & auth v2', () => {
  test('tombol Kembali: dari katalog kembali ke katalog; tautan langsung jatuh ke /events', async ({
    page,
  }) => {
    await page.goto('/events?genre=Rock')
    await page.getByRole('link', { name: 'Rimba Rock Fest 2026' }).click()
    await page.locator('[data-test=back]').click()
    await expect(page).toHaveURL(/genre=Rock/)

    await page.goto('/events/rimba-rock-fest') // tanpa riwayat aplikasi
    await page.locator('[data-test=back]').click()
    await expect(page).toHaveURL(/\/events$/)
  })

  test('auth v2: panel konser nyata, stepper daftar, kekuatan sandi, tombol kembali', async ({
    page,
  }) => {
    await page.goto('/daftar')
    await expect(page.getByRole('list', { name: 'Langkah pendaftaran' })).toBeVisible()
    await expect(page.locator('[data-test=back]')).toBeVisible()
    const meter = page.locator('[data-test=pw-meter]')
    await expect(meter).toHaveCount(0)
    await page.locator('#password').fill('abc')
    await expect(meter).toContainText('Lemah')
    await page.locator('#password').fill('rahasia-Tixgo-2026!')
    await expect(meter).toContainText(/Kuat|Sangat kuat/)
    if ((await page.viewportSize())!.width >= 960)
      await expect(page.getByText('Lagi ramai')).toBeVisible() // konser nyata
  })
})
