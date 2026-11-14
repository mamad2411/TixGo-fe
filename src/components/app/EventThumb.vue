<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { mediaAt, mediaSrcset } from '@/utils/media'

// Poster kecil untuk baris tiket/pesanan. Poster hilang atau gagal dimuat -> blok inisial berwarna, bukan ikon rusak.
const props = withDefaults(defineProps<{ src?: string; title: string; w?: number; h?: number }>(), {
  src: '',
  w: 72,
  h: 90,
})
const broken = ref(false)
watch(
  () => props.src,
  () => (broken.value = false),
)
// Slot di sini 56-96 px (hanya venue yang 320 px). Dulu URL mentah dipakai apa adanya, jadi katalog
// artis mengunduh 14 berkas 800 px untuk kotak 94 px. Varian dipilih dari lebar slot; srcset tetap
// memberi layar 2x/3x berkas lebih tajam hanya bila memang perlu.
const src = computed(() => mediaAt(props.src, props.w <= 200 ? 400 : props.w <= 500 ? 800 : 1600))
const srcset = computed(() => mediaSrcset(props.src))
const sizes = computed(() => `${props.w}px`)
const letters = computed(() =>
  props.title
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() ?? '')
    .join(''),
)
</script>

<template>
  <span class="th" :style="{ width: `${w}px`, height: `${h}px` }" aria-hidden="true">
    <img
      v-if="src && !broken"
      :src="src"
      :srcset="srcset"
      :sizes="sizes"
      alt=""
      loading="lazy"
      decoding="async"
      @error="broken = true"
    />
    <span v-else class="th__ph">{{ letters }}</span>
  </span>
</template>

<style scoped>
.th {
  flex: none;
  display: block;
  border-radius: 12px;
  overflow: hidden;
  background: var(--a-bg2);
  border: 1px solid var(--a-line);
}
.th img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.th__ph {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font: 700 22px/1 var(--a-serif, serif);
  color: var(--a-gold);
  background: linear-gradient(135deg, var(--a-bg2), var(--a-bg3));
}
</style>
