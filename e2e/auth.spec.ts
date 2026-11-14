import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Email/SMS dev dicatat BE ke log (notify.LogMailer/LogSMS). Alur yang butuh tautan/kode membaca log itu:
//   E2E_BE_LOG=/path/be.log pnpm e2e e2e/auth.spec.ts
// Tanpa variabel itu, tes yang membutuhkannya DILEWATI (terlihat di laporan), bukan lulus palsu.
// Catatan: BE membatasi registrasi 20/jam/IP (middleware.RateLimit "reg"); satu run = 2 akun per project.
const BE_LOG = process.env.E2E_BE_LOG
const PASSWORD = 'rahasia-Tixgo-2026'

// Email dikirim worker (asynq); OTP SMS dicatat proses API. Beri keduanya, dipisah koma.
function logText(): string {
  return (BE_LOG ?? '')
    .split(',')
    .filter(Boolean)
    .map((f) => readFileSync(f.trim(), 'utf8'))
    .join('\n')
}
/** Ambil kecocokan TERAKHIR `re` di log yang memuat `needle` (email penerima) pada baris yang sama. */
async function fromLog(re: RegExp, needle: string, page: Page): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const lines = logText()
      .split('\n')
      .filter((l) => l.includes(needle))
    for (const l of lines.reverse()) {
      const m = l.match(re)
      if (m?.[1]) return m[1]
    }
    await page.waitForTimeout(250)
  }
  throw new Error(`tidak menemukan ${re} untuk ${needle} di ${BE_LOG}`)
}

const uniq = (info: { project: { name: string } }) =>
  `e2e-${info.project.name}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`

test.describe('publik & guard', () => {
  test('katalog memuat konser nyata dari BE dan header menawarkan Masuk/Daftar', async ({
    page,
  }) => {
    await page.goto('/events')
    await expect(page.locator('[data-test=event-card]').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Masuk' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Daftar' })).toBeVisible()
  })

  test('halaman butuh login mengalihkan tamu ke /masuk?next=', async ({ page }) => {
    await page.goto('/verifikasi-hp')
    await expect(page).toHaveURL(/\/masuk\?next=(%2F|\/)verifikasi-hp/)
    await expect(page.getByRole('heading', { name: 'Masuk', level: 1 })).toBeVisible()
  })

  test('pencarian membawa q ke katalog dan state kosong tampil', async ({ page }) => {
    await page.goto('/events')
    await page.getByRole('searchbox').first().fill('zzzz-tidak-ada-konser')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/q=zzzz/)
    await expect(page.locator('[data-state=empty]')).toBeVisible()
    await page
      .locator('[data-state=empty]')
      .getByRole('button', { name: 'Hapus pencarian' })
      .click()
    await expect(page.locator('[data-test=event-card]').first()).toBeVisible()
  })
})

