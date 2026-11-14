import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

/**
 * Gerbang aksi yang butuh akun (favorit, ingatkan, waitlist). Bila belum masuk: arahkan ke /masuk dengan
 * `?next=` halaman sekarang supaya pengguna kembali ke tempat semula (docs/09). Mengembalikan true bila boleh lanjut.
 */
export function useRequireLogin() {
  const auth = useAuthStore()
  const router = useRouter()
  const route = useRoute()
  const message = useMessage()
  const { t } = useI18n()

  return async function requireLogin(reasonKey = 'auth.needLogin'): Promise<boolean> {
    if (!auth.ready) await auth.restore()
    if (auth.isAuthed) return true
    message.info(t(reasonKey))
    await router.push({ name: 'login', query: { next: route.fullPath } })
    return false
  }
}
