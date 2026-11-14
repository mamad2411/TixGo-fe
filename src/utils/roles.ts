/** Peran yang boleh membuka area organizer (BE tetap memeriksa ulang di setiap permintaan). */
export const ORGANIZER_ROLES = ['organizer', 'organizer_member', 'admin'] as const
export const isOrganizer = (role?: string): boolean =>
  !!role && (ORGANIZER_ROLES as readonly string[]).includes(role)

/** Staf internal: boleh membuka panel admin (menu yang tampil ditentukan per peran; BE tetap memeriksa tiap permintaan). */
export const STAFF_ROLES = ['admin', 'finance', 'support', 'editor'] as const
export const isStaff = (role?: string): boolean =>
  !!role && (STAFF_ROLES as readonly string[]).includes(role)

/** Tujuan bawaan setelah masuk (bila tidak ada `?next=`): staf ke panel admin, organizer ke dashboard, lainnya ke katalog. */
export function homeFor(role?: string): string {
  if (isStaff(role)) return '/admin'
  if (role === 'organizer' || role === 'organizer_member') return '/organizer'
  return '/events'
}
