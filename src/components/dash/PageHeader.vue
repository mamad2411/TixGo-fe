<script setup lang="ts">
// Kepala halaman dashboard: satu judul (h1), kalimat penjelas, dan aksi utama di kanan (HP: di bawah).
defineProps<{ title: string; lead?: string }>()
</script>

<template>
  <header class="ph">
    <div class="ph__txt">
      <h1 class="a-serif ph__t">{{ title }}</h1>
      <p v-if="lead" class="a-muted ph__lead">{{ lead }}</p>
    </div>
    <div v-if="$slots.default" class="ph__act"><slot /></div>
  </header>
</template>

<style scoped>
.ph {
  display: grid;
  gap: 14px;
  margin-bottom: 24px;
}
.ph__t {
  margin: 0;
  color: var(--a-cream);
  font-size: clamp(30px, 4.6vw, 44px);
  line-height: 1.1;
}
.ph__lead {
  max-width: 62ch;
  margin: 6px 0 0;
  font-size: 15px;
}
.ph__act {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
@media (min-width: 720px) {
  .ph {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
  }
}
</style>
