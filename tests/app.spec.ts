import { createHead } from '@unhead/vue/client'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import App from '@/App.vue'
import { i18n } from '@/i18n'
import { router } from '@/router'

describe('App', () => {
  it('render beranda dengan nama aplikasi', async () => {
    router.push('/')
    await router.isReady()
    const w = mount(App, { global: { plugins: [createPinia(), router, i18n, createHead()] } })
    await new Promise((r) => setTimeout(r, 0))
    expect(w.text()).toContain('TixGo')
    expect(w.find('h1').text()).toContain('Malam yang')
    expect(w.find('main#konten').exists()).toBe(true)
  })
})
