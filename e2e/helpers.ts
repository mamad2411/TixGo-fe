import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, type APIRequestContext, type Page, test } from '@playwright/test'

// Akun terpisah per project agar tes paralel tidak berebut pesanan/refund.
export const EMAIL: Record<string, string> = {
  'chromium-desktop': 'bimo@tixgo.local',
  'mobile-375': 'rani@tixgo.local',
}
export const PASSWORD = 'Demo-Pass-123!'

export async function apiLogin(request: APIRequestContext, email: string): Promise<string> {
  const r = await request.post('/api/v1/auth/login', { data: { email, password: PASSWORD } })
  expect(r.ok()).toBeTruthy()
  return (await r.json()).data.access_token as string
}

// Batas beli 4 tiket/akun/event: jelajahi semua event demo tanpa antrean sampai ada yang masih punya jatah.
async function candidateSlugs(request: APIRequestContext): Promise<string[]> {
  const r = await (await request.get('/api/v1/events?per_page=50')).json()
  return (r.data as { slug: string; queue_required: boolean }[])
    .filter((e) => !e.queue_required)
    .map((e) => e.slug)
}

/** Buat pesanan (belum bayar) pada event pertama yang masih punya jatah. */
export async function newOrder(
  request: APIRequestContext,
  email: string,
  token: string,
): Promise<{ id: string; headers: Record<string, string> }> {
  const h = { Authorization: `Bearer ${token}` }
  const errs: string[] = []
  for (const slug of await candidateSlugs(request)) {
    const ev = await (await request.get(`/api/v1/events/${slug}`)).json()
    const tier = ev.data?.tiers?.[0]?.id as string | undefined
    const pol = ev.data?.refund_policy
    // GA (tanpa denah) dan refundable: syarat tes refund/tiket
    const open =
      pol?.refundable_until && new Date(pol.refundable_until).getTime() > Date.now() + 3_600_000
    if (!tier || ev.data.has_seatmap || pol?.type !== 'refundable' || !open) continue
    const hold = await (
      await request.post(`/api/v1/events/${slug}/holds`, {
        headers: h,
        data: { tier_id: tier, qty: 1 },
      })
    ).json()
    if (!hold.data) {
      errs.push(`${slug}: ${hold.error?.code}`)
      continue
    }
    const ord = await (
      await request.post('/api/v1/orders', {
        headers: { ...h, 'Idempotency-Key': crypto.randomUUID() },
        data: {
          hold_id: hold.data.id,
          attendees: [{ name: 'Penguji Refund', email }],
          age_confirmed: true,
        },
      })
    ).json()
    if (ord.data) return { id: ord.data.id as string, headers: h }
    errs.push(`${slug}: order ${ord.error?.code}`)
  }
  throw new Error(`tidak ada event dengan jatah beli tersisa (reset DB demo?): ${errs.join('; ')}`)
}

/** Pesanan LUNAS lewat API (order -> pay -> settle dev; butuh PAYMENT_GATEWAY=fake). */
export async function paidOrder(
  request: APIRequestContext,
  email: string,
  token: string,
): Promise<string> {
  const { id, headers: h } = await newOrder(request, email, token)
  const pay = await request.post(`/api/v1/orders/${id}/pay`, {
    headers: { ...h, 'Idempotency-Key': crypto.randomUUID() },
    data: {},
  })
  if (!pay.ok()) throw new Error(`pay gagal ${pay.status()}: ${await pay.text()}`)
  const settle = await request.post('/api/v1/dev/payments/settle', {
    headers: h,
    data: { order_id: id },
  })
  expect(settle.status()).toBe(204)
  return id
}

export async function uiLogin(page: Page, email: string, next: string): Promise<void> {
  await page.goto(`/masuk?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').fill(email)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.locator('[data-test=acct]')).toBeVisible()
}

/** Id tiket milik pesanan lunas (diterbitkan worker; tunggu sebentar). */
export async function ticketIdOf(
  request: APIRequestContext,
  token: string,
  orderId: string,
): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const r = await (
      await request.get(`/api/v1/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json()
    const id = r.data?.ticket_ids?.[0] as string | undefined
    if (id) return id
    await new Promise((ok) => setTimeout(ok, 500))
  }
  throw new Error('tiket belum terbit (worker jalan?)')
}

