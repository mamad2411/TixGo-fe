<script setup lang="ts">
import { computed } from 'vue'

import type { EventCard } from '@/api/events'
import { mediaAt } from '@/utils/media'

// Dinding poster: tiga kolom poster konser nyata yang bergulir pelan berlawanan arah (pola landing Netflix/Spotify).
// Dekoratif sepenuhnya (aria-hidden); berhenti total bila pengguna meminta gerak dikurangi.
const props = defineProps<{ events: EventCard[] }>()
const posters = computed(() => props.events.filter((e) => e.poster_url))
// Enam kartu per kolom sudah lebih tinggi dari layar, jadi sembilan poster unik cukup untuk
// gulir tanpa putus. Sebelumnya 18 kartu memakai sampai 16 poster berbeda (≈330 kB foto di
// halaman masuk/daftar); sembilan memotong hampir separuh tanpa poster yang terlihat berulang.
const PER_COL = 6
const POOL = 9
const cols = computed(() => {
  const list = posters.value
  if (!list.length) return []
  const n = Math.min(list.length, POOL)
  const out: EventCard[][] = [[], [], []]
  for (let c = 0; c < 3; c++) {
    for (let k = 0; k < PER_COL; k++) out[c]!.push(list[(c * 3 + k) % n]!)
  }
  return out
})
</script>

<template>
  <div class="pw" aria-hidden="true">
    <div class="pw__grid">
      <div
        v-for="(col, i) in cols"
        :key="i"
        class="pw__col"
        :style="{
          '--dur': `${Math.round((70 - i * 9) / 3)}s`,
          '--dir': i === 1 ? 'reverse' : 'normal',
        }"
      >
        <!-- daftar digandakan agar gulir tanpa putus (translateY -50%) -->
        <div v-for="rep in 2" :key="rep" class="pw__set">
          <figure v-for="(e, k) in col" :key="`${rep}-${k}`" class="pw__card">
            <img
              :src="mediaAt(e.poster_url, 400)"
              alt=""
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />
            <figcaption>
              <span>{{ e.genre }}</span>
              <strong class="a-serif">{{ e.title }}</strong>
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pw {
  position: absolute;
  inset: -10% -20%;
  overflow: hidden;
  z-index: -1;
}
.pw__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  height: 100%;
  transform: rotate(-9deg) scale(1.12);
  transform-origin: 50% 50%;
}
.pw__col {
  display: grid;
  align-content: start;
  gap: 18px;
  animation: pw-scroll var(--dur) linear infinite;
  animation-direction: var(--dir);
}
.pw__col:nth-child(2) {
  margin-top: -140px;
}
.pw__set {
  display: grid;
  gap: 18px;
}
.pw__card {
  position: relative;
  margin: 0;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgb(255 255 255 / 0.08);
  background: #1d1915;
  box-shadow: 0 20px 40px rgb(0 0 0 / 0.5);
}
.pw__card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.pw__card figcaption {
  position: absolute;
  inset: auto 0 0 0;
  display: grid;
  gap: 2px;
  padding: 40px 14px 14px;
  background: linear-gradient(to top, rgb(12 10 9 / 0.92), transparent);
}
.pw__card span {
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #d9b979;
}
.pw__card strong {
  font-size: 22px;
  font-weight: 400;
  line-height: 1;
  color: #f2ead8;
}
@keyframes pw-scroll {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-50%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pw__col {
    animation: none;
  }
}
</style>
