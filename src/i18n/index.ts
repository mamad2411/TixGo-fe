import { createI18n } from 'vue-i18n'

import en from './en.json'
import id from './id.json'

export const i18n = createI18n({
  legacy: false,
  locale: import.meta.env.VITE_DEFAULT_LOCALE || 'id',
  fallbackLocale: 'id',
  messages: { id, en },
})
