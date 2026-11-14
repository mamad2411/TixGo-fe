<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * Kerangka muat bersama. Satu bentuk untuk semua halaman supaya peralihan data tidak
 * terasa berbeda-beda: `list` meniru daftar baris akun, `detail` meniru halaman rinci
 * (kepala + dua kolom). Sapuan cahaya selalu berasal dari satu permukaan `.a-sk`.
 */
withDefaults(defineProps<{ variant?: 'list' | 'detail'; rows?: number }>(), {
  variant: 'list',
  rows: 4,
})

const { t } = useI18n()
</script>

<template>
  <div class="skp" role="status" :aria-label="t('common.loading')" :data-variant="variant">
    <template v-if="variant === 'list'">
      <div v-for="n in rows" :key="n" class="skp__row a-sk">
        <div class="skp__main">
          <span class="a-sk-bar" :style="{ width: n % 2 ? '54%' : '66%' }" />
          <span class="a-sk-bar a-sk-bar--sm" :style="{ width: n % 2 ? '32%' : '42%' }" />
        </div>
        <span class="a-sk-pill" />
        <span class="a-sk-btn" />
      </div>
    </template>

    <template v-else>
      <div class="skp__head a-sk">
        <span class="a-sk-thumb" />
        <div class="skp__main">
          <span class="a-sk-bar a-sk-bar--title" style="width: 44%" />
          <span class="a-sk-bar" style="width: 72%" />
          <span class="a-sk-bar a-sk-bar--sm" style="width: 56%" />
        </div>
      </div>
      <div class="skp__grid">
        <div class="skp__block a-sk" />
        <div class="skp__block a-sk" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.skp {
  display: grid;
  gap: 12px;
}
.skp__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 16px 18px;
  border: 1px solid var(--a-line);
  border-radius: 14px;
}
.skp__main {
  flex: 1 1 220px;
  min-width: 0;
  display: grid;
  gap: 8px;
}
.skp__head {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--a-line);
  border-radius: 18px;
}
.skp__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.55fr);
  gap: 24px;
}
.skp__block {
  height: 240px;
  border: 1px solid var(--a-line);
  border-radius: 20px;
}
@media (max-width: 959px) {
  .skp__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .skp__block:last-child,
  .a-sk-pill {
    display: none;
  }
}
</style>
