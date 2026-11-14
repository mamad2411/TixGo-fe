// Warna kategori tiket di denah/legenda: dibedakan oleh warna DAN label/pola (bukan warna saja, WCAG 1.4.1).
export const TIER_COLORS = [
  '#d9b979',
  '#e0705a',
  '#6fb3d9',
  '#8fcf9b',
  '#b794e0',
  '#e6c85a',
] as const
export const tierColor = (i: number): string => TIER_COLORS[i % TIER_COLORS.length]!
