import { useHead } from '@unhead/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

/** Judul tab dari `route.meta.title` (kunci i18n). Template " — TixGo" ada di main.ts. */
export function usePageTitle(): void {
  const route = useRoute()
  const { t } = useI18n()
  useHead({ title: computed(() => (route.meta.title ? t(route.meta.title) : '')) })
}
