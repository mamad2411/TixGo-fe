import axios from 'axios'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'

import { suggest, type Suggestions } from '@/api/suggest'

export interface SuggestItem {
  id: string
  kind: 'event' | 'artist' | 'venue' | 'city' | 'genre' | 'query' | 'recent'
  label: string
  sub?: string
  img?: string
  to: RouteLocationRaw
}

const RECENT_KEY = 'tixgo.recent-search.v1'
const readRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}
const recent = ref<string[]>(readRecent())
export function rememberSearch(term: string): void {
  const t = term.trim()
  if (t.length < 2) return
  recent.value = [t, ...recent.value.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value))
  } catch {
    /* mode privat: riwayat hanya untuk sesi ini */
  }
}
export function clearRecent(): void {
  recent.value = []
  try {
    localStorage.removeItem(RECENT_KEY)
  } catch {
    /* abaikan */
  }
}

/** Saran pencarian bertipe (konser, artis, venue, kota, genre) + riwayat. Dipasang ke input mana pun. */
export function useSearchSuggest(
  uid: string,
  labels: { inEvents: (q: string) => string; date: (e: Suggestions['events'][number]) => string },
) {
  const router = useRouter()
  const term = ref('')
  const open = ref(false)
  const active = ref(-1)
  const loading = ref(false)
  const failed = ref(false)
  const data = ref<Suggestions | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let ctl: AbortController | null = null

  const listId = `sg-${uid}`
  const optId = (i: number) => `${listId}-${i}`

  const items = computed<SuggestItem[]>(() => {
    const q = term.value.trim()
    if (q.length < 2) {
      return recent.value.map((r) => ({
        id: `r:${r}`,
        kind: 'recent' as const,
        label: r,
        to: { name: 'events', query: { q: r } },
      }))
    }
    const d = data.value
    const out: SuggestItem[] = []
    if (d) {
      for (const e of d.events)
        out.push({
          id: `e:${e.id}`,
          kind: 'event',
          label: e.title,
          sub: labels.date(e),
          img: e.poster_url,
          to: { name: 'event', params: { slug: e.slug } },
        })
      for (const a of d.artists)
        out.push({
          id: `a:${a.id}`,
          kind: 'artist',
          label: a.name,
          img: a.image_url,
          to: { name: 'artist', params: { slug: a.slug } },
        })
      for (const v of d.venues)
        out.push({
          id: `v:${v.id}`,
          kind: 'venue',
          label: v.name,
          sub: v.city,
          img: v.image_url,
          to: { name: 'venue', params: { id: v.id } },
        })
      for (const c of d.cities)
        out.push({
          id: `c:${c}`,
          kind: 'city',
          label: c,
          to: { name: 'events', query: { city: c } },
        })
      for (const g of d.genres)
        out.push({
          id: `g:${g}`,
          kind: 'genre',
          label: g,
          to: { name: 'events', query: { genre: g } },
        })
    }
    out.push({
      id: `q:${q}`,
      kind: 'query',
      label: labels.inEvents(q),
      to: { name: 'events', query: { q } },
    })
    return out
  })

  function schedule(): void {
    clearTimeout(timer)
    const q = term.value.trim()
    if (q.length < 2) {
      ctl?.abort()
      loading.value = false
      data.value = null
      return
    }
    loading.value = true
    timer = setTimeout(async () => {
      ctl?.abort()
      ctl = new AbortController()
      try {
        data.value = await suggest(q, ctl.signal)
        failed.value = false
      } catch (e) {
        if (axios.isCancel(e)) return
        failed.value = true // saran gagal: pencarian biasa (Enter) tetap jalan
        data.value = null
      } finally {
        loading.value = false
      }
    }, 200)
  }
  watch(term, () => {
    active.value = -1
    schedule()
  })
  onBeforeUnmount(() => {
    clearTimeout(timer)
    ctl?.abort()
  })

  function pick(it: SuggestItem): void {
    if (it.kind === 'query' || it.kind === 'recent')
      rememberSearch(it.kind === 'query' ? term.value : it.label)
    open.value = false
    active.value = -1
    void router.push(it.to)
  }
  /** Mengembalikan true bila tombol sudah ditangani (cegah submit form saat ada pilihan aktif). */
  function onKey(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      if (open.value) {
        open.value = false
        e.preventDefault()
      }
      return true
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open.value) open.value = true
      const n = items.value.length
      if (!n) return true
      active.value = e.key === 'ArrowDown' ? (active.value + 1) % n : (active.value - 1 + n) % n
      e.preventDefault()
      return true
    }
    if (e.key === 'Enter' && open.value && active.value >= 0) {
      const it = items.value[active.value]
      if (it) {
        e.preventDefault()
        pick(it)
        return true
      }
    }
    return false
  }
  const setActive = (i: number): void => {
    active.value = i
  }
  return {
    term,
    open,
    active,
    loading,
    failed,
    items,
    recent,
    listId,
    optId,
    pick,
    onKey,
    setActive,
  }
}
export type SearchSuggest = ReturnType<typeof useSearchSuggest>
