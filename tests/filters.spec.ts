import { describe, expect, it } from 'vitest'

import { activeCount, filtersFromQuery, toApiQuery, whenRange } from '@/utils/filters'
import { genreIcon, tierIcon } from '@/utils/icons'
import { mediaAt, mediaSrcset } from '@/utils/media'

describe('filtersFromQuery', () => {
  it('membuang nilai tak dikenal dan memotong teks panjang', () => {
    const f = filtersFromQuery({
      status: '<script>',
      when: 'kapan',
      price: 'gratis',
      sort: 'acak',
      q: 'x'.repeat(500),
    })
    expect([f.status, f.when, f.price, f.sort]).toEqual(['', '', '', ''])
    expect(f.q).toHaveLength(100)
  })
  it('menerima nilai sah dan menghitung filter aktif (urutan tidak dihitung)', () => {
    const f = filtersFromQuery({ city: 'Bandung', genre: 'Jazz', price: 'gt500', sort: 'popular' })
    expect(activeCount(f)).toBe(3)
  })
})

describe('whenRange (rabu 11 nov 2026)', () => {
  const wed = new Date(2026, 10, 11, 15, 0)
  it('preset hari ke depan', () => {
    expect(whenRange('7d', wed)).toEqual({ from: '2026-11-11', to: '2026-11-18' })
  })
  it('akhir pekan = Sabtu s/d Senin (eksklusif)', () => {
    expect(whenRange('weekend', wed)).toEqual({ from: '2026-11-14', to: '2026-11-16' })
  })
  it('hari Minggu: akhir pekan = hari ini saja', () => {
    expect(whenRange('weekend', new Date(2026, 10, 15))).toEqual({
      from: '2026-11-15',
      to: '2026-11-16',
    })
  })
  it('kosong -> null', () => expect(whenRange('')).toBeNull())
})

describe('toApiQuery', () => {
  it('memetakan harga ke price_min/price_max dan tanggal ke date_from/date_to', () => {
    const q = toApiQuery(
      {
        q: '',
        city: 'Jakarta',
        genre: '',
        status: 'onsale',
        when: '30d',
        price: '200-500',
        sort: 'new',
        koleksi: '',
      },
      2,
      12,
      new Date(2026, 10, 11),
    )
    expect(q).toMatchObject({
      city: 'Jakarta',
      status: 'onsale',
      sort: 'new',
      date_from: '2026-11-11',
      date_to: '2026-12-11',
      price_min: 200000,
      price_max: 500000,
      page: 2,
      per_page: 12,
    })
    expect(q.q).toBeUndefined()
  })
})

describe('koleksi (Lihat semua)', () => {
  const base = filtersFromQuery({})
  it('hanya menerima hot/soon/all, selainnya dibuang', () => {
    expect(filtersFromQuery({ koleksi: 'hot' }).koleksi).toBe('hot')
    expect(filtersFromQuery({ koleksi: 'aneh' }).koleksi).toBe('')
  })
  it('hot -> status onsale, soon -> upcoming, mengalahkan status manual', () => {
    expect(toApiQuery({ ...base, koleksi: 'hot', status: 'soldout' }, 1, 50).status).toBe('onsale')
    expect(toApiQuery({ ...base, koleksi: 'soon' }, 1, 12).status).toBe('upcoming')
    expect(toApiQuery({ ...base, koleksi: 'all', status: 'upcoming' }, 1, 12).status).toBe(
      'upcoming',
    )
  })
  it('koleksi sendiri bukan filter yang menyaring (activeCount)', () => {
    expect(activeCount({ ...base, koleksi: 'hot' })).toBe(0)
  })
})

describe('utilitas gambar & ikon', () => {
  it('mediaAt/mediaSrcset hanya mengubah URL media BE', () => {
    expect(mediaAt('/api/v1/media/ABC/800.jpg', 1600)).toBe('/api/v1/media/ABC/1600.jpg')
    expect(mediaAt('https://x.test/a.png', 400)).toBe('https://x.test/a.png')
    expect(mediaSrcset('/api/v1/media/ABC/800.jpg')).toContain('/400.jpg 400w')
    expect(mediaSrcset(undefined)).toBeUndefined()
  })
  it('ikon cadangan untuk genre/tier tak dikenal', () => {
    expect(genreIcon('Genre Aneh')).toBe(genreIcon(null))
    expect(tierIcon('VIP Standing')).not.toBe(tierIcon('Reguler'))
  })
})
