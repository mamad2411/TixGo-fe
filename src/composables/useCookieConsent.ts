import { ref } from 'vue'

import { putCookieConsent, type CookieConsent } from '@/api/discover'

const KEY = 'tixgo.cookie.v1'
interface Stored extends CookieConsent {
  subject: string
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}
function subjectId(): string {
  return read()?.subject ?? `a:${crypto.randomUUID()}`
}

// Status dibagi seluruh aplikasi: banner dan tautan "Pengaturan cookie" di footer.
const stored = ref<Stored | null>(read())
const open = ref(stored.value === null)

export function useCookieConsent() {
  /** Simpan ke BE dulu; hanya bila berhasil, pilihan dicatat lokal (galat dilempar ke pemanggil). */
  async function save(c: CookieConsent): Promise<void> {
    const subject = subjectId()
    await putCookieConsent(subject, c)
    const next: Stored = { ...c, subject }
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* mode privat: pilihan berlaku untuk sesi ini saja */
    }
    stored.value = next
    open.value = false
  }
  return {
    stored,
    open,
    save,
    reopen: () => {
      open.value = true
    },
    dismiss: () => {
      open.value = false
    },
  }
}
