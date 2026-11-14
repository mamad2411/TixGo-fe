import { listArtists, type Artist } from './artists'
import { getFilters, listVenues, type Filters } from './discover'
import { listEvents, type EventCard, type VenueView } from './events'

export interface Suggestions {
  events: EventCard[]
  artists: Artist[]
  venues: VenueView[]
  cities: string[]
  genres: string[]
}

// Daftar artis dan facet kota/genre kecil dan jarang berubah: dimuat sekali lalu disaring di klien.
// Konser dan venue dicari di server karena jumlahnya bisa besar. Kegagalan tidak disimpan.
let artistsP: Promise<Artist[]> | null = null
let facetsP: Promise<Filters> | null = null
const artistsOnce = (): Promise<Artist[]> =>
  (artistsP ??= listArtists().catch((e) => {
    artistsP = null
    throw e
  }))
const facetsOnce = (): Promise<Filters> =>
  (facetsP ??= getFilters().catch((e) => {
    facetsP = null
    throw e
  }))

const norm = (s: string) => s.toLocaleLowerCase('id-ID').normalize('NFD').replace(/\p{M}/gu, '')

export async function suggest(term: string, signal?: AbortSignal): Promise<Suggestions> {
  const q = term.trim()
  const n = norm(q)
  const [ev, venues, artists, facets] = await Promise.all([
    listEvents({ q, per_page: 5, sort: 'popular' }, signal),
    listVenues({ q, per_page: 4 }, signal),
    artistsOnce(),
    facetsOnce(),
  ])
  const hit = (s: string) => norm(s).includes(n)
  return {
    events: ev.data,
    venues: venues.data,
    artists: artists.filter((a) => hit(a.name)).slice(0, 4),
    cities: facets.cities.filter(hit).slice(0, 3),
    genres: facets.genres.filter(hit).slice(0, 3),
  }
}
