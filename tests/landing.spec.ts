import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import LandingDetails from '@/components/landing/LandingDetails.vue'
import LandingPage from '@/pages/LandingPage.vue'
import { i18n } from '@/i18n'
import { createHead } from '@unhead/vue/client'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/events', name: 'events', component: { template: '<div />' } },
    { path: '/events/:slug', name: 'event', component: { template: '<div />' } },
  ],
})

const mountPage = () => mount(LandingPage, { global: { plugins: [i18n, router, createHead()] } })

describe('LandingPage', () => {
  it('memuat landmark, satu h1, dan anchor navigasi yang tujuannya ada', () => {
    const w = mountPage()
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.find('header nav').exists()).toBe(true)
    expect(w.find('main#konten').exists()).toBe(true)
    expect(w.find('footer').exists()).toBe(true)
    const targets = w
      .findAll('a[href^="#"]')
      .map((a) => a.attributes('href')!)
      .filter((h) => h !== '#top')
    expect(targets.length).toBeGreaterThan(4)
    for (const h of new Set(targets)) expect(w.find(h).exists(), `anchor ${h}`).toBe(true)
  })

  it('tanpa matchMedia (jsdom) memakai tata letak statis, bukan sinematik', () => {
    expect(mountPage().classes()).not.toContain('is-cinematic')
  })

  it('semua gambar dekoratif beralt kosong atau aria-hidden; gambar bermakna beralt teks', () => {
    const w = mountPage()
    for (const img of w.findAll('img')) {
      const alt = img.attributes('alt')
      const hidden =
        img.attributes('aria-hidden') === 'true' || img.element.closest('[aria-hidden="true"]')
      expect(alt !== undefined, `img ${img.attributes('src')} harus punya atribut alt`).toBe(true)
      if (!hidden && alt === '')
        throw new Error(`gambar tanpa alt tidak disembunyikan: ${img.attributes('src')}`)
    }
  })
})

describe('LandingDetails (akordeon)', () => {
  it('satu panel terbuka; klik panel lain memindahkan, aria-expanded ikut', async () => {
    const w = mount(LandingDetails, { global: { plugins: [i18n] } })
    const btns = w.findAll('button.l-acc__btn')
    expect(btns).toHaveLength(5)
    expect(btns[0]!.attributes('aria-expanded')).toBe('true')
    await btns[2]!.trigger('click')
    expect(btns[0]!.attributes('aria-expanded')).toBe('false')
    expect(btns[2]!.attributes('aria-expanded')).toBe('true')
    await btns[2]!.trigger('click') // klik panel terbuka tidak menutup
    expect(btns[2]!.attributes('aria-expanded')).toBe('true')
    expect(w.find('.l-details__tag').text()).toBe('Resale')
    // foto ikut berganti: hanya satu gambar aktif yang punya alt bermakna
    const active = w
      .findAll('div.l-details__img')
      .filter((i) => i.attributes('data-active') === 'true')
    expect(active).toHaveLength(1)
    expect(active[0]!.find('img.l-details__bg').attributes('alt')).not.toBe('')
  })
})
