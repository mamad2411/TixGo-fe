<script setup lang="ts">
import { NIcon } from 'naive-ui'
import type { Component } from 'vue'

// Kartu angka: label manusiawi + angka besar + SATU kalimat arti (docs/24 §3.2). `loading` = kerangka, bukan spinner.
withDefaults(
  defineProps<{
    label: string
    value: string
    hint?: string
    icon?: Component
    loading?: boolean
    tone?: 'plain' | 'gold' | 'ok' | 'warn'
  }>(),
  { tone: 'plain', loading: false, hint: '', icon: undefined },
)
</script>

<template>
  <article class="kpi" :class="`is-${tone}`" :aria-busy="loading">
    <header class="kpi__h">
      <span class="kpi__l">{{ label }}</span>
      <NIcon v-if="icon" :component="icon" :size="18" aria-hidden="true" class="kpi__ic" />
    </header>
    <span v-if="loading" class="kpi__sk a-sk" aria-hidden="true" />
    <p v-else class="kpi__v">{{ value }}</p>
    <p v-if="hint" class="kpi__hint">{{ hint }}</p>
  </article>
</template>

<style scoped>
.kpi {
  display: grid;
  align-content: start;
  gap: 6px;
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
}
.kpi__h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.kpi__l {
  color: var(--a-muted);
  font-size: 13px;
  font-weight: 600;
}
.kpi__ic {
  color: var(--a-gold);
}
.kpi__v {
  margin: 0;
  color: var(--a-ink);
  font-size: clamp(26px, 3vw, 32px);
  font-weight: 700;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.kpi__sk {
  height: 34px;
  border-radius: 8px;
}
.kpi__hint {
  margin: 0;
  color: var(--a-muted);
  font-size: 13px;
  line-height: 1.45;
}
.kpi.is-gold {
  border-color: var(--a-line-strong);
}
.kpi.is-ok .kpi__ic {
  color: var(--a-ok);
}
.kpi.is-warn .kpi__ic {
  color: var(--a-danger);
}
</style>
