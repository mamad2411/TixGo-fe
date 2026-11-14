const KEY = 'tixgo.recent-events.v1'
const MAX = 12

/** Slug konser yang terakhir dibuka (terbaru di depan). Disimpan di perangkat; kegagalan penyimpanan diabaikan. */
export function readRecentlyViewed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}
export function recordViewed(slug: string): void {
  try {
    const next = [slug, ...readRecentlyViewed().filter((s) => s !== slug)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* mode privat */
  }
}
export function clearRecentlyViewed(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* abaikan */
  }
}
