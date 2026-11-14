import blueFlare from '@/assets/photos/blue-flare-1200.webp'
import discoBall from '@/assets/photos/disco-ball-1200.webp'
import handsRed from '@/assets/photos/hands-red-bg-1200.webp'
import handsSilhouette from '@/assets/photos/hands-silhouette-bg-1200.webp'
import phoneLight from '@/assets/photos/phone-light-bg-1200.webp'

// Sampul cadangan untuk acara tanpa poster: foto konser nyata (CC0, Wikimedia Commons;
// kredit di assets/photos/CREDITS.md), dipilih stabil dari slug agar tiap acara selalu sama.
const POOL = [blueFlare, handsRed, phoneLight, handsSilhouette, discoBall]

export function fallbackCover(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return POOL[h % POOL.length]!
}
