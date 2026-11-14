import '@fontsource-variable/inter'
import '@fontsource/anton'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import '@/styles/tokens.css'
import '@/styles/motion.css'

import { createHead } from '@unhead/vue/client'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { i18n } from './i18n'
import { router } from './router'

// Head manager: title/meta per halaman di sisi klien. Meta untuk crawler/pratinjau tautan disuntik
// server (keputusan Q11, docs/19 §3); keduanya HARUS identik (tanpa cloaking).
const head = createHead({ init: [{ htmlAttrs: { lang: 'id' }, titleTemplate: '%s — TixGo' }] })

// Setiap halaman selalu dibuka dari section paling atas: matikan pemulihan scroll bawaan browser
// sebelum render pertama (perilaku halaman lain diatur router.scrollBehavior).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)

createApp(App).use(createPinia()).use(router).use(i18n).use(head).mount('#app')
