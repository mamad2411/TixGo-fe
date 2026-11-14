<script setup lang="ts">
import '@fontsource/cormorant-garamond/300.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource-variable/manrope'
import '@/styles/app.css'

import { darkTheme, NConfigProvider, NDialogProvider, NMessageProvider } from 'naive-ui'

import { mode } from '@/composables/useThemeMode'
import { useSurface } from '@/composables/useSurface'
import { appThemeOverrides } from '@/theme.app'

useSurface('dark')
</script>

<template>
  <!-- Tema gelap landing untuk seluruh aplikasi pelanggan. Provider pesan di dalam supaya toast ikut tema.
       Root harus elemen nyata (.app) supaya layout ini bisa dianimasikan oleh <Transition> di App.vue. -->
  <div class="app" :class="{ 'is-dark': mode === 'dark' }">
    <NConfigProvider :theme="darkTheme" :theme-overrides="appThemeOverrides" abstract>
      <NMessageProvider placement="top" :duration="5000">
        <NDialogProvider>
          <slot />
        </NDialogProvider>
      </NMessageProvider>
    </NConfigProvider>
  </div>
</template>
