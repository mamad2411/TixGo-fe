import { ref } from 'vue'

import type { Schema } from '@/utils/schema'

/**
 * Validasi form dengan skema kecil di `@/utils/schema`. Pesan isu = KUNCI i18n (mis. `validation.email`);
 * komponen menerjemahkannya. Aturan klien hanya kemudahan — BE tetap memvalidasi ulang.
 */
export function useFormValidation(schema: Schema, form: object) {
  const errors = ref<Record<string, string>>({})

  function run(): { ok: boolean; all: Record<string, string> } {
    const r = schema.safeParse(form)
    const all: Record<string, string> = {}
    if (!r.success) {
      for (const issue of r.error.issues) {
        const key = String(issue.path[0] ?? '_')
        all[key] ??= issue.message
      }
    }
    return { ok: r.success, all }
  }

  /** Validasi semua isian (saat kirim). */
  function validate(): boolean {
    const { ok, all } = run()
    errors.value = all
    return ok
  }

  /** Validasi satu isian (saat blur) tanpa memunculkan galat isian lain yang belum disentuh. */
  function validateField(name: string): void {
    const { all } = run()
    const next = { ...errors.value }
    if (all[name]) next[name] = all[name]
    else delete next[name]
    errors.value = next
  }

  function clear(name?: string): void {
    if (!name) {
      errors.value = {}
      return
    }
    const next = { ...errors.value }
    delete next[name]
    errors.value = next
  }

  return { errors, validate, validateField, clear }
}
