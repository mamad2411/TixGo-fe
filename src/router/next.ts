/**
 * Tujuan setelah masuk (`?next=`). Hanya jalur internal: diawali satu "/" dan bukan "//" atau "/\"
 * (cegah open redirect). Selain itu jatuh ke `fallback`.
 */
export function safeNext(raw: unknown, fallback = '/events'): string {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string' || v === '') return fallback
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return fallback
  for (const ch of v) if (ch.charCodeAt(0) < 0x20) return fallback // karakter kontrol (CR/LF, dsb.)
  return v
}
