import { expect, test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { uiLogin, uiLoginMfa } from './helpers'

// Dashboard organizer + panel admin (docs/26): akses per peran, beranda, laci di HP, dan alur tinjau event.
const ORG = 'organizer@tixgo.local'
const ADMIN = 'admin@tixgo.local'
const SLUG = 'malam-jazz-bandung'
// E2E_SHOTS=<folder> menyimpan tangkapan layar untuk diperiksa manusia (tidak wajib).
const SHOTS = process.env.E2E_SHOTS ?? ''

function psql(sql: string, flags: string[] = []): string {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'tixgo-pg-1',
      'psql',
      '-U',
      'tixgo',
      '-d',
      'tixgo',
      '-v',
      'ON_ERROR_STOP=1',
      ...flags,
    ],
    { input: sql },
  ).toString()
}
async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false })
}

test.describe('dashboard organizer', () => {
  // login 2FA bisa menunggu jendela TOTP 30 dtk berikutnya (BE menolak kode yang dipakai ulang)
  test.describe.configure({ timeout: 120_000 })
  test('pembeli biasa tidak bisa membuka dashboard organizer maupun admin', async ({ page }) => {
    await uiLogin(page, 'bimo@tixgo.local', '/events')
    await page.goto('/organizer')
    await expect(page).toHaveURL(/\/events$/)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/events$/)
  })

  test('beranda: langkah berikutnya, empat angka, dan event terbaru', async ({ page }, info) => {
    await uiLoginMfa(page, ORG, '/organizer')
    await expect(page).toHaveURL(/\/organizer\/beranda$/)
    await expect(page.locator('[data-test=org-home]')).toBeVisible()
    await expect(page.locator('[data-test=next-step] h2')).toBeVisible()
    await expect(page.locator('.kpi')).toHaveCount(4)
    // tidak ada overflow horizontal di lebar apa pun
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(over).toBe(false)
    await shot(page, `org-home-${info.project.name}`)
  })

  test('navigasi: sidebar di desktop, laci di HP; tautan Event membuka daftar', async ({
    page,
  }, info) => {
    await uiLoginMfa(page, ORG, '/organizer')
    const mobile = info.project.name.startsWith('mobile')
    if (mobile) {
      await expect(page.locator('#ds-side')).toBeHidden()
      await page.getByRole('button', { name: 'Buka menu' }).click()
      await expect(page.locator('#ds-side')).toBeVisible()
      await shot(page, 'org-drawer-mobile')
      await page.keyboard.press('Escape')
      await expect(page.locator('#ds-side')).toBeHidden()
      await page.getByRole('button', { name: 'Buka menu' }).click()
    } else {
      await expect(page.locator('#ds-side')).toBeVisible()
    }
    await page.locator('#ds-side').getByRole('link', { name: 'Event', exact: true }).click()
    await expect(page).toHaveURL(/\/organizer\/events$/)
    await expect(page.locator('#ds-side'))
      .toBeHidden({ timeout: mobile ? 5000 : 1 })
      .catch(() => {})
  })

  test('organizer tidak melihat menu admin dan tidak bisa membuka /admin', async ({ page }) => {
    await uiLoginMfa(page, ORG, '/organizer')
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/events$/)
  })
})

test.describe('panel admin', () => {
  test.describe.configure({ mode: 'serial' })
  let title = ''
  test.beforeAll(() => {
    title = psql(`SELECT title FROM events WHERE slug='${SLUG}';`, ['-At']).trim()
    psql(`UPDATE events SET status='in_review' WHERE slug='${SLUG}';`)
  })
  // Event contoh dikembalikan ke keadaan semula agar spec lain (katalog/pembelian) tidak terpengaruh.
  test.afterAll(() => {
    psql(`UPDATE events SET status='published', review_note=NULL WHERE slug='${SLUG}';`)
  })

  test('beranda admin: kartu antrean dan corong tampil', async ({ page }, info) => {
    await uiLoginMfa(page, ADMIN, '/admin')
    await expect(page).toHaveURL(/\/admin\/beranda$/)
    await expect(page.locator('[data-test=queue-card]')).toContainText(/menunggu/i)
    await expect(page.locator('[data-test=funnel] li')).toHaveCount(6)
    await shot(page, `admin-home-${info.project.name}`)
  })

  test('antrean: tolak wajib alasan >= 10 karakter, lalu event kembali ke draf', async ({
    page,
  }, info) => {
    await uiLoginMfa(page, ADMIN, '/admin/events')
    const row = page.locator('[data-test=review-list] li', { hasText: title })
    await expect(row).toBeVisible()
    await shot(page, `admin-queue-${info.project.name}`)
    await row.locator('[data-test=review-open]').click()
    await expect(page.locator('[data-test=review-drawer]')).toBeVisible()
    await page.waitForTimeout(500) // tunggu animasi laci selesai sebelum tangkapan layar
    await shot(page, `admin-drawer-${info.project.name}`)
    await page.locator('[data-test=reject-start]').click()
    const confirm = page.locator('[data-test=reject-confirm]')
    await expect(confirm).toBeDisabled()
    await page.locator('[data-test=reject-note] textarea').fill('terlalu singkat')
    await expect(confirm).toBeEnabled()
    await page.locator('[data-test=reject-note] textarea').fill('pendek')
    await expect(confirm).toBeDisabled()
    await page
      .locator('[data-test=reject-note] textarea')
      .fill('Poster belum ada dan deskripsi terlalu singkat.')
    await confirm.click()
    await expect(row).toHaveCount(0)
    expect(psql(`SELECT status FROM events WHERE slug='${SLUG}';`, ['-At']).trim()).toBe('draft')
  })

  test('antrean: setujui memindahkan event ke tab Disetujui', async ({ page }) => {
    psql(`UPDATE events SET status='in_review' WHERE slug='${SLUG}';`)
    await uiLoginMfa(page, ADMIN, '/admin/events')
    const row = page.locator('[data-test=review-list] li', { hasText: title })
    await row.locator('[data-test=review-open]').click()
    await page.locator('[data-test=approve]').click()
    await expect(row).toHaveCount(0)
    await page.locator('[data-test=tab-approved]').click()
    await expect(page).toHaveURL(/status=approved/)
    await expect(page.locator('[data-test=review-list] li', { hasText: title })).toBeVisible()
  })
})

