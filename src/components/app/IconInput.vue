<script setup lang="ts">
import { NIcon, NInput } from 'naive-ui'
import type { Component } from 'vue'

// NInput dengan ikon awalan; atribut lain (status, input-props, @blur, ...) diteruskan ke NInput.
defineProps<{ icon: Component }>()
const value = defineModel<string>('value', { required: true })
</script>

<template>
  <NInput v-model:value="value" placeholder="" size="large">
    <template #prefix
      ><NIcon :component="icon" :size="18" class="ii" aria-hidden="true"
    /></template>
  </NInput>
</template>

<style scoped>
.ii {
  color: var(--a-gold);
  margin-right: 4px;
}
</style>
