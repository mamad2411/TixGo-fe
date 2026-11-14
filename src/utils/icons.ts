import {
  Armchair,
  Bolt,
  Confetti,
  Crown,
  Headphones,
  LayoutGrid,
  Moon,
  Radio,
  Speakerphone,
  Stars,
  Ticket,
} from '@vicons/tabler'
import type { Component } from 'vue'

// Ikon konsisten (satu keluarga: @vicons/tabler, garis 2px). Genre di BE = teks bebas, jadi ada ikon cadangan.
const GENRE: Record<string, Component> = {
  rock: Bolt,
  pop: Stars,
  jazz: Moon,
  elektronik: Headphones,
  indie: Radio,
  'hip-hop': Speakerphone,
  klasik: Crown,
  festival: Confetti,
}

export function genreIcon(genre: string | null | undefined): Component {
  return (genre && GENRE[genre.toLowerCase()]) || LayoutGrid
}

/** Ikon kategori tiket dari namanya (VIP/Platinum = mahkota, bernomor/CAT/Balkon = kursi, lainnya = tiket). */
export function tierIcon(name: string): Component {
  const n = name.toLowerCase()
  if (/vip|platinum|cliffside|backstage|front of stage/.test(n)) return Crown
  if (/cat\b|cat \d|balkon|orchestra|seat|kursi/.test(n)) return Armchair
  return Ticket
}
