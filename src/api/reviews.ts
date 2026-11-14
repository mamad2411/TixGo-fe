import { http, type Envelope } from './client'

// Ulasan acara. Hanya pemegang tiket berstatus "used" yang boleh menulis (BE menolak selain itu).
// Rata-rata hanya dikirim BE bila ulasan >= 5, jadi FE tidak pernah memajang angka dari sampel kecil.
export interface Review {
  id: string
  rating: number
  body?: string
  organizer_reply?: string
  author: string
  created_at: string
}
export interface EventReviews {
  count: number
  average?: number
  reviews: Review[]
}
export async function listReviews(slug: string, page = 1, perPage = 10): Promise<EventReviews> {
  const r = await http.get<Envelope<EventReviews>>(`/events/${encodeURIComponent(slug)}/reviews`, {
    params: { page, per_page: perPage },
  })
  return r.data.data
}
export async function submitReview(
  ticketId: string,
  input: { rating: number; body?: string },
): Promise<{ status: 'published' | 'pending' }> {
  const r = await http.post<Envelope<{ status: 'published' | 'pending' }>>(
    `/tickets/${encodeURIComponent(ticketId)}/review`,
    input,
  )
  return r.data.data
}
export async function reportReview(reviewId: string, reason: string): Promise<void> {
  await http.post(`/reviews/${encodeURIComponent(reviewId)}/report`, { reason })
}
