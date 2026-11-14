// Validator form sekecil mungkin. Hanya lima form auth yang butuh validasi klien, dan aturannya
// cermin BE (FRD M1-F1). Sebelumnya memakai zod: 122 kB mentah demi enam skema sederhana.
// Kontraknya sengaja mirip `safeParse` supaya pemanggil tidak peduli pustakanya.

export type Issue = { path: (string | number)[]; message: string }

export type Result = { success: true } | { success: false; error: { issues: Issue[] } }

export type Schema = { safeParse: (value: unknown) => Result }

/** Kunci pesan i18n bila isian tidak valid, atau null bila lolos. */
export type Rule = (value: unknown) => string | null

const fail = (issues: Issue[]): Result => ({ success: false, error: { issues } })

/** Skema satu isian (mis. kata sandi baru). */
export function field(rule: Rule): Schema {
  return {
    safeParse(value) {
      const message = rule(value)
      return message ? fail([{ path: [], message }]) : { success: true }
    },
  }
}

/** Skema objek: semua isian diperiksa, satu pesan per isian, urut seperti dideklarasikan. */
export function shape(rules: Record<string, Rule>): Schema {
  return {
    safeParse(value) {
      const src = (value ?? {}) as Record<string, unknown>
      const issues: Issue[] = []
      for (const [name, rule] of Object.entries(rules)) {
        const message = rule(src[name])
        if (message) issues.push({ path: [name], message })
      }
      return issues.length ? fail(issues) : { success: true }
    },
  }
}
