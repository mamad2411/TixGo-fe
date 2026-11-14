<script setup lang="ts">
import { Check } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'

// Langkah onboarding: akun -> email -> HP. `current` 1-3.
defineProps<{ current: 1 | 2 | 3 }>()
const { t } = useI18n()
const steps = ['account', 'email', 'phone'] as const
</script>

<template>
  <ol class="st" :aria-label="t('auth.steps.aria')">
    <li
      v-for="(s, i) in steps"
      :key="s"
      :class="{ done: i + 1 < current, on: i + 1 === current }"
      :aria-current="i + 1 === current ? 'step' : undefined"
    >
      <span class="st__dot">
        <NIcon v-if="i + 1 < current" :component="Check" :size="14" aria-hidden="true" />
        <template v-else>{{ i + 1 }}</template>
      </span>
      <span class="st__t">{{ t(`auth.steps.${s}`) }}</span>
    </li>
  </ol>
</template>

<style scoped>
.st {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 0 0 22px;
  padding: 0;
  list-style: none;
}
.st li {
  display: grid;
  gap: 6px;
  padding-top: 10px;
  border-top: 3px solid rgb(239 229 207 / 0.16);
  color: var(--a-muted);
  font-size: 12px;
  letter-spacing: 0.06em;
}
.st li.on {
  border-color: var(--a-gold);
  color: var(--a-gold);
}
.st li.done {
  border-color: var(--a-ok);
  color: var(--a-ok);
}
.st__dot {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid currentcolor;
  font-weight: 700;
  font-size: 12px;
}
.st li.on .st__dot {
  background: var(--a-gold);
  color: var(--a-on-gold);
}
.st li.done .st__dot {
  background: var(--a-ok);
  color: var(--a-on-gold);
  border-color: var(--a-ok);
}
.st__t {
  font-weight: 700;
  text-transform: uppercase;
}
</style>
