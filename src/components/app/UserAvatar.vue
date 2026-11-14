<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { avatarUrl } from '@/api/account'

// Satu komponen untuk foto profil di seluruh app: foto bila ada, kalau tidak inisial (WCAG: nama sebagai alt).
const props = withDefaults(
  defineProps<{ name: string; avatarKey?: string | null; size?: number }>(),
  {
    avatarKey: null,
    size: 40,
  },
)
const broken = ref(false)
watch(
  () => props.avatarKey,
  () => (broken.value = false),
)
const src = computed(() => (broken.value ? null : avatarUrl(props.avatarKey)))
const initials = computed(() =>
  props.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join(''),
)
</script>

<template>
  <span
    class="ua"
    :style="{ '--ua': `${size}px` }"
    :role="src ? undefined : 'img'"
    :aria-label="src ? undefined : name"
  >
    <img v-if="src" :src="src" :alt="name" :width="size" :height="size" @error="broken = true" />
    <span v-else aria-hidden="true">{{ initials || '?' }}</span>
  </span>
</template>

<style scoped>
.ua {
  width: var(--ua);
  height: var(--ua);
  flex: none;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  overflow: hidden;
  background: var(--a-gold);
  color: var(--a-on-gold, var(--a-bg));
  font-weight: 700;
  font-size: calc(var(--ua) * 0.38);
  line-height: 1;
  letter-spacing: 0.02em;
}
.ua img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