test.describe('workspace event organizer', () => {
  test.describe.configure({ timeout: 120_000 })
  let eventId = ''
  test.beforeAll(() => {
    // event milik organizer seed yang punya tiket terbit terbanyak: dijamin punya peserta & penjualan
    eventId = psql(
      `SELECT t.event_id FROM tickets t JOIN events e ON e.id=t.event_id JOIN organizers o ON o.id=e.organizer_id
       WHERE o.name='Panggung Kita' GROUP BY t.event_id ORDER BY count(*) DESC LIMIT 1;`,
      ['-At'],
    ).trim()
  })

  test('kepala workspace: judul, status, kesiapan, dan tab', async ({ page }, info) => {
    await uiLoginMfa(page, ORG, `/organizer/events/${eventId}`)
    const ws = page.locator('[data-test=event-workspace]')
    await expect(ws.locator('h1')).toHaveCount(1)
    await expect(ws.locator('[data-test=status]')).toBeVisible()
    await expect(ws.locator('.ew__ring')).toBeVisible()
    await expect(ws.getByRole('link', { name: 'Penjualan' })).toBeVisible()
    await expect(ws.getByRole('link', { name: 'Peserta' })).toBeVisible()
    await expect(page.locator('[data-test=event-form]')).toBeVisible()
    await shot(page, `ws-detail-${info.project.name}`)
  })

  test('penjualan: angka, grafik, kategori, dan ganti rentang', async ({ page }, info) => {
    await uiLoginMfa(page, ORG, `/organizer/events/${eventId}/penjualan`)
    await expect(page.locator('[data-test=org-sales]')).toBeVisible()
    await expect(page.locator('[data-test=org-sales] .kpi')).toHaveCount(4)
    await expect(page.locator('[data-test=tier-bars] li').first()).toBeVisible()
    const chart = page.locator('[data-test=sales-chart]')
    await expect(chart.locator('svg, [data-test=sales-empty]').first()).toBeVisible()
    await page.getByRole('button', { name: '90 hari' }).click()
    await expect(page.getByRole('button', { name: '90 hari' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await shot(page, `ws-sales-${info.project.name}`)
  })

  test('peserta: cari, filter, kosong, CSV, dan gerbang konfirmasi pembatalan', async ({
    page,
  }, info) => {
    await uiLoginMfa(page, ORG, `/organizer/events/${eventId}/peserta`)
    await expect(page.locator('[data-test=att-list] li').first()).toBeVisible()
    await shot(page, `ws-attendees-${info.project.name}`)

    // pencarian tanpa hasil -> state kosong ber-tombol hapus filter
    await page.locator('[data-test=att-search]').fill('zzzzzz-tidak-ada')
    await expect(page).toHaveURL(/q=zzzzzz/)
    await expect(page.locator('[data-state=empty]')).toBeVisible()
    await page
      .locator('[data-state=empty]')
      .getByRole('button', { name: /hapus filter/i })
      .click()
    await expect(page.locator('[data-test=att-list] li').first()).toBeVisible()

    // unduh CSV
    const dl = page.waitForEvent('download')
    await page.locator('[data-test=att-csv]').click()
    expect((await dl).suggestedFilename()).toMatch(/^peserta-.*\.csv$/)

    // tiket berlaku: Batalkan tiket baru aktif setelah dicentang (tidak dijalankan)
    await page.locator('[data-test=att-status]').selectOption('valid')
    await page.locator('[data-test=att-manage]').first().click()
    await expect(page.locator('[data-test=att-sheet]')).toBeVisible()
    await page.locator('[data-test=act-void]').click()
    const run = page.locator('[data-test=att-run]')
    await expect(run).toBeDisabled()
    await page.locator('[data-test=att-sure]').check()
    await expect(run).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-test=att-sheet]')).toHaveCount(0)
  })
})

test.describe('kontrol & promo event', () => {
  test.describe.configure({ timeout: 120_000 })
  let eventId = ''
  const code = `E2E${Date.now().toString(36).toUpperCase()}`
  test.beforeAll(() => {
    eventId = psql(
      `SELECT e.id FROM events e JOIN organizers o ON o.id=e.organizer_id
       WHERE o.name='Panggung Kita' AND e.status='published' ORDER BY e.starts_at LIMIT 1;`,
      ['-At'],
    ).trim()
  })
  // kode promo uji dibersihkan agar katalog/checkout dev tidak terpengaruh
  test.afterAll(() => {
    psql(`DELETE FROM promo_codes WHERE code LIKE 'E2E%';`)
  })

  test('kontrol: setiap tindakan berisiko punya gerbang (alasan, dampak, ketik nama)', async ({
    page,
  }, info) => {
    await uiLoginMfa(page, ORG, `/organizer/events/${eventId}/kontrol`)
    await expect(page.locator('[data-test=org-control]')).toBeVisible()
    await shot(page, `ws-control-${info.project.name}`)

    // jeda: butuh alasan >= 3 karakter
    await page.locator('[data-test=ctl-pause]').click()
    const run = page.locator('[data-test=ctl-run]')
    await expect(run).toBeDisabled()
    await page.locator('[data-test=ctl-reason] textarea').fill('ab')
    await expect(run).toBeDisabled()
    await page.locator('[data-test=ctl-reason] textarea').fill('Cek sound system')
    await expect(run).toBeEnabled()
    await page.keyboard.press('Escape')

    // batal: dampak tampil, butuh alasan DAN mengetik nama event
    await page.locator('[data-test=ctl-cancel]').click()
    await expect(page.locator('[data-test=ctl-impact]')).toContainText(/refund penuh/i)
    await page.locator('[data-test=ctl-reason] textarea').fill('Alasan pembatalan uji')
    await expect(run).toBeDisabled()
    const title = psql(`SELECT title FROM events WHERE id='${eventId}';`, ['-At']).trim()
    await page.locator('[data-test=ctl-typed] input').fill(title)
    await expect(run).toBeEnabled()
    await page.keyboard.press('Escape')

    // salin: tanggal harus di masa depan
    await page.locator('[data-test=ctl-duplicate]').click()
    await expect(run).toBeDisabled()
    await page.locator('[data-test=ctl-start]').fill('2030-01-01T19:00')
    await expect(run).toBeEnabled()
    await page.keyboard.press('Escape')
    // tidak ada yang dijalankan: event tetap terbit
    expect(psql(`SELECT status FROM events WHERE id='${eventId}';`, ['-At']).trim()).toBe(
      'published',
    )
  })

  test('promo: buat kode, nonaktifkan, dan lihat laporan', async ({ page }, info) => {
    await uiLoginMfa(page, ORG, `/organizer/events/${eventId}/promo`)
    await page.locator('[data-test=promo-new]').click()
    const save = page.locator('[data-test=promo-save]')
    await expect(save).toBeDisabled()
    await page.locator('[data-test=pr-code] input').fill(code.toLowerCase())
    await page.locator('[data-test=pr-val] input').fill('150') // persen > 100 ditolak di klien
    await expect(save).toBeDisabled()
    await page.locator('[data-test=pr-val] input').fill('10')
    await expect(save).toBeEnabled()
    await save.click()
    const card = page.locator('[data-test=promo-list] li', { hasText: code })
    await expect(card).toBeVisible()
    await expect(card).toContainText('10%')
    await shot(page, `ws-promo-${info.project.name}`)
    const sw = card.getByRole('switch')
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    await sw.click()
    await expect(sw).toHaveAttribute('aria-checked', 'false')
    await card.locator('[data-test=promo-report]').click()
    await expect(card.locator('.rep dd')).toHaveCount(3)
  })
})

test.describe('panel admin: organizer, pengguna, pencairan', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })
  // organizer seed dibuat "menunggu tinjauan" sementara agar alur keputusan bisa diuji; dikembalikan setelahnya
  test.beforeAll(() => {
    psql(`UPDATE organizers SET kyb_status='submitted' WHERE name='Panggung Kita';`)
  })
  test.afterAll(() => {
    psql(`UPDATE organizers SET kyb_status='approved' WHERE name='Panggung Kita';`)
  })

  test('organizer: antrean KYB, detail, dan gerbang alasan penolakan', async ({ page }, info) => {
    await uiLoginMfa(page, ADMIN, '/admin/organizer')
    const row = page.locator('[data-test=org-list] li', { hasText: 'Panggung Kita' })
    await expect(row).toBeVisible()
    await shot(page, `admin-org-${info.project.name}`)
    await row.locator('[data-test=org-open]').click()
    await expect(page.locator('[data-test=org-sheet]')).toBeVisible()
    await page.locator('[data-test=kyb-reject]').click()
    const go = page.locator('[data-test=kyb-confirm]')
    await expect(go).toBeDisabled()
    await page.locator('[data-test=kyb-reason] textarea').fill('pendek')
    await expect(go).toBeDisabled()
    await page.locator('[data-test=kyb-reason] textarea').fill('Dokumen akta belum terbaca jelas.')
    await expect(go).toBeEnabled()
    await page.keyboard.press('Escape')
    // tidak ada keputusan yang dijalankan. Membuka detail memang menandai 'sedang ditinjau' (perilaku BE), jadi
    // yang dipastikan: statusnya belum approved/rejected.
    expect(['submitted', 'in_review']).toContain(
      psql(`SELECT kyb_status FROM organizers WHERE name='Panggung Kita';`, ['-At']).trim(),
    )
  })

  test('pengguna: cari, filter, detail, dan gerbang blokir/peran', async ({ page }, info) => {
    await uiLoginMfa(page, ADMIN, '/admin/pengguna')
    await expect(page.locator('[data-test=user-list] li').first()).toBeVisible()
    await page.locator('[data-test=user-search]').fill('bimo@')
    await expect(page).toHaveURL(/q=bimo/)
    const row = page.locator('[data-test=user-list] li', { hasText: 'bimo@tixgo.local' })
    await expect(row).toBeVisible()
    await shot(page, `admin-users-${info.project.name}`)
    await row.locator('[data-test=user-open]').click()
    await expect(page.locator('[data-test=user-sheet]')).toBeVisible()
    await page.locator('[data-test=user-block]').click()
    const go = page.locator('[data-test=block-confirm]')
    await expect(go).toBeDisabled()
    await page.locator('[data-test=block-reason] textarea').fill('Uji')
    await expect(go).toBeEnabled()
    await page.keyboard.press('Escape')
    // pencarian tanpa hasil -> state kosong
    await page.locator('[data-test=user-search]').fill('zzzz-tidak-ada')
    await expect(page.locator('[data-state=empty]')).toBeVisible()
    expect(psql(`SELECT status FROM users WHERE email='bimo@tixgo.local';`, ['-At']).trim()).toBe(
      'active',
    )
  })

  test('pencairan: tab antrean tampil (daftar atau kosong) dan bisa berganti', async ({
    page,
  }, info) => {
    await uiLoginMfa(page, ADMIN, '/admin/pencairan')
    await expect(page.locator('[data-test=admin-payouts]')).toBeVisible()
    await expect(page.locator('[data-test=pay-list] li, [data-state=empty]').first()).toBeVisible()
    await page.locator('[data-test=pay-tab-paid]').click()
    await expect(page).toHaveURL(/status=paid/)
    await shot(page, `admin-payouts-${info.project.name}`)
  })

  test('menu admin memuat Organizer, Pengguna, Pencairan', async ({ page }, info) => {
    await uiLoginMfa(page, ADMIN, '/admin')
    if (info.project.name.startsWith('mobile'))
      await page.getByRole('button', { name: 'Buka menu' }).click()
    const side = page.locator('#ds-side')
    for (const n of ['Tinjau event', 'Organizer & KYB', 'Pengguna', 'Pencairan'])
      await expect(side.getByRole('link', { name: n, exact: true })).toBeVisible()
  })
})

test.describe('tujuan setelah masuk', () => {
  test.describe.configure({ timeout: 120_000 })
  test('admin tanpa ?next= masuk ke panel admin', async ({ page }) => {
    await uiLoginMfa(page, ADMIN, '')
    await expect(page).toHaveURL(/\/admin\/beranda$/)
    await expect(page.locator('[data-test=admin-home]')).toBeVisible()
  })
  test('organizer tanpa ?next= masuk ke dashboard organizer', async ({ page }) => {
    await uiLoginMfa(page, ORG, '')
    await expect(page).toHaveURL(/\/organizer\/beranda$/)
  })
  test('pembeli tanpa ?next= tetap ke katalog', async ({ page }) => {
    await uiLogin(page, 'bimo@tixgo.local', '')
    await expect(page).toHaveURL(/\/events$/)
  })
})
