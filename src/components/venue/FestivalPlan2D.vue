<script setup lang="ts">
import { Minus, Plus, ArrowsMaximize } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PublicTier } from '@/api/events'
import type { Block, FestivalLayout } from '@/utils/festival'
import { formatRupiah } from '@/utils/format'

const props = defineProps<{
  layout: FestivalLayout
  activeTier: string
  density: Record<string, number>
}>()
const emit = defineEmits<{ pick: [tierId: string] }>()
const { t, locale } = useI18n()
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const base = computed(() => props.layout.viewBox)
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
// viewBox turunan dari zoom & geser; tetap di dalam kanvas dasar
const vb = computed(() => {
  const b = base.value
  const w = b.w / zoom.value
  const h = b.h / zoom.value
  const cx = b.x + b.w / 2 + pan.value.x
  const cy = b.y + b.h / 2 + pan.value.y
  const x = Math.min(b.x + b.w - w, Math.max(b.x, cx - w / 2))
  const y = Math.min(b.y + b.h - h, Math.max(b.y, cy - h / 2))
  return { x, y, w, h }
})
function setZoom(z: number): void {
  zoom.value = Math.min(3, Math.max(1, z))
  if (zoom.value === 1) pan.value = { x: 0, y: 0 }
}
let drag: { px: number; py: number; ox: number; oy: number } | null = null
const svgEl = ref<SVGSVGElement>()
function down(e: PointerEvent): void {
  if (zoom.value === 1 || (e.target as Element).closest('.fp__zone')) return
  drag = { px: e.clientX, py: e.clientY, ox: pan.value.x, oy: pan.value.y }
  svgEl.value?.setPointerCapture(e.pointerId)
}
function move(e: PointerEvent): void {
  if (!drag || !svgEl.value) return
  const k = vb.value.w / svgEl.value.clientWidth
  pan.value = { x: drag.ox - (e.clientX - drag.px) * k, y: drag.oy - (e.clientY - drag.py) * k }
}
function up(): void {
  drag = null
}
const hover = ref<string>('')
const hoverTier = computed(() => zoneBy.value.get(hover.value))
const hoverLeft = computed(() => {
  const t0 = hoverTier.value
  return t0 && t0.capacity ? Math.round((t0.available / t0.capacity) * 100) : 0
})

const zoneBy = computed(() => new Map(props.layout.zones.map((z) => [z.tier.id, z.tier])))
const off = (tier?: PublicTier) =>
  !!tier && ['sold_out', 'full_booked', 'unavailable'].includes(tier.status)

const facilities = computed(() =>
  props.layout.blocks.filter((b) =>
    [
      'bar',
      'toilet',
      'medic',
      'merch',
      'charging',
      'ada',
      'lounge',
      'gate',
      'exit',
      'foh',
    ].includes(b.kind),
  ),
)
const legend = computed(() => {
  const kinds = new Set(props.layout.blocks.map((b) => b.kind))
  return (
    [
      'stage',
      'screen',
      'catwalk',
      'barricade',
      'foh',
      'tower',
      'bar',
      'toilet',
      'medic',
      'merch',
      'charging',
      'ada',
      'lounge',
      'gate',
      'exit',
    ] as const
  ).filter((k) => kinds.has(k))
})
const colorOf = (k: string) => props.layout.blocks.find((b) => b.kind === k)?.color ?? '#888'

// titik kerumunan deterministik (bukan data per orang): kepadatan = proporsi terjual zona
function dots(b: Block, tierId: string): { x: number; y: number }[] {
  const k = props.density[tierId] ?? 0
  const n = Math.round(Math.min(160, (b.w * b.h) / 900) * k)
  let seed = Math.round(b.w * 13 + b.h * 7)
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  return Array.from({ length: n }, () => ({
    x: b.x + 12 + rnd() * (b.w - 24),
    y: b.y + 24 + rnd() * (b.h - 36),
  }))
}
function pickZone(b: Block): void {
  if (b.tierId) emit('pick', b.tierId)
}
</script>

