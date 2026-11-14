/** Rupiah utuh tanpa pecahan: 157500 -> "Rp157.500". Angka berasal dari server, bukan dihitung di klien. */
export function formatRupiah(amount: number, locale = 'id-ID'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Tanggal acara di zona waktu venue (bukan zona perangkat). */
export function formatEventDate(iso: string, tz: string, locale = 'id-ID'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
    timeZoneName: 'short',
  }).format(new Date(iso))
}

/** Pecah selisih milidetik menjadi hari/jam/menit/detik (>= 0). */
export function splitDuration(ms: number): { d: number; h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  }
}

/** Bagian tanggal untuk blok tanggal kartu: "11" + "DES" di zona waktu venue. */
export function dateBlock(
  iso: string,
  tz: string,
  locale = 'id-ID',
): { day: string; month: string } {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: tz }).format(d)
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: tz }).format(d)
  return { day, month: month.replace('.', '') }
}

/** Jam saja ("19.00") di zona waktu venue. */
export function formatTime(iso: string, tz: string, locale = 'id-ID'): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(new Date(iso))
}

/** Tanggal panjang tanpa jam: "Rabu, 2 Desember 2026". */
export function formatLongDate(iso: string, tz: string, locale = 'id-ID'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: tz,
  }).format(new Date(iso))
}
