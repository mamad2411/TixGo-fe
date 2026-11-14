<script setup lang="ts">
import { NConfigProvider, darkTheme, lightTheme } from 'naive-ui'

import { mode } from '@/composables/useThemeMode'
import { appThemeOverrides, lightThemeOverrides } from '@/theme.app'

// Section terang di dalam shell gelap: token CSS (.tone-light) + tema Naive UI ikut berganti.
withDefaults(defineProps<{ tag?: string }>(), { tag: 'div' })
</script>

<template>
  <component :is="tag" class="tone-light">
    <NConfigProvider
      :theme="mode === 'dark' ? darkTheme : lightTheme"
      :theme-overrides="mode === 'dark' ? appThemeOverrides : lightThemeOverrides"
      abstract
    >
      <slot />
    </NConfigProvider>
  </component>
</template>