test.describe('validasi & galat', () => {
  test('daftar kosong menampilkan galat per isian dan tidak mengirim permintaan', async ({
    page,
  }) => {
    let posted = false
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/auth/register')) posted = true
    })
    await page.goto('/daftar')
    await page.getByRole('button', { name: 'Daftar' }).click()
    await expect(page.getByText('Nama minimal 2 karakter.')).toBeVisible()
    await expect(page.getByText('Wajib diisi.')).toBeVisible() // email kosong
    await expect(page.getByText('Kata sandi minimal 12 karakter.')).toBeVisible()
    await expect(
      page.getByText('Setujui syarat dan kebijakan privasi untuk mendaftar.'),
    ).toBeVisible()
    expect(posted).toBe(false)
  })

  test('kata sandi salah -> pesan ramah, tetap di halaman masuk', async ({ page }) => {
    await page.goto('/masuk')
    await page.getByLabel('Email').fill('tidak-ada@tixgo.test')
    await page.getByLabel('Kata sandi', { exact: false }).first().fill('salah-salah-12345')
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page.locator('[data-test=form-error]')).toContainText(
      'Email atau kata sandi salah',
    )
    await expect(page).toHaveURL(/\/masuk/)
  })

  test('tombol tampilkan kata sandi bisa dioperasikan', async ({ page }) => {
    await page.goto('/masuk')
    const pw = page.locator('#password')
    await expect(pw).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Tampilkan kata sandi' }).click()
    await expect(pw).toHaveAttribute('type', 'text')
    await expect(page.getByRole('button', { name: 'Sembunyikan kata sandi' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

test.describe('alur lengkap pelanggan', () => {
  test.skip(!BE_LOG, 'butuh E2E_BE_LOG (log BE dev) untuk membaca tautan email & kode SMS')

  test('daftar -> verifikasi email -> verifikasi HP -> sesi bertahan setelah muat ulang -> keluar -> masuk', async ({
    page,
  }, info) => {
    const id = uniq(info)
    const email = `${id}@tixgo.test`
    const phone = `0812${String(Date.now()).slice(-8)}`

    // 1. daftar
    await page.goto('/daftar')
    await page.getByLabel('Nama lengkap').fill('Pelanggan Uji')
    await page.getByLabel('Email').fill(email)
    await page.locator('#password').fill(PASSWORD)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Daftar' }).click()

    // 2. langsung masuk sesi + diarahkan ke langkah verifikasi email
    await expect(page).toHaveURL(/\/auth\/verify-email$/)
    await expect(page.getByText(`Kami mengirim tautan verifikasi ke ${email}`)).toBeVisible()

    // 3. klik tautan dari email (dibaca dari log BE)
    const token = await fromLog(/verify-email\?token=([\w-]+)/, email, page)
    await page.goto(`/auth/verify-email?token=${token}`)
    await expect(page.locator('[data-test=email-ok]')).toBeVisible()
    await page.getByRole('button', { name: 'Lanjut verifikasi HP' }).click()

    // 4. HP + OTP
    await expect(page).toHaveURL(/\/verifikasi-hp/)
    await page.getByLabel('Nomor HP').fill(phone)
    await page.getByRole('button', { name: 'Kirim kode' }).click()
    await expect(page.locator('[data-test=otp-step]')).toBeVisible()
    const normalized = '+62' + phone.slice(1)
    const code = await fromLog(/sms \(log\).*?text=".*?\b(\d{6})\b/, normalized, page)
    await page.getByLabel('Kode 6 angka').fill('000000' === code ? '111111' : '000000') // kode salah dulu
    await page.getByRole('button', { name: 'Verifikasi', exact: true }).click()
    await expect(page.locator('[data-test=form-error]')).toContainText('Kode salah')
    await page.getByLabel('Kode 6 angka').fill(code)
    await page.getByRole('button', { name: 'Verifikasi', exact: true }).click()
    await expect(page).toHaveURL(/\/events$/)

    // 5. sesi bertahan lewat refresh cookie (token di memori hilang saat reload)
    await page.reload()
    await expect(page.locator('[data-test=acct]')).toContainText('Pelanggan Uji')
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    expect(stored).not.toMatch(/eyJ/) // tidak ada JWT di storage

    // 6. keluar -> tamu, dan tetap tamu setelah reload
    await page.locator('[data-test=acct]').click()
    await page.getByRole('menuitem', { name: 'Keluar' }).click()
    await expect(page.getByRole('link', { name: 'Masuk' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('link', { name: 'Masuk' })).toBeVisible()

    // 6b. ?next= eksternal tidak diikuti (open redirect) -> mendarat di /events, bukan situs luar
    await page.goto('/masuk?next=//evil.test')
    await page.getByLabel('Email').fill(email)
    await page.locator('#password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page).toHaveURL(/\/events$/)
    expect(new URL(page.url()).host).toBe(new URL(info.project.use.baseURL ?? page.url()).host)
    await page.locator('[data-test=acct]').click()
    await page.getByRole('menuitem', { name: 'Keluar' }).click()
    await expect(page.getByRole('link', { name: 'Masuk' })).toBeVisible()

    // 7. masuk lagi, kembali ke halaman asal lewat ?next=
    await page.goto('/masuk?next=%2Fevents%3Fq%3Dindie')
    await page.getByLabel('Email').fill(email)
    await page.locator('#password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page).toHaveURL(/\/events\?q=indie/)
    await expect(page.locator('[data-test=acct]')).toBeVisible()
  })

  test('lupa sandi -> tautan -> atur ulang -> masuk dengan sandi baru', async ({ page }, info) => {
    const id = uniq(info)
    const email = `${id}@tixgo.test`
    await page.goto('/daftar')
    await page.getByLabel('Nama lengkap').fill('Lupa Sandi')
    await page.getByLabel('Email').fill(email)
    await page.locator('#password').fill(PASSWORD)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Daftar' }).click()
    await expect(page).toHaveURL(/verify-email/)
    await page.context().clearCookies()

    await page.goto('/lupa-sandi')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Kirim tautan' }).click()
    await expect(page.locator('[data-test=forgot-sent]')).toBeVisible()

    const token = await fromLog(/reset-password\?token=([\w-]+)/, email, page)
    await page.goto(`/auth/reset-password?token=${token}`)
    const next = 'sandi-baru-Tixgo-9988'
    await page.locator('#password').fill(next)
    await page.getByRole('button', { name: 'Simpan kata sandi' }).click()
    await expect(page.locator('[data-test=reset-done]')).toBeVisible()

    await page.goto('/masuk')
    await page.getByLabel('Email').fill(email)
    await page.locator('#password').fill(next)
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page).toHaveURL(/\/events$/)

    // tautan sekali pakai: kedua kali ditolak
    await page.context().clearCookies()
    await page.goto(`/auth/reset-password?token=${token}`)
    await page.locator('#password').fill('sandi-lain-Tixgo-1122')
    await page.getByRole('button', { name: 'Simpan kata sandi' }).click()
    await expect(page.locator('[data-test=form-error]')).toContainText('Tautan')
  })
})

test.describe('aksesibilitas & responsif', () => {
  for (const path of ['/masuk', '/daftar', '/lupa-sandi']) {
    // /events diuji axe di catalog.spec.ts
    test(`axe WCAG 2.1 AA + tanpa overflow horizontal: ${path}`, async ({ page }) => {
      await page.goto(path)
      await page.locator('main#konten').waitFor()
      if (path === '/events') await page.locator('[data-test=event-card]').first().waitFor()
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => undefined)), // animasi yang dibatalkan (transisi halaman) bukan galat,
        ),
      )
      const res = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      expect(
        res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
      ).toEqual([])
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
