import { defineStore } from 'pinia'
import { ref } from 'vue'

// Token admisi per event, hanya di memori (berumur pendek; status antre dari server bisa mengeluarkannya lagi).
export const useAdmissionStore = defineStore('admission', () => {
  const tokens = ref<Record<string, { token: string; expiresAt: number }>>({})
  function set(slug: string, token: string, expiresAt?: string): void {
    tokens.value = {
      ...tokens.value,
      [slug]: {
        token,
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : Date.now() + 5 * 60_000,
      },
    }
  }
  function valid(slug: string): string | undefined {
    const t = tokens.value[slug]
    return t && t.expiresAt > Date.now() + 2000 ? t.token : undefined
  }
  function clear(slug?: string): void {
    if (!slug) tokens.value = {}
    else {
      const rest = { ...tokens.value }
      delete rest[slug]
      tokens.value = rest
    }
  }
  return { tokens, set, valid, clear }
})
