<script setup lang="ts">
import { Moon, Sun } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'

import { mode, toggleMode } from '@/composables/useThemeMode'

const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="mt"
    :aria-label="mode === 'dark' ? t('nav.modeToLight') : t('nav.modeToDark')"
    :title="mode === 'dark' ? t('nav.modeToLight') : t('nav.modeToDark')"
    data-test="mode-toggle"
    @click="toggleMode"
  >
    <NIcon :component="mode === 'dark' ? Sun : Moon" :size="19" aria-hidden="true" />
  </button>
</template>

<style scoped>
.mt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--a-line-strong);
  border-radius: 50%;
  background: transparent;
  color: var(--a-gold);
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}
.mt:hover {
  background: var(--a-gold);
  color: var(--a-on-gold);
}
</style>
