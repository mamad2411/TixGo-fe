<script setup lang="ts">
import { Armchair, MapPin } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { GuideItem } from '@/utils/guide'

// Panduan zona: skema ringan (SVG, tanpa three.js) + daftar letak tiap zona. Pengguna tahu "di mana"
// duduknya sebelum membuka denah penuh. Skema dekoratif (aria-hidden); daftar di kanan = jalur aksesibel.
const props = defineProps<{
  items: GuideItem[]
  viewBox: { x: number; y: number; w: number; h: number }
  stage: { x: number; y: number; w: number; h: number }
  active: string
  dot: number
  rp: (n: number) => string
  /** acara bernomor: tombol utama "Pilih kursi di zona ini"; berdiri: "Pilih zona ini". */
  seated: boolean
}>()
const emit = defineEmits<{ select: [id: string]; choose: [id: string]; map: [id: string] }>()
const { t } = useI18n()

const vb = computed(
  () => `${props.viewBox.x} ${props.viewBox.y} ${props.viewBox.w} ${props.viewBox.h}`,
)
const badgeR = computed(() => Math.max(10, props.viewBox.w / 38))
const current = computed(() => props.items.find((i) => i.id === props.active) ?? null)

function place(i: GuideItem): string {
  const d = t(`guide.depth.${i.depth}`)
  return i.side === 'center' ? d : `${d} · ${t(`guide.side.${i.side}`)}`
}
</script>

<template>
  <div class="zg" data-test="zone-guide">
    <figure class="zg__fig">
      <svg :viewBox="vb" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
        <rect
          :x="stage.x"
          :y="stage.y"
          :width="stage.w"
          :height="stage.h"
          rx="10"
          class="zg__stage"
        />
        <text
          :x="stage.x + stage.w / 2"
          :y="stage.y + stage.h / 2"
          text-anchor="middle"
          dominant-baseline="central"
          class="zg__stagetx"
          :font-size="Math.max(14, viewBox.w / 34)"
        >
          {{ t('map.stage') }}
        </text>
        <g
          v-for="(it, n) in items"
          :key="it.id"
          class="zg__z"
          :class="{ 'is-dim': active && active !== it.id, 'is-off': it.free <= 0 }"
          @click="emit('select', it.id)"
        >
          <path
            v-if="it.dots"
            :d="it.dots"
            :stroke="it.color"
            :stroke-width="dot * 2"
            stroke-linecap="round"
            fill="none"
          />
          <rect
            v-else-if="it.rect"
            :x="it.rect.x"
            :y="it.rect.y"
            :width="it.rect.w"
            :height="it.rect.h"
            rx="8"
            :fill="it.color"
            fill-opacity="0.55"
            :stroke="it.color"
            stroke-width="2"
          />
          <circle :cx="it.cx" :cy="it.cy" :r="badgeR" class="zg__badge" />
          <text
            :x="it.cx"
            :y="it.cy"
            text-anchor="middle"
            dominant-baseline="central"
            class="zg__n"
            :font-size="badgeR * 1.05"
          >
            {{ n + 1 }}
          </text>
        </g>
      </svg>
      <figcaption class="zg__cap">{{ t('guide.capFront') }}</figcaption>
    </figure>

    <div class="zg__side">
      <ul class="zg__list" :aria-label="t('guide.listLabel')">
        <li v-for="(it, n) in items" :key="it.id">
          <button
            type="button"
            class="zg__row"
            :class="{ 'is-on': active === it.id }"
            :aria-pressed="active === it.id"
            :data-test="`guide-${it.id}`"
            @click="emit('select', it.id)"
          >
            <span class="zg__no" :style="{ background: it.color }">{{ n + 1 }}</span>
            <span class="zg__txt">
              <strong>{{ it.name }}</strong>
              <small>{{ place(it) }}</small>
            </span>
            <span class="zg__meta">
              <b>{{ rp(it.price) }}</b>
              <small :class="{ 'is-out': it.free <= 0 }">{{
                it.free > 0 ? t('map.left', { n: it.free }) : t('tickets.status.sold_out')
              }}</small>
            </span>
          </button>
        </li>
      </ul>

      <div v-if="current" class="zg__act" aria-live="polite">
        <p class="zg__sel">
          <NIcon :component="MapPin" :size="18" aria-hidden="true" />
          <span
            ><strong>{{ current.name }}</strong> · {{ place(current) }}</span
          >
        </p>
        <div class="zg__btns">
          <button
            type="button"
            class="a-pill a-pill--solid"
            :disabled="current.free <= 0"
            data-test="guide-choose"
            @click="emit('choose', current.id)"
          >
            <NIcon :component="Armchair" :size="18" aria-hidden="true" />
            {{ seated ? t('guide.chooseSeat') : t('guide.chooseZone') }}
          </button>
          <button
            type="button"
            class="a-pill"
            data-test="guide-map"
            @click="emit('map', current.id)"
          >
            {{ t('guide.openMap') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.zg {
  display: grid;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--a-line);
  border-radius: 18px;
  background: var(--a-bg2);
}
.zg__fig {
  margin: 0;
  display: grid;
  gap: 8px;
  min-width: 0;
}
.zg__fig svg {
  display: block;
  width: 100%;
  max-height: 420px;
  border-radius: 12px;
  background: var(--a-bg);
}
.zg__stage {
  fill: #e9dfc4;
}
.zg__stagetx {
  fill: #1a1613;
  font-weight: 700;
  letter-spacing: 0.18em;
}
.zg__z {
  cursor: pointer;
  transition: opacity 0.18s;
}
.zg__z.is-dim {
  opacity: 0.28;
}
.zg__z.is-off {
  opacity: 0.4;
}
.zg__badge {
  fill: #1a1613;
  stroke: #f2ead8;
  stroke-width: 2;
}
.zg__n {
  fill: #f2ead8;
  font-weight: 700;
}
.zg__cap {
  font-size: 12px;
  text-align: center;
  color: var(--a-muted);
}
.zg__side {
  display: grid;
  gap: 12px;
  min-width: 0;
  align-content: start;
}
.zg__list {
  display: grid;
  gap: 6px;
  max-height: 360px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.zg__row {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 8px 12px;
  border: 1px solid var(--a-line);
  border-radius: 14px;
  background: transparent;
  color: var(--a-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s,
    background 0.18s;
}
.zg__row:hover {
  border-color: var(--a-line-strong);
}
.zg__row:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 2px;
}
.zg__row.is-on {
  border-color: var(--a-gold);
  background: rgb(224 178 94 / 0.1);
}
.zg__no {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: #1a1613;
  font-size: 13px;
  font-weight: 700;
}
.zg__txt,
.zg__meta {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.zg__txt strong {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.zg__txt small,
.zg__meta small {
  color: var(--a-muted);
  font-size: 12.5px;
}
.zg__meta {
  text-align: right;
  font-size: 14px;
}
.zg__meta .is-out {
  color: var(--a-danger);
}
.zg__act {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: var(--a-bg3);
}
.zg__sel {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  color: var(--a-gold);
}
.zg__sel span {
  color: var(--a-ink);
}
.zg__btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@media (min-width: 860px) {
  .zg {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 20px;
    padding: 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .zg__z,
  .zg__row {
    transition: none;
  }
}
</style>
