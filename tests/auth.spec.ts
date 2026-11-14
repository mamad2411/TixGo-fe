import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/api/client'
import { ApiError, toApiError } from '@/api/errors'
import { safeNext } from '@/router/next'
import { loginSchema, newPassword, phoneSchema, registerSchema } from '@/pages/auth/schemas'
import { useAuthStore } from '@/stores/auth'

const user = {
  id: 'u1',
  email: 'a@b.test',
  name: 'Ani',
  phone: null,
  phone_verified: false,
  email_verified: false,
  role: 'customer',
  locale: 'id',
  mfa_enabled: false,
  created_at: '2026-01-01T00:00:00Z',
}
const session = (token: string) => ({
  data: {
    access_token: token,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    session_id: 's1',
    user,
  },
})

async function reply(
  cfg: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
): Promise<AxiosResponse> {
  const res = { data, status, statusText: '', headers: {}, config: cfg } as AxiosResponse
  if (status >= 200 && status < 300) return res
  throw Object.assign(new Error('http ' + status), {
    isAxiosError: true,
    response: res,
    config: cfg,
  })
}

describe('safeNext (cegah open redirect)', () => {
  it.each([
    ['/events?q=a', '/events?q=a'],
    ['/events/x/pilih', '/events/x/pilih'],
    ['//evil.test', '/events'],
    ['/\\evil.test', '/events'],
    ['https://evil.test', '/events'],
    ['javascript:alert(1)', '/events'],
    ['', '/events'],
    [undefined, '/events'],
    [['/a', '/b'], '/a'],
    ['/a\nb', '/events'],
  ])('%j -> %s', (input, want) => {
    expect(safeNext(input)).toBe(want)
  })
})

describe('toApiError', () => {
  it('memetakan envelope BE', () => {
    const e = toApiError(
      Object.assign(new Error('x'), {
        isAxiosError: true,
        response: {
          status: 409,
          data: { error: { code: 'EMAIL_TAKEN', message: 'dipakai', request_id: 'r1' } },
        },
      }),
    )
    expect(e).toBeInstanceOf(ApiError)
    expect([e.status, e.code, e.requestId]).toEqual([409, 'EMAIL_TAKEN', 'r1'])
  })
  it('tanpa respons = NETWORK (status 0)', () => {
    const e = toApiError(Object.assign(new Error('down'), { isAxiosError: true }))
    expect([e.status, e.code]).toEqual([0, 'NETWORK'])
  })
})

describe('skema validasi (cermin aturan BE)', () => {
  it('kata sandi: <12, tanpa angka, tanpa huruf ditolak; valid diterima', () => {
    expect(newPassword.safeParse('pendek1').success).toBe(false)
    expect(newPassword.safeParse('hanyahuruftanpaangka').success).toBe(false)
    expect(newPassword.safeParse('123456789012').success).toBe(false)
    expect(newPassword.safeParse('rahasia-1234-ok').success).toBe(true)
  })
  it('registrasi wajib setuju syarat', () => {
    const base = { name: 'Ani', email: 'a@b.test', password: 'rahasia-1234-ok' }
    expect(registerSchema.safeParse({ ...base, accept_terms: false }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, accept_terms: true }).success).toBe(true)
  })
  it('login: email salah ditolak dengan kunci i18n', () => {
    const r = loginSchema.safeParse({ email: 'bukan-email', password: 'x' })
    expect(r.success).toBe(false)
    expect(!r.success && r.error.issues[0]?.message).toBe('validation.email')
  })
  it('nomor HP: 08/62/+ diterima, lainnya ditolak', () => {
    for (const ok of ['0812 3456 7890', '6281234567890', '+6281234567890'])
      expect(phoneSchema.safeParse({ phone: ok }).success).toBe(true)
    for (const bad of ['12345', 'abc', '0712345678'])
      expect(phoneSchema.safeParse({ phone: bad }).success).toBe(false)
  })
})

describe('auth store + interceptor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    http.defaults.adapter = undefined
  })

  it('restore tanpa cookie (401) -> tamu, ready=true, tanpa melempar', async () => {
    http.defaults.adapter = ((cfg) =>
      reply(cfg, 401, { error: { code: 'TOKEN_INVALID', message: 'x' } })) as AxiosAdapter
    const s = useAuthStore()
    await s.restore()
    expect(s.ready).toBe(true)
    expect(s.isAuthed).toBe(false)
  })

  it('login menyimpan token di memori saja, bukan di storage', async () => {
    http.defaults.adapter = ((cfg) => reply(cfg, 200, session('tok-1'))) as AxiosAdapter
    const s = useAuthStore()
    await s.login({ email: 'a@b.test', password: 'rahasia-1234-ok' })
    expect(s.isAuthed).toBe(true)
    expect(JSON.stringify({ ...localStorage })).not.toContain('tok-1')
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('tok-1')
  })

  it('401 di endpoint biasa -> refresh SEKALI (single-flight) lalu ulang dengan token baru', async () => {
    const calls: string[] = []
    let refreshes = 0
    http.defaults.adapter = ((cfg) => {
      const url = cfg.url ?? ''
      calls.push(`${url}|${cfg.headers.get('Authorization') ?? '-'}`)
      if (url === '/auth/login') return reply(cfg, 200, session('old'))
      if (url === '/auth/refresh') {
        refreshes++
        return reply(cfg, 200, session('new'))
      }
      return cfg.headers.get('Authorization') === 'Bearer new'
        ? reply(cfg, 200, { data: { ok: true } })
        : reply(cfg, 401, { error: { code: 'UNAUTHENTICATED', message: 'x' } })
    }) as AxiosAdapter
    const s = useAuthStore()
    await s.login({ email: 'a@b.test', password: 'rahasia-1234-ok' })
    const [a, b] = await Promise.all([http.get('/me'), http.get('/me/devices')])
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(refreshes).toBe(1)
    expect(calls.filter((c) => c.startsWith('/me')).every((c) => c.length > 0)).toBe(true)
  })

  it('refresh gagal -> sesi dibersihkan dan galat ApiError dilempar (tanpa putaran)', async () => {
    let refreshes = 0
    http.defaults.adapter = ((cfg) => {
      if (cfg.url === '/auth/login') return reply(cfg, 200, session('old'))
      if (cfg.url === '/auth/refresh') {
        refreshes++
        return reply(cfg, 401, { error: { code: 'TOKEN_INVALID', message: 'x' } })
      }
      return reply(cfg, 401, { error: { code: 'UNAUTHENTICATED', message: 'x' } })
    }) as AxiosAdapter
    const s = useAuthStore()
    await s.login({ email: 'a@b.test', password: 'rahasia-1234-ok' })
    await expect(http.get('/me')).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 })
    expect(refreshes).toBe(1)
    expect(s.isAuthed).toBe(false)
  })

  it('401 INVALID_CREDENTIALS di /auth/login tidak memicu refresh', async () => {
    const hits = vi.fn()
    http.defaults.adapter = ((cfg) => {
      hits(cfg.url)
      return reply(cfg, 401, { error: { code: 'INVALID_CREDENTIALS', message: 'x' } })
    }) as AxiosAdapter
    const s = useAuthStore()
    await expect(s.login({ email: 'a@b.test', password: 'salah-salah-1' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    expect(hits.mock.calls.flat()).toEqual(['/auth/login'])
  })
})