// Pembeli segar. Batas beli 4 tiket/akun/event membuat akun demo habis jatah setelah beberapa run, jadi tes yang
// MEMBELI memakai akun baru (diverifikasi lewat DB dev lokal). Akun disimpan di berkas sementara dan dipakai ulang
// lintas worker 10 menit supaya tidak menabrak batas pendaftaran BE (20/jam/jaringan).
const TTL_MS = 10 * 60_000
const buyers = new Map<string, Promise<string>>()
function cacheFile(project: string): string {
  return join(tmpdir(), `tixgo-e2e-buyer-${project}.json`)
}
function readCache(project: string): string | null {
  try {
    const c = JSON.parse(readFileSync(cacheFile(project), 'utf8')) as { email: string; at: number }
    return Date.now() - c.at < TTL_MS ? c.email : null
  } catch {
    return null
  }
}
export async function newVerifiedUser(request: APIRequestContext): Promise<string> {
  const email = `e2e+${Date.now()}${Math.floor(Math.random() * 1e4)}@tixgo.local`
  const body = { email, password: PASSWORD, name: 'Penguji E2E', accept_terms: true }
  let r = await request.post('/api/v1/auth/register', { data: body })
  if (r.status() === 429) {
    // Batas daftar BE (10/jam/IP) habis oleh suite besar. Hanya DEV: reset penghitungnya lalu ulangi sekali.
    execFileSync('docker', [
      'exec',
      'tixgo-redis-1',
      'redis-cli',
      'DEL',
      'rate:rl:register:ip:::1',
      'rate:rl:reg:::1',
    ])
    r = await request.post('/api/v1/auth/register', { data: body })
  }
  if (!r.ok()) throw new Error(`register gagal ${r.status()}: ${await r.text()}`)
  const phone = `+62812${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
  execFileSync('docker', [
    'exec',
    'tixgo-pg-1',
    'psql',
    '-U',
    'tixgo',
    '-d',
    'tixgo',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `UPDATE users SET email_verified_at=now(), phone='${phone}', phone_verified_at=now() WHERE email='${email}'`,
  ])
  return email
}

export function buyerEmail(request: APIRequestContext): Promise<string> {
  const project = test.info().project.name
  let p = buyers.get(project)
  if (!p) {
    p = (async () => {
      const cached = readCache(project)
      if (cached) return cached
      const email = await newVerifiedUser(request)
      writeFileSync(cacheFile(project), JSON.stringify({ email, at: Date.now() }))
      return email
    })()
    buyers.set(project, p)
  }
  return p
}

/** Sisipkan notifikasi belum dibaca untuk akun (kotak masuk membaca log pengiriman yang sama). */
export function insertNotice(email: string, template = 'order_expired'): void {
  const sql = `INSERT INTO notifications (id, user_id, channel, template, to_addr, payload, status, sent_at)
    SELECT substr(md5(random()::text || clock_timestamp()::text), 1, 26), id, 'email', '${template}', email,
      '{"name":"Demo","event_title":"Konser Uji Bel","_locale":"id"}'::jsonb, 'sent', now()
    FROM users WHERE email = '${email.replace(/'/g, "''")}'`
  execFileSync('docker', ['exec', 'tixgo-pg-1', 'psql', '-U', 'tixgo', '-d', 'tixgo', '-c', sql])
}

/** Kode TOTP saat ini untuk akun demo ber-2FA (perintah dev backend/cmd/dev-totp; ditolak di production). */
// Kode terakhir dicatat di berkas agar proses worker/project lain pun tidak memakai ulang kode yang sama.
const totpFile = (email: string) =>
  join(tmpdir(), `tixgo-totp-${email.replace(/[^a-z0-9]/gi, '_')}`)
