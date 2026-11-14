import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { addFavorite, listFavorites, removeFavorite } from '@/api/events'
import { useAuthStore } from '@/stores/auth'

/** Favorit milik akun. Optimistis: UI berubah dulu, dikembalikan bila server menolak (galat dilempar ke pemanggil). */
export const useFavoritesStore = defineStore('favorites', () => {
  const auth = useAuthStore()
  const ids = ref<Set<string>>(new Set())
  const loaded = ref(false)

  const has = (eventId: string) => ids.value.has(eventId)
  const count = computed(() => ids.value.size)

  async function load(): Promise<void> {
    const list = await listFavorites()
    ids.value = new Set(list.map((e) => e.id))
    loaded.value = true
  }

  async function toggle(eventId: string): Promise<boolean> {
    const was = ids.value.has(eventId)
    const next = new Set(ids.value)
    if (was) next.delete(eventId)
    else next.add(eventId)
    ids.value = next
    try {
      if (was) await removeFavorite(eventId)
      else await addFavorite(eventId)
      return !was
    } catch (e) {
      const back = new Set(ids.value)
      if (was) back.add(eventId)
      else back.delete(eventId)
      ids.value = back
      throw e
    }
  }

  // Muat saat masuk, kosongkan saat keluar.
  watch(
    () => auth.isAuthed,
    (ok) => {
      if (ok) void load().catch((e) => console.error('[favorites] gagal memuat', e))
      else {
        ids.value = new Set()
        loaded.value = false
      }
    },
    { immediate: true },
  )

  return { ids, loaded, count, has, load, toggle }
})
