<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

defineProps<{ title: string; kicker?: string; to?: RouteLocationRaw; count?: number }>()
const { t } = useI18n()
const track = ref<HTMLElement>()

function scroll(dir: 1 | -1): void {
  const el = track.value
  if (!el) return
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' })
}
</script>

<template>
  <section class="rail">
    <header class="rail__head">
      <div>
        <p v-if="kicker" class="a-caps">{{ kicker }}</p>
        <h2 class="a-serif rail__title">{{ title }}</h2>
      </div>
      <div class="rail__btns">
        <slot name="extra" />
        <RouterLink v-if="to" :to="to" class="a-pill rail__all" data-test="rail-all">
          {{ t('events.seeAll') }}<template v-if="count"> ({{ count }})</template>
        </RouterLink>
        <button type="button" :aria-label="t('common.prev')" @click="scroll(-1)">
          <NIcon :component="ChevronLeft" :size="22" aria-hidden="true" />
        </button>
        <button type="button" :aria-label="t('common.next')" @click="scroll(1)">
          <NIcon :component="ChevronRight" :size="22" aria-hidden="true" />
        </button>
      </div>
    </header>
    <ul ref="track" class="rail__track" tabindex="0" :aria-label="title">
      <slot />
    </ul>
  </section>
</template>

<style scoped>
.rail__head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.rail__title {
  font-size: clamp(32px, 4vw, 48px);
  color: var(--a-cream);
}
.rail__btns {
  display: flex;
  gap: 8px;
  align-items: center;
}
.rail__all {
  white-space: nowrap;
}
.rail__btns button {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--a-line-strong);
  background: transparent;
  color: var(--a-gold);
  cursor: pointer;
}
.rail__btns button:hover {
  background: var(--a-gold);
  color: var(--a-on-gold);
}
.rail__track :slotted(li) {
  display: flex;
}
.rail__track :slotted(li) > * {
  width: 100%;
}
.rail__track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: clamp(250px, 24vw, 310px);
  gap: 18px;
  /* ruang untuk kartu terangkat + bayangan saat hover (tanpa ini bayangan terpotong tepi track);
     margin negatif menjaga posisi kartu tetap sama seperti sebelumnya */
  margin: -10px -8px -6px;
  padding: 14px 8px 24px;
  list-style: none;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}
.rail__track > :deep(*) {
  scroll-snap-align: start;
}
@media (max-width: 640px) {
  /* Panah disembunyikan (geser dengan jari), tetapi "Lihat semua" dan aksi tambahan tetap tampil. */
  .rail__btns button {
    display: none;
  }
}
</style>
