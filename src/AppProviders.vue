<script setup lang="ts">
import { NConfigProvider, NDialogProvider, NMessageProvider } from 'naive-ui'

import { themeOverrides } from '@/theme'
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides" abstract>
    <NMessageProvider>
      <NDialogProvider>
        <slot />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
