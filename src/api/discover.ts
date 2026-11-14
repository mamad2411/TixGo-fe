import { http, type Envelope } from './client'
import type { EventCard, Page, VenueView } from './events'

// Bentuk mengikuti BE: service.CalendarDay, service.Recommendation, service.CookieConsent.
export interface CalendarDay {
  date: string
  events: EventCard[]
}
export interface Recommendation {
  event: EventCard
  reasons: string[]
  score: number
}
export interface CookieConsent {
  analytics: boolean
  marketing: boolean
}

export interface Filters {
  cities: string[]
  genres: string[]
}
export async function getFilters(): Promise<Filters> {
  const r = await http.get<Envelope<Filters>>('/meta/filters')
  return r.data.data
}
export async function getCalendar(month: string, signal?: AbortSignal): Promise<CalendarDay[]> {
  const r = await http.get<Envelope<CalendarDay[]>>('/calendar', { params: { month }, signal })
  return r.data.data
}
export async function listVenues(
  params: { q?: string; city?: string; page?: number; per_page?: number },
  signal?: AbortSignal,
): Promise<Page<VenueView>> {
  const r = await http.get<Page<VenueView>>('/venues', { params, signal })
  return r.data
}
export async function getVenue(id: string): Promise<VenueView> {
  const r = await http.get<Envelope<VenueView>>(`/venues/${encodeURIComponent(id)}`)
  return r.data.data
}
export async function getRecommendations(): Promise<Recommendation[]> {
  const r = await http.get<Envelope<Recommendation[]>>('/me/recommendations')
  return r.data.data
}
/** Subjek anonim dikenali lewat header X-Cookie-Subject (BE); akun masuk memakai id akun. */
export async function putCookieConsent(subject: string, c: CookieConsent): Promise<CookieConsent> {
  const r = await http.put<Envelope<CookieConsent>>('/cookie-consent', c, {
    headers: { 'X-Cookie-Subject': subject },
  })
  return r.data.data
}
