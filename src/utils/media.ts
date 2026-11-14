// BE menyajikan gambar sebagai /api/v1/media/:id/:w.jpg dengan varian 400/800/1600 (imgproc.Widths).
const RE = /\/(400|800|1600)\.jpg$/

export const MEDIA_WIDTHS = [400, 800, 1600] as const

/** Varian lebar tertentu dari URL media BE; URL asing dikembalikan apa adanya. */
export function mediaAt(url: string | undefined, w: 400 | 800 | 1600): string | undefined {
  if (!url) return undefined
  return RE.test(url) ? url.replace(RE, `/${w}.jpg`) : url
}

/** srcset untuk <img>; kosong bila bukan URL media BE. */
export function mediaSrcset(url: string | undefined): string | undefined {
  if (!url || !RE.test(url)) return undefined
  return MEDIA_WIDTHS.map((w) => `${mediaAt(url, w)} ${w}w`).join(', ')
}
