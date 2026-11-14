import axios, { type InternalAxiosRequestConfig } from 'axios'

import { toApiError } from './errors'

// Klien HTTP dasar. Tipe respons berasal dari src/api/generated (pnpm api:gen) bila skema BE bertipe;
// untuk endpoint yang skemanya masih `additionalProperties`, tipe ditulis di modul api/* terkait.
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  timeout: 15000,
})

/** Jembatan ke auth store (hindari impor melingkar). Diikat sekali di main.ts. */
export interface AuthBridge {
  getToken(): string | null
  /** Tukar refresh cookie dengan access token baru; null bila sesi tidak bisa dipulihkan. */
  refresh(): Promise<string | null>
  /** Dipanggil saat sesi benar-benar habis (refresh gagal). */
  onExpired(): void
}

let bridge: AuthBridge | null = null
export function bindAuth(b: AuthBridge | null): void {
  bridge = b
}

type Retriable = InternalAxiosRequestConfig & { _retried?: boolean }

// Endpoint yang 401-nya bermakna sendiri (salah sandi, MFA, refresh habis) -> jangan coba refresh.
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/password/']

/**
 * Jembatan bisa kosong walau aplikasi sudah berjalan: modul ini dievaluasi ulang saat HMR, sedangkan
 * store auth hanya mengikatnya sekali ketika pertama dipakai. Kalau dibiarkan, permintaan keluar tanpa
 * header Authorization DAN tanpa percobaan refresh, jadi 401 mentah muncul di konsol. Ambil ulang
 * jembatan sekali di jalur galat; impor dinamis supaya bundel landing tidak ikut menarik store auth.
 */
async function currentBridge(): Promise<AuthBridge | null> {
  if (bridge) return bridge
  try {
    const { useAuthStore } = await import('@/stores/auth')
    useAuthStore() // setup store memasang jembatan
  } catch {
    // biarkan kosong: galat asli tetap dilempar ke pemanggil
  }
  return bridge
}

http.interceptors.request.use((cfg) => {
  const token = bridge?.getToken()
  if (token && !cfg.headers.Authorization) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

http.interceptors.response.use(
  (res) => res,
  async (err: unknown) => {
    if (axios.isCancel(err)) throw err // dibatalkan sengaja (AbortController), bukan galat
    const cfg = axios.isAxiosError(err) ? (err.config as Retriable | undefined) : undefined
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    if (status === 401 && cfg && !cfg._retried && !NO_REFRESH.some((p) => cfg.url?.includes(p))) {
      cfg._retried = true // refresh sekali lalu ulang; jangan berputar (docs/09 keputusan token)
      const b = await currentBridge()
      // 401 saat memang tidak punya token = tamu (mis. tombol favorit), bukan sesi yang habis:
      // jangan menembak /auth/refresh hanya untuk mendapat 401 kedua.
      const hadToken = !!b?.getToken()
      const token = b && hadToken ? await b.refresh() : null
      if (b && token) {
        cfg.headers.Authorization = `Bearer ${token}`
        return http(cfg)
      }
      if (hadToken) b?.onExpired()
    }
    throw toApiError(err)
  },
)

/** Semua respons sukses dibungkus `{ data }` (httpx.OK). */
export interface Envelope<T> {
  data: T
}
