import { http, type Envelope } from './client'
import type { EventCard } from './events'

export interface Artist {
  id: string
  slug: string
  name: string
  bio: string
  image_url?: string
  socials: Record<string, string>
}
export interface ArtistDetail {
  artist: Artist
  events: EventCard[]
}
export interface Follow {
  kind: 'artist' | 'venue' | 'city' | 'genre'
  target: string
}
export async function listArtists(): Promise<Artist[]> {
  const r = await http.get<Envelope<Artist[]>>('/artists')
  return r.data.data
}
export async function getArtist(slug: string): Promise<ArtistDetail> {
  const r = await http.get<Envelope<ArtistDetail>>(`/artists/${encodeURIComponent(slug)}`)
  return r.data.data
}
export async function listFollows(): Promise<Follow[]> {
  const r = await http.get<Envelope<Follow[]>>('/me/follows')
  return r.data.data
}
export async function follow(kind: Follow['kind'], target: string): Promise<void> {
  await http.post('/me/follows', { kind, target })
}
export async function unfollow(kind: Follow['kind'], target: string): Promise<void> {
  await http.delete(`/me/follows/${kind}/${encodeURIComponent(target)}`)
}
