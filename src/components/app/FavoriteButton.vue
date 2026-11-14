<script setup lang="ts">
import { Heart } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useApiMessage } from '@/composables/useApiMessage'
import { useRequireLogin } from '@/composables/useRequireLogin'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'

const props = defineProps<{ eventId: string; title: string; variant?: 'overlay' | 'pill' }>()
const { t } = useI18n()
const fav = useFavoritesStore()
const auth = useAuthStore()
const message = useMessage()
const apiMessage = useApiMessage()
const requireLogin = useRequireLogin()
const busy = ref(false)

const on = computed(() => fav.has(props.eventId))
// Akun masuk: tunggu daftar favorit termuat agar klik pertama tidak menjadikan status salah arah.
const ready = computed(() => !auth.isAuthed || fav.loaded)

async function click(e: Event): Promise<void> {
  e.preventDefault()
  e.stopPropagation() // tombol berada di atas kartu yang bisa diklik
  if (busy.value) return
  if (!(await requireLogin('favorites.needLogin'))) return
  busy.value = true
  try {
    const now = await fav.toggle(props.eventId)
    message.success(t(now ? 'favorites.added' : 'favorites.removed', { title: props.title }))
  } catch (err) {
    message.error(apiMessage(err))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    type="button"
    class="fav"
    :class="[`fav--${variant ?? 'overlay'}`, { 'is-on': on }]"
    :aria-pressed="on"
    :aria-label="t(on ? 'favorites.remove' : 'favorites.add', { title })"
    :disabled="busy || !ready"
    data-test="fav"
    @click="click"
  >
    <NIcon :component="Heart" :size="20" aria-hidden="true" />
    <span v-if="variant === 'pill'" class="fav__label">{{
      t(on ? 'favorites.saved' : 'favorites.save')
    }}</span>
  </button>
</template>

<style scoped>
.fav {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 44px;
  min-height: 44px;
  /* Warna ikut nada sekitarnya: krem di atas panel gelap, tinta gelap di atas panel terang.
     Sebelumnya nilai tetap (kaca hitam + ikon putih), jadi di mode terang ikonnya selalu putih. */
  border: 1px solid color-mix(in srgb, var(--a-ink) 24%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-panel) 80%, transparent);
  backdrop-filter: blur(8px);
  color: var(--a-ink);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition:
    transform 0.18s,
    background 0.18s,
    color 0.18s;
}
.fav--pill {
  padding: 0 18px;
}
.fav:hover {
  background: color-mix(in srgb, var(--a-panel) 94%, transparent);
  color: var(--a-gold);
}
.fav.is-on {
  color: var(--a-danger);
  border-color: var(--a-danger);
}
.fav.is-on :deep(svg path) {
  fill: currentColor; /* hati terisi saat tersimpan */
}
.fav:active {
  transform: scale(0.92);
}
.fav:disabled {
  opacity: 0.7;
}
</style>
