import { describe, expect, it } from 'vitest'

import { classify, seatGuide } from '@/utils/guide'
import type { SeatVM } from '@/utils/venue'

const base = {
  tierId: 't1',
  tierName: 'CAT 1',
  price: 100000,
  color: '#fff',
  row: 'A',
  no: '1',
  label: 'A1',
  rot: 0,
  accessible: false,
}
const seat = (id: string, section: string, x: number, y: number, state = 'available'): SeatVM =>
  ({ ...base, id, sectionId: section, sectionName: `Seksi ${section}`, x, y, state }) as SeatVM

describe('classify', () => {
  const raw = (id: string, cx: number, cy: number) => ({
    id,
    tierId: id,
    name: id,
    tierName: id,
    color: '#000',
    price: 1,
    free: 1,
    total: 1,
    cx,
    cy,
  })

  it('membedakan depan/tengah/belakang dari jarak ke panggung', () => {
    const r = classify([raw('a', 0, 100), raw('b', 0, 250), raw('c', 0, 400)], { x: 0, y: 0 })
    expect(r.map((i) => i.depth)).toEqual(['front', 'mid', 'back'])
  })

  it('membedakan kiri/tengah/kanan dari sisi penonton', () => {
    const r = classify([raw('l', -200, 200), raw('m', 5, 200), raw('r', 200, 200)], { x: 0, y: 0 })
    expect(r.map((i) => i.side)).toEqual(['left', 'center', 'right'])
  })

  it('satu zona saja = tengah, bukan error', () => {
    const [only] = classify([raw('x', 0, 120)], { x: 0, y: 0 })
    expect(only).toMatchObject({ depth: 'mid', side: 'center' })
  })
})

describe('seatGuide', () => {
  it('satu item per seksi, urut dari terdekat panggung, hitung sisa kursi', () => {
    const items = seatGuide([
      seat('1', 'far', 0, 400),
      seat('2', 'near', -100, 100),
      seat('3', 'near', -100, 110, 'sold'),
    ])
    expect(items.map((i) => i.id)).toEqual(['near', 'far'])
    expect(items[0]).toMatchObject({ total: 2, free: 1, depth: 'front', side: 'left' })
    expect(items[0]!.dots).toBe('M-100 100h0M-100 110h0')
  })
})
