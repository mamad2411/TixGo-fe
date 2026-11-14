<script setup lang="ts">
// Penanda status umum: kata + (opsional ikon di slot) + warna. `kind` hanya menentukan warna; maknanya selalu ada di teks.
withDefaults(defineProps<{ kind?: 'idle' | 'wait' | 'ok' | 'bad' }>(), { kind: 'idle' })
</script>

<template>
  <span class="chip" :class="`is-${kind}`"><slot /></span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid var(--a-line);
  border-radius: 999px;
  color: var(--a-muted);
  font-size: 12.5px;
  font-weight: 650;
  white-space: nowrap;
}
.is-ok {
  border-color: color-mix(in srgb, var(--a-ok) 55%, transparent);
  color: var(--a-ok);
}
.is-wait {
  border-color: color-mix(in srgb, var(--a-gold) 55%, transparent);
  color: var(--a-gold);
}
.is-bad {
  border-color: color-mix(in srgb, var(--a-danger) 55%, transparent);
  color: var(--a-danger);
}
</style>
