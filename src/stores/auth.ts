import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import * as authApi from '@/api/auth'
import type { LoginInput, RegisterInput, Session, UserView } from '@/api/auth'
import { bindAuth } from '@/api/client'
import { toApiError } from '@/api/errors'

// Access token HANYA di memori (AGENTS.md FE). Refresh token = cookie httpOnly yang diurus BE/browser.
export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserView | null>(null)
  const accessToken = ref<string | null>(null)
  const expiresAt = ref<number>(0)
  /** true setelah pemulihan sesi awal selesai (berhasil atau tidak). */
  const ready = ref(false)
  /** true bila sesi terputus di tengah jalan (refresh ditolak). SessionGuard yang mengalihkan ke /masuk. */
  const sessionLost = ref(false)

  // Petunjuk sesi di perangkat ini. Cookie refresh bersifat HttpOnly sehingga JS tidak bisa tahu
  // apakah masih ada; tanpa petunjuk, setiap kunjungan tamu menembak /auth/refresh dan mendapat 401
  // yang tampil di konsol. Petunjuk ini bukan bukti login — hanya penentu perlu-tidaknya mencoba.
  const HINT = 'tixgo.sess'
  const hasHint = (): boolean => {
    try {
      return localStorage.getItem(HINT) === '1'
    } catch {
      return true // penyimpanan diblokir: anggap ada, biar sesi tetap bisa pulih
    }
  }
  const setHint = (on: boolean): void => {
    try {
      if (on) localStorage.setItem(HINT, '1')
      else localStorage.removeItem(HINT)
    } catch {
      // mode privat / penyimpanan penuh: abaikan, sesi tetap jalan selama tab hidup
    }
  }

  const isAuthed = computed(() => !!user.value && !!accessToken.value)
  const emailVerified = computed(() => !!user.value?.email_verified)
  const phoneVerified = computed(() => !!user.value?.phone_verified)
  /** Syarat antre/hold/checkout (FRD M5-F1, M1-F1). */
  const isVerified = computed(() => emailVerified.value && phoneVerified.value)

  let timer: ReturnType<typeof setTimeout> | undefined
  let inflightRefresh: Promise<string | null> | null = null
  let inflightRestore: Promise<void> | null = null

  function clear(): void {
    user.value = null
    accessToken.value = null
    expiresAt.value = 0
    setHint(false)
    if (timer) clearTimeout(timer)
    timer = undefined
  }

  function apply(s: Session): void {
    user.value = s.user
    accessToken.value = s.access_token
    expiresAt.value = Date.parse(s.expires_at)
    sessionLost.value = false
    setHint(true)
    schedule()
  }

  // Perbarui token sedikit sebelum kedaluwarsa agar WS/permintaan berikutnya tidak 401 dulu.
  function schedule(): void {
    if (timer) clearTimeout(timer)
    const wait = Math.max(expiresAt.value - Date.now() - 60_000, 5_000)
    timer = setTimeout(() => {
      void refresh()
    }, wait)
  }

  /** Single-flight: banyak 401 serentak hanya memicu satu /auth/refresh (rotasi refresh token). */
  function refresh(): Promise<string | null> {
    inflightRefresh ??= (async () => {
      try {
        const s = await authApi.refresh()
        apply(s)
        return s.access_token
      } catch (e) {
        const err = toApiError(e)
        if (err.status !== 401 && err.status !== 403) {
          console.error('[auth] refresh gagal', err.code, err.message)
        }
        clear()
        return null
      } finally {
        inflightRefresh = null
      }
    })()
    return inflightRefresh
  }

  /** Pulihkan sesi dari cookie refresh. Tidak melempar: tanpa sesi = tamu. */
  function restore(): Promise<void> {
    inflightRestore ??= (hasHint() ? refresh() : Promise.resolve(null)).then(() => {
      ready.value = true
    })
    return inflightRestore
  }

  async function login(input: LoginInput): Promise<void> {
    apply(await authApi.login(input))
    ready.value = true
  }

  async function register(input: RegisterInput): Promise<void> {
    apply(await authApi.register(input))
    ready.value = true
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } catch (e) {
      // Sesi lokal tetap dibersihkan, tetapi kegagalan tidak disembunyikan.
      console.error('[auth] logout di server gagal', toApiError(e).code)
    } finally {
      clear()
    }
  }

  /** Muat ulang profil (mis. setelah verifikasi email/HP). */
  async function reloadMe(): Promise<void> {
    user.value = await authApi.me()
  }

  /** Dipanggil SessionGuard setelah pengalihan ke halaman masuk, supaya tidak memicu ulang. */
  function ackSessionLost(): void {
    sessionLost.value = false
  }

  // Jembatan untuk interceptor axios.
  bindAuth({
    getToken: () => accessToken.value,
    refresh,
    onExpired: () => {
      clear()
      sessionLost.value = true
    },
  })

  return {
    user,
    ready,
    sessionLost,
    isAuthed,
    emailVerified,
    phoneVerified,
    isVerified,
    restore,
    refresh,
    login,
    register,
    logout,
    reloadMe,
    ackSessionLost,
  }
})