const lastTotp = {
  get: (email: string): string | undefined => {
    try {
      return readFileSync(totpFile(email), 'utf8')
    } catch {
      return undefined
    }
  },
  set: (email: string, code: string): void => writeFileSync(totpFile(email), code),
}
function totpNow(email: string): string {
  // Memuat .env backend agar sama dengan server dev; email dari konstanta uji, bukan input pengguna.
  return execFileSync(
    'sh',
    ['-c', 'set -a; . ./.env; set +a; go run ./cmd/dev-totp "$1"', 'sh', email],
    {
      encoding: 'utf8',
      cwd: new URL('../../backend', import.meta.url).pathname,
    },
  ).trim()
}
/** BE menolak kode TOTP yang dipakai ulang: bila kode sama dengan yang terakhir, tunggu jendela 30 dtk berikutnya. */
export async function totpFor(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const code = totpNow(email)
    if (code !== lastTotp.get(email)) {
      lastTotp.set(email, code)
      return code
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('kode TOTP tidak berganti dalam 60 dtk')
}

/** Masuk lewat UI dengan akun ber-2FA, lalu buka halaman tujuan. */
export async function uiLoginMfa(page: Page, email: string, next: string): Promise<void> {
  // Kode TOTP bisa ditolak BE (dipakai ulang / pergeseran jendela 30 dtk): ulangi dari awal dengan kode berikutnya.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`/masuk?next=${encodeURIComponent(next)}`)
    await page.getByLabel('Email').fill(email)
    await page.locator('#password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    // pengguna TOTP-saja: pilihan metode tunggal, kolom kode dari MfaCodeField
    await page.locator('[data-test=mf-code]').fill(await totpFor(email))
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    const ok = await page
      .locator('[data-test=acct]')
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      )
    if (ok) return
  }
  await expect(page.locator('[data-test=acct]')).toBeVisible()
}

/** Hapus data yang dibuat spec organizer (nama berawalan "Konser Uji "/"Gedung Uji "/"Artis Uji ") agar katalog dev tetap bersih. */
export function cleanupOrganizerTestData(): void {
  const sql = `BEGIN;
CREATE TEMP TABLE _ev AS SELECT id FROM events WHERE title LIKE 'Konser Uji %';
DELETE FROM event_artists WHERE event_id IN (SELECT id FROM _ev);
DELETE FROM tiers WHERE event_id IN (SELECT id FROM _ev);
DELETE FROM event_sessions WHERE event_id IN (SELECT id FROM _ev);
DELETE FROM sale_phases WHERE event_id IN (SELECT id FROM _ev);
DELETE FROM events WHERE id IN (SELECT id FROM _ev);
DELETE FROM venues WHERE name LIKE 'Gedung Uji %' AND NOT EXISTS (SELECT 1 FROM events e WHERE e.venue_id = venues.id);
DELETE FROM artists WHERE name LIKE 'Artis Uji %' AND NOT EXISTS (SELECT 1 FROM event_artists ea WHERE ea.artist_id = artists.id);
COMMIT;`
  execFileSync(
    'docker',
    ['exec', '-i', 'tixgo-pg-1', 'psql', '-U', 'tixgo', '-d', 'tixgo', '-v', 'ON_ERROR_STOP=1'],
    { input: sql },
  )
}

// ---- faktor kedua (OTP) ----
// OTP dikirim langsung oleh API dan di dev hanya tercatat di log API (LogMailer/LogSMS). Tes membacanya dari berkas log
// yang ditunjuk E2E_API_LOG; tanpa itu tes OTP dilewati dengan alasan jelas (bukan gagal diam-diam).
export const API_LOG = process.env.E2E_API_LOG ?? ''

export function lastOtp(kind: 'email' | 'sms', to: string): string {
  const log = readFileSync(API_LOG, 'utf8').split('\n')
  const tag = kind === 'email' ? 'email (log)' : 'sms (log)'
  const re = kind === 'email' ? /Kode verifikasimu: (\d{6})/ : /Kode TixGo: (\d{6})/
  for (let i = log.length - 1; i >= 0; i--) {
    const l = log[i]!
    if (l.includes(tag) && l.includes(`to=${to}`)) {
      const m = re.exec(l)
      if (m) return m[1]!
    }
  }
  throw new Error(`tidak ada OTP ${kind} ke ${to} di ${API_LOG}`)
}

function psql(sql: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      'tixgo-pg-1',
      'psql',
      '-U',
      'tixgo',
      '-d',
      'tixgo',
      '-tA',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    { encoding: 'utf8' },
  ).trim()
}
export const phoneOf = (email: string): string =>
  psql(`SELECT phone FROM users WHERE email='${email}'`)

/** Menyisipkan token reset yang berlaku 30 menit untuk pengguna dan mengembalikan nilai mentahnya (tautan email asli dikirim worker). */
export function resetTokenFor(email: string): string {
  const raw = randomBytes(24).toString('hex')
  const hash = createHash('sha256').update(raw).digest('hex')
  psql(
    `INSERT INTO email_tokens (id, user_id, kind, token_hash, expires_at) SELECT upper(substr(md5(random()::text||clock_timestamp()::text),1,26)), id, 'reset_password', '${hash}', now() + interval '30 minutes' FROM users WHERE email='${email}'`,
  )
  return raw
}