<template>
  <figure class="fp">
    <div class="fp__tools" role="group" :aria-label="t('plan.zoom')">
      <button
        type="button"
        :aria-label="t('plan.zoomIn')"
        :disabled="zoom >= 3"
        @click="setZoom(zoom + 0.5)"
      >
        <NIcon :component="Plus" :size="18" aria-hidden="true" />
      </button>
      <button
        type="button"
        :aria-label="t('plan.zoomOut')"
        :disabled="zoom <= 1"
        @click="setZoom(zoom - 0.5)"
      >
        <NIcon :component="Minus" :size="18" aria-hidden="true" />
      </button>
      <button
        type="button"
        :aria-label="t('plan.zoomReset')"
        :disabled="zoom === 1"
        @click="setZoom(1)"
      >
        <NIcon :component="ArrowsMaximize" :size="18" aria-hidden="true" />
      </button>
    </div>
    <div v-if="hoverTier" class="fp__tip" aria-hidden="true">
      <strong>{{ hoverTier.name }}</strong>
      <span>{{ formatRupiah(hoverTier.final_price, bcp) }}</span>
      <i class="fp__bar"><b :style="{ width: hoverLeft + '%' }" /></i>
      <small>{{ t('map.left', { n: hoverTier.available }) }}</small>
    </div>
    <svg
      ref="svgEl"
      :class="{ 'is-zoomed': zoom > 1 }"
      :viewBox="`${vb.x} ${vb.y} ${vb.w} ${vb.h}`"
      role="group"
      :aria-label="t('plan.aria')"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
    >
      <defs>
        <pattern id="fp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" class="fp__grid" stroke-width="1" />
        </pattern>
        <pattern
          id="fp-off"
          width="9"
          height="9"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="9"
            stroke="#0c0a09"
            stroke-opacity=".55"
            stroke-width="4"
          />
        </pattern>
        <linearGradient id="fp-stage" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#f4ecd8" />
          <stop offset="1" stop-color="#b9a47a" />
        </linearGradient>
        <linearGradient
          v-for="b in layout.blocks.filter((x) => x.kind === 'zone')"
          :id="`fz-${b.id}`"
          :key="b.id"
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop offset="0" :stop-color="b.color" stop-opacity=".95" />
          <stop offset="1" :stop-color="b.color" stop-opacity=".62" />
        </linearGradient>
        <linearGradient id="fp-beam" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#fff3cf" stop-opacity=".34" />
          <stop offset="1" stop-color="#fff3cf" stop-opacity="0" />
        </linearGradient>
        <radialGradient id="fp-glow" cx="50%" cy="0%" r="75%">
          <stop offset="0" stop-color="#f2e4bd" stop-opacity=".32" />
          <stop offset="1" stop-color="#f2e4bd" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect :x="vb.x" :y="vb.y" :width="vb.w" :height="vb.h" class="fp__bg" />
      <rect :x="vb.x" :y="vb.y" :width="vb.w" :height="vb.h" fill="url(#fp-grid)" opacity=".7" />
      <rect :x="vb.x" :y="vb.y" :width="vb.w" :height="vb.h * 0.6" fill="url(#fp-glow)" />

      <!-- pagar venue -->
      <rect
        :x="-540"
        y="-200"
        width="1080"
        height="940"
        rx="26"
        fill="none"
        class="fp__fence"
        stroke-width="3"
        stroke-dasharray="14 10"
      />

      <!-- zona tiket -->
      <g v-for="b in layout.blocks.filter((x) => x.kind === 'zone')" :key="b.id">
        <g
          class="fp__zone"
          :class="{ 'is-on': activeTier === b.tierId }"
          role="button"
          tabindex="0"
          :aria-pressed="activeTier === b.tierId"
          :aria-label="`${b.label}, ${formatRupiah(zoneBy.get(b.tierId!)!.final_price, bcp)}, ${t(`tickets.status.${zoneBy.get(b.tierId!)!.status}`)}`"
          @pointerenter="hover = b.tierId!"
          @pointerleave="hover = ''"
          @focus="hover = b.tierId!"
          @blur="hover = ''"
          @click="pickZone(b)"
          @keydown.enter.prevent="pickZone(b)"
          @keydown.space.prevent="pickZone(b)"
        >
          <rect
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
            rx="22"
            :fill="`url(#fz-${b.id})`"
            :fill-opacity="off(zoneBy.get(b.tierId!)) ? 0.22 : 1"
          />
          <rect
            :x="b.x + 8"
            :y="b.y + 8"
            :width="b.w - 16"
            :height="b.h - 16"
            rx="16"
            fill="none"
            stroke="#fff"
            stroke-opacity=".28"
            stroke-dasharray="3 7"
            stroke-width="2"
          />
          <rect
            v-if="off(zoneBy.get(b.tierId!))"
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
            rx="22"
            fill="url(#fp-off)"
          />
          <rect
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
            rx="22"
            fill="none"
            :stroke="activeTier === b.tierId ? '#fff' : b.color"
            :stroke-width="activeTier === b.tierId ? 5 : 2"
          />
          <circle
            v-for="(d, i) in dots(b, b.tierId!)"
            :key="i"
            :cx="d.x"
            :cy="d.y"
            r="3.4"
            fill="#0c0a09"
            opacity=".38"
          />
          <text :x="b.x + 30" :y="b.y + b.h - 50" class="fp__zn">
            {{ b.label }}
          </text>
          <text :x="b.x + 30" :y="b.y + b.h - 26" class="fp__zp">
            {{ formatRupiah(zoneBy.get(b.tierId!)!.final_price, bcp) }} ·
            {{ t(`tickets.status.${zoneBy.get(b.tierId!)!.status}`) }}
          </text>
        </g>
      </g>

      <!-- panggung -->
      <g aria-hidden="true">
        <rect x="-348" y="-166" width="146" height="20" rx="3" fill="#2a2f3a" />
        <rect x="202" y="-166" width="146" height="20" rx="3" fill="#2a2f3a" />
        <text x="-275" y="-152" text-anchor="middle" class="fp__tiny" fill="#9fb2d6">LED</text>
        <text x="275" y="-152" text-anchor="middle" class="fp__tiny" fill="#9fb2d6">LED</text>
        <path d="M-190 -170 H190 L226 -40 H-226 Z" fill="url(#fp-stage)" />
        <path
          d="M-150 -40 L-330 300 L-90 300 Z M0 -40 L-110 320 L110 320 Z M150 -40 L90 300 L330 300 Z"
          fill="url(#fp-beam)"
        />
        <path d="M-200 -176 H200" stroke="#6b6355" stroke-width="5" stroke-dasharray="10 6" />
        <circle
          v-for="x in [-160, -80, 0, 80, 160]"
          :key="x"
          :cx="x"
          cy="-176"
          r="7"
          fill="#fff3cf"
        />
        <path d="M-226 -40 H226" stroke="#8a6b34" stroke-width="4" />
        <text x="0" y="-92" text-anchor="middle" class="fp__stage">{{ t('map.stage') }}</text>
        <rect x="-22" y="-40" width="44" height="180" rx="10" fill="#cdbb8c" />
        <text
          x="0"
          y="60"
          text-anchor="middle"
          class="fp__tiny"
          fill="#6b5a32"
          transform="rotate(-90 0 60)"
        >
          CATWALK
        </text>
      </g>

      <!-- barikade -->
      <g aria-hidden="true">
        <rect
          v-for="b in layout.blocks.filter((x) => x.kind === 'barricade')"
          :key="b.id"
          :x="b.x"
          :y="b.y"
          :width="b.w"
          :height="b.h"
          rx="3"
          fill="#8d846f"
        />
      </g>

      <!-- menara & FOH & fasilitas -->
      <g aria-hidden="true">
        <g v-for="b in layout.blocks.filter((x) => x.kind === 'tower')" :key="b.id">
          <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="4" fill="#566170" />
          <text :x="b.x + b.w / 2" :y="b.y + b.h + 16" text-anchor="middle" class="fp__tiny">
            {{ t('plan.tower') }}
          </text>
        </g>
        <g v-for="b in facilities" :key="b.id">
          <rect
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
            rx="10"
            :fill="b.color"
            fill-opacity=".92"
            stroke="#0c0a09"
            stroke-width="2"
          />
          <text
            :x="b.x + b.w / 2"
            :y="b.y + b.h / 2 + 5"
            text-anchor="middle"
            class="fp__fac"
            :fill="b.kind === 'gate' ? '#1a1613' : '#fff'"
          >
            {{ b.label }}
          </text>
        </g>
        <!-- panah arus masuk -->
        <path
          d="M-215 686 V668 M-221 676 L-215 668 L-209 676 M215 686 V668 M209 676 L215 668 L221 676"
          fill="none"
          stroke="#d9b979"
          stroke-width="3"
          stroke-linecap="round"
        />
      </g>
    </svg>

    <ul class="fp__legend" :aria-label="t('plan.legend')">
      <li v-for="k in legend" :key="k">
        <i :style="{ background: colorOf(k) }" />{{ t(`plan.kind.${k}`) }}
      </li>
      <li><i class="fp__dot" />{{ t('plan.crowd') }}</li>
    </ul>
    <figcaption class="fp__cap">{{ t('plan.note') }}</figcaption>
  </figure>
