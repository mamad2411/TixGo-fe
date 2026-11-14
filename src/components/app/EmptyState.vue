<script setup lang="ts">
import type { Component } from 'vue'
import { NIcon } from 'naive-ui'

defineProps<{ icon?: Component; title: string; body?: string }>()
</script>

<template>
  <div class="a-state" data-state="empty">
    <NIcon v-if="icon" :component="icon" :size="40" aria-hidden="true" class="a-state__icon" />
    <h2 class="a-serif a-state__title">{{ title }}</h2>
    <p v-if="body" class="a-muted">{{ body }}</p>
    <div class="a-state__actions"><slot /></div>
  </div>
</template>

<style scoped>
.a-state {
  display: grid;
  justify-items: center;
  gap: 10px;
  text-align: center;
  padding: 56px 16px;
  border: 1px dashed var(--a-line-strong);
  border-radius: 18px;
}
.a-state__icon {
  color: var(--a-gold);
}
.a-state__title {
  font-size: 30px;
  color: var(--a-cream);
}
.a-state__actions:empty {
  display: none;
}
.a-state__actions {
  margin-top: 8px;
}
</style>
