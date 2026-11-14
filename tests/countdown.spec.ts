import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useCountdown } from '@/composables/useCountdown'
import { splitDuration } from '@/utils/format'

describe('splitDuration', () => {
  it('memecah hari/jam/menit/detik dan tidak negatif', () => {
    expect(splitDuration(((1 * 24 + 2) * 3600 + 3 * 60 + 4) * 1000)).toEqual({
      d: 1,
      h: 2,
      m: 3,
      s: 4,
    })
    expect(splitDuration(-5000)).toEqual({ d: 0, h: 0, m: 0, s: 0 })
  })
})

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('menghitung dari jam sebenarnya dan selesai di 0', async () => {
    const C = defineComponent({
      setup() {
        const c = useCountdown('2026-01-01T00:00:03Z')
        return () => h('p', { 'data-done': String(c.done.value) }, String(c.parts.value.s))
      },
    })
    const w = mount(C)
    expect(w.text()).toBe('3')
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.attributes('data-done')).toBe('true')
    expect(w.text()).toBe('0')
    w.unmount()
  })
})
