import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { follow, listFollows, unfollow, type Follow } from '@/api/artists'
import { useAuthStore } from '@/stores/auth'

/** Artis/venue/kota/genre yang diikuti akun. Optimistis seperti favorit; galat dilempar ke pemanggil. */
export const useFollowsStore = defineStore('follows', () => {
  const auth = useAuthStore()
  const keys = ref<Set<string>>(new Set())
  const loaded = ref(false)
  const k = (kind: string, target: string) => `${kind}:${target}`
  const count = computed(() => keys.value.size)
  const has = (kind: Follow['kind'], target: string) => keys.value.has(k(kind, target))

  async function load(): Promise<void> {
    const list = await listFollows()
    keys.value = new Set(list.map((f) => k(f.kind, f.target)))
    loaded.value = true
  }
  async function toggle(kind: Follow['kind'], target: string, altId?: string): Promise<boolean> {
    const was = has(kind, target) || (!!altId && has(kind, altId))
    const next = new Set(keys.value)
    for (const t of [target, altId]) {
      if (!t) continue
      if (was) next.delete(k(kind, t))
      else next.add(k(kind, t))
    }
    keys.value = next
    try {
      if (was) await unfollow(kind, target)
      else await follow(kind, target)
      return !was
    } catch (e) {
      await load().catch(() => undefined)
      throw e
    }
  }
  watch(
    () => auth.isAuthed,
    (ok) => {
      if (ok) void load().catch((e) => console.error('[follows] gagal memuat', e))
      else {
        keys.value = new Set()
        loaded.value = false
      }
    },
    { immediate: true },
  )
  return { loaded, count, has, load, toggle }
})