</template>

<style scoped>
.fp {
  margin: 0;
}
.fp {
  position: relative;
}
.fp__tools {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: grid;
  gap: 6px;
}
.fp__tools button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--a-line-strong);
  border-radius: 12px;
  background: var(--a-glass);
  color: var(--a-gold);
  cursor: pointer;
}
.fp__tools button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.fp__tip {
  position: absolute;
  left: 14px;
  top: 14px;
  z-index: 2;
  display: grid;
  gap: 4px;
  min-width: 190px;
  padding: 12px 14px;
  border: 1px solid var(--a-line-strong);
  border-radius: 14px;
  background: var(--a-panel);
  color: var(--a-ink);
  font-size: 14px;
  pointer-events: none;
}
.fp__tip small {
  color: var(--a-muted);
}
.fp__bar {
  display: block;
  height: 6px;
  border-radius: 99px;
  background: rgb(255 255 255 / 0.14);
  overflow: hidden;
}
.fp__bar b {
  display: block;
  height: 100%;
  background: #9bd8a8;
}
.fp svg.is-zoomed {
  cursor: grab;
  touch-action: none;
}
.fp svg {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--a-line);
  border-radius: 22px;
}
.fp svg g[aria-hidden='true'] {
  pointer-events: none; /* panggung, catwalk, fasilitas dekoratif tidak boleh menutupi klik pada zona */
}
.fp__zone {
  cursor: pointer;
  transition: filter 0.2s;
}
.fp__zone:hover {
  filter: brightness(1.12);
}
.fp__zone:focus-visible {
  outline: none;
}
.fp__zone:focus-visible rect:last-of-type {
  stroke: #fff;
  stroke-width: 6;
}
.fp__zn {
  font: 700 22px var(--a-sans);
  fill: #1a1613;
}
.fp__zp {
  font: 600 15px var(--a-sans);
  fill: #1a1613;
}
.fp__stage {
  font: 700 24px var(--a-sans);
  letter-spacing: 0.5em;
  fill: #1a1613;
}
.fp__bg {
  fill: var(--a-bg2);
}
.fp__grid {
  stroke: var(--a-line);
}
.fp__fence {
  stroke: var(--a-line-strong);
}
.fp__tiny {
  font: 700 11px var(--a-sans);
  letter-spacing: 0.16em;
  fill: var(--a-muted);
}
.fp__fac {
  font: 700 14px var(--a-sans);
  letter-spacing: 0.04em;
}
.fp__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--a-muted);
}
.fp__legend li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.fp__legend i {
  width: 14px;
  height: 14px;
  border-radius: 4px;
}
.fp__dot {
  border-radius: 50% !important;
  background: #0c0a09;
  border: 1px solid #6b6355;
}
.fp__cap {
  margin-top: 8px;
  font-size: 13px;
  color: var(--a-muted);
}
</style>
