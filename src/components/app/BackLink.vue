<script setup lang="ts">
import { ArrowLeft } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRouter, type RouteLocationRaw } from 'vue-router'

// Kembali ke halaman sebelumnya di riwayat aplikasi; bila pengguna mendarat langsung dari tautan luar,
// jatuh ke `fallback` (tidak pernah keluar dari aplikasi).
const props = withDefaults(
  defineProps<{ fallback?: RouteLocationRaw; label?: string; plain?: boolean }>(),
  {
    plain: false,
    fallback: () => ({ name: 'events' }),
    label: '',
  },
)
const { t } = useI18n()
const router = useRouter()

function back(): void {
  const hasPrev = typeof window.history.state?.back === 'string'
  if (hasPrev) router.back()
  else void router.push(props.fallback)
}
</script>

<template>
  <button type="button" class="bk" :class="{ 'bk--plain': plain }" data-test="back" @click="back">
    <NIcon :component="ArrowLeft" :size="18" aria-hidden="true" />
    {{ label || t('common.back') }}
  </button>
</template>

<style scoped>
.bk {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 18px 0 12px;
  border: 1px solid rgb(255 255 255 / 0.28);
  border-radius: 999px;
  background: rgb(12 10 9 / 0.55);
  backdrop-filter: blur(8px);
  color: var(--a-cream);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.12s,
    color 0.18s,
    background 0.18s,
    border-color 0.18s;
}
.bk :deep(svg) {
  transition: transform 0.18s;
}
.bk:hover {
  color: var(--a-gold);
  background: rgb(12 10 9 / 0.8);
}
.bk:hover :deep(svg) {
  transform: translateX(-3px);
}
.bk:active {
  transform: scale(0.97);
}
.bk:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 3px;
}
.bk--plain {
  border-color: var(--a-line);
  background: var(--a-panel);
  backdrop-filter: none;
  color: var(--a-ink);
}
.bk--plain:hover {
  background: var(--a-bg3);
  border-color: var(--a-line-strong);
  color: var(--a-gold);
}
@media (prefers-reduced-motion: reduce) {
  .bk,
  .bk :deep(svg) {
    transition: none;
  }
  .bk:hover :deep(svg),
  .bk:active {
    transform: none;
  }
}
</style>
