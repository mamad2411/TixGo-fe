<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCountdown } from '@/composables/useCountdown'

const props = defineProps<{ to: string | Date }>()
const emit = defineEmits<{ done: [] }>()
const { t } = useI18n()
const { parts, done } = useCountdown(() => props.to)

const pad = (n: number) => String(n).padStart(2, '0')
// Pembaca layar mendapat kalimat utuh (tidak diumumkan tiap detik); angka visual disembunyikan darinya.
const spoken = computed(() =>
  done.value
    ? t('countdown.done')
    : t('countdown.spoken', { d: parts.value.d, h: parts.value.h, m: parts.value.m }),
)
watch(done, (v) => v && emit('done'), { immediate: true })
</script>

<template>
  <div class="cd" data-test="countdown" :data-done="done">
    <span class="cd__sr a-sr">{{ spoken }}</span>
    <span v-if="!done" class="cd__grid" aria-hidden="true">
      <span v-for="u in ['d', 'h', 'm', 's'] as const" :key="u" class="cd__cell">
        <strong>{{ u === 'd' ? parts[u] : pad(parts[u]) }}</strong>
        <small>{{ t(`countdown.${u}`) }}</small>
      </span>
    </span>
    <span v-else aria-hidden="true">{{ t('countdown.done') }}</span>
  </div>
</template>

<style scoped>
.cd__grid {
  display: inline-flex;
  gap: 14px;
}
.cd__cell {
  display: grid;
  justify-items: center;
  min-width: 44px;
}
.cd__cell strong {
  font-family: var(--a-serif);
  font-size: 34px;
  font-weight: 400;
  color: var(--a-cream);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.cd__cell small {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--a-muted);
}
.a-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
