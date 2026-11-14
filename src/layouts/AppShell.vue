<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute } from 'vue-router'

import AppFooter from '@/components/app/AppFooter.vue'
import AppHeader from '@/components/app/AppHeader.vue'
import CookieBanner from '@/components/app/CookieBanner.vue'
import ConcertBackdrop from '@/components/app/ConcertBackdrop.vue'
import SessionGuard from '@/components/app/SessionGuard.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import AppTheme from '@/components/app/AppTheme.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
usePageTitle()
const route = useRoute()
// Katalog mengatur nada bagiannya sendiri; detail & checkout terang penuh di mode terang.
const lightMain = computed(() => route.name === 'event' || route.name === 'checkout')

// Halaman publik tidak menunggu sesi (guard), jadi pulihkan di latar agar header tahu status masuk.
onMounted(() => {
  if (!auth.ready) void auth.restore()
})
</script>

<template>
  <AppTheme>
    <a class="a-skip" href="#konten">{{ t('common.skip') }}</a>
    <SessionGuard />
    <AppHeader />
    <component
      :is="lightMain ? ToneLight : 'main'"
      id="konten"
      :tag="lightMain ? 'main' : undefined"
      tabindex="-1"
      :class="{ 'has-decor': lightMain }"
    >
      <ConcertBackdrop v-if="lightMain" behind />
      <!-- Header/footer tetap diam; hanya isi halaman yang bertransisi. -->
      <RouterView v-slot="{ Component, route: r }">
        <Transition name="page">
          <component :is="Component" :key="r.meta.group ?? r.path" />
        </Transition>
      </RouterView>
    </component>
    <AppFooter />
    <CookieBanner />
  </AppTheme>
</template>
