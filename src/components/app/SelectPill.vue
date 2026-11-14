<script setup lang="ts">
import { ChevronDown } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed, type Component } from 'vue'

// <select> native (aksesibel, picker bawaan di ponsel) dengan kulit pil + ikon. Opsi pertama = "semua".
const props = defineProps<{
  label: string
  icon: Component
  options: { value: string; label: string }[]
  allLabel: string
}>()
const model = defineModel<string>({ required: true })

// Nilai terpilih ditampilkan sebagai teks; <select>-nya transparan menutup seluruh pil,
// jadi seluruh kotak 56px jadi target sentuh (bukan hanya baris teks 23px).
const current = computed(
  () => props.options.find((o) => o.value === model.value)?.label ?? props.allLabel,
)
</script>

<template>
  <label class="sp" :class="{ 'is-set': model }">
    <NIcon class="sp__ic" :component="icon" :size="18" aria-hidden="true" />
    <span class="sp__cap">{{ label }}</span>
    <span class="sp__val">{{ current }}</span>
    <select v-model="model" class="sp__sel" :aria-label="label">
      <option value="">{{ allLabel }}</option>
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <NIcon class="sp__chev" :component="ChevronDown" :size="16" aria-hidden="true" />
  </label>
</template>

<style scoped>
.sp {
  position: relative;
  display: grid;
  min-height: 56px;
  padding: 8px 34px 6px 44px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-bg2);
  cursor: pointer;
  transition:
    border-color 0.18s,
    background 0.18s;
}
.sp:hover {
  border-color: var(--a-line-strong);
}
.sp:focus-within {
  border-color: var(--a-gold);
  box-shadow: 0 0 0 3px rgb(217 185 121 / 0.18);
}
.sp.is-set {
  border-color: var(--a-gold);
  background: rgb(217 185 121 / 0.1);
}
.sp__ic {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--a-gold);
}
.sp__chev {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--a-muted);
  pointer-events: none;
}
.sp__cap {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--a-muted);
  line-height: 1.2;
}
.sp__val {
  min-width: 0;
  overflow: hidden;
  color: var(--a-ink);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sp__sel {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.sp__sel:focus-visible {
  outline: none; /* fokus ditampilkan oleh :focus-within pada pembungkus */
}
.sp__sel option {
  color: #1a1613;
  background: #f2ead8;
}
</style>
