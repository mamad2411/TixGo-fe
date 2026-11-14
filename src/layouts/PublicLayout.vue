<script setup lang="ts">
import { RouterView } from 'vue-router'

import AppProviders from '@/AppProviders.vue'
import { useSurface } from '@/composables/useSurface'

useSurface('light')
</script>

<template>
  <div class="layout">
    <AppProviders>
      <header class="layout__bar t-display">TixGo</header>
      <main><RouterView /></main>
    </AppProviders>
  </div>
</template>

<style scoped>
.layout__bar {
  padding: 12px 16px;
  border-bottom: var(--border);
  font-size: 28px;
}
main {
  padding: 16px;
}
</style>
