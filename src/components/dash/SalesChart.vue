<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SeriesPoint } from '@/api/organizer'

// Grafik area/garis SVG murni (tanpa pustaka grafik: ringan). Satu warna aksen. Dapat disorot dengan pointer
// DAN papan ketik (panah kiri/kanan), plus tabel alternatif untuk pembaca layar (docs/24 §5).
const props = defineProps<{
  points: SeriesPoint[]
  metric: 'tickets' | 'revenue'
  format: (n: number) => string
  dayLabel: (iso: string) => string
}>()
const { t } = useI18n()

const W = 640
const H = 220
const PAD = { l: 8, r: 8, t: 14, b: 26 }
const val = (p: SeriesPoint): number => (props.metric === 'tickets' ? p.tickets : p.revenue)
const max = computed(() => Math.max(1, ...props.points.map(val)))
const xs = (i: number): number =>
  props.points.length < 2 ? W / 2 : PAD.l + (i * (W - PAD.l - PAD.r)) / (props.points.length - 1)
const ys = (v: number): number => PAD.t + (1 - v / max.value) * (H - PAD.t - PAD.b)
const line = computed(() =>
  props.points
    .map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${ys(val(p)).toFixed(1)}`)
    .join(''),
)
const area = computed(() =>
  props.points.length
    ? `${line.value}L${xs(props.points.length - 1).toFixed(1)} ${H - PAD.b}L${xs(0).toFixed(1)} ${H - PAD.b}Z`
    : '',
)
const ticks = computed(() => {
  const n = props.points.length
  if (!n) return []
  const idx = new Set([0, Math.floor((n - 1) / 2), n - 1])
  return [...idx].map((i) => ({ i, label: props.dayLabel(props.points[i]!.t) }))
})

const active = ref<number | null>(null)
const cur = computed(() => (active.value === null ? null : props.points[active.value]))
function onMove(e: PointerEvent): void {
  const el = e.currentTarget as SVGElement
  const r = el.getBoundingClientRect()
  const x = ((e.clientX - r.left) / r.width) * W
  const n = props.points.length
  if (n < 2) return void (active.value = 0)
  active.value = Math.min(
    n - 1,
    Math.max(0, Math.round(((x - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1))),
  )
}
function onKey(e: KeyboardEvent): void {
  const n = props.points.length
  if (!n) return
  if (e.key === 'ArrowRight') active.value = Math.min(n - 1, (active.value ?? -1) + 1)
  else if (e.key === 'ArrowLeft') active.value = Math.max(0, (active.value ?? n) - 1)
  else if (e.key === 'Escape') active.value = null
  else return
  e.preventDefault()
}
</script>

<template>
  <figure class="sc">
    <div class="sc__tip" aria-live="polite">
      <template v-if="cur">
        <strong>{{ format(val(cur)) }}</strong>
        <span class="a-muted"
          >{{ dayLabel(cur.t) }} · {{ t('dash.event.sales.orders', { n: cur.orders }) }}</span
        >
      </template>
      <span v-else class="a-muted">{{ t('dash.event.sales.hover') }}</span>
    </div>
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="sc__svg"
      role="img"
      tabindex="0"
      :aria-label="t('dash.event.sales.chartAria')"
      @pointermove="onMove"
      @pointerleave="active = null"
      @keydown="onKey"
      @blur="active = null"
    >
      <defs>
        <linearGradient id="sc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="var(--a-gold)" stop-opacity="0.35" />
          <stop offset="1" stop-color="var(--a-gold)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line :x1="PAD.l" :x2="W - PAD.r" :y1="H - PAD.b" :y2="H - PAD.b" class="sc__axis" />
      <line :x1="PAD.l" :x2="W - PAD.r" :y1="ys(max / 2)" :y2="ys(max / 2)" class="sc__grid" />
      <path :d="area" fill="url(#sc-fill)" />
      <path :d="line" class="sc__line" />
      <g v-if="cur && active !== null">
        <line :x1="xs(active)" :x2="xs(active)" :y1="PAD.t" :y2="H - PAD.b" class="sc__cur" />
        <circle :cx="xs(active)" :cy="ys(val(cur))" r="5" class="sc__dot" />
      </g>
      <text
        v-for="k in ticks"
        :key="k.i"
        :x="xs(k.i)"
        :y="H - 6"
        class="sc__tick"
        :text-anchor="k.i === 0 ? 'start' : k.i === points.length - 1 ? 'end' : 'middle'"
      >
        {{ k.label }}
      </text>
    </svg>
    <details class="sc__table">
      <summary>{{ t('dash.event.sales.asTable') }}</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">{{ t('dash.event.sales.date') }}</th>
            <th scope="col">{{ t('dash.event.sales.tickets') }}</th>
            <th scope="col">{{ t('dash.event.sales.revenue') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in points" :key="p.t">
            <th scope="row">{{ dayLabel(p.t) }}</th>
            <td>{{ p.tickets }}</td>
            <td>{{ format(p.revenue) }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>

<style scoped>
.sc {
  display: grid;
  gap: 8px;
  margin: 0;
}
.sc__tip {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  min-height: 28px;
  font-size: 14px;
}
.sc__tip strong {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}
.sc__svg {
  width: 100%;
  height: auto;
  max-height: 280px;
  touch-action: pan-y;
  border-radius: 12px;
}
.sc__svg:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 2px;
}
.sc__axis {
  stroke: var(--a-line-strong);
  stroke-width: 1;
}
.sc__grid {
  stroke: var(--a-line);
  stroke-dasharray: 4 4;
}
.sc__line {
  fill: none;
  stroke: var(--a-gold);
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.sc__cur {
  stroke: var(--a-gold);
  stroke-opacity: 0.5;
}
.sc__dot {
  fill: var(--a-gold);
  stroke: var(--a-bg);
  stroke-width: 2;
}
.sc__tick {
  fill: var(--a-muted);
  font-size: 11px;
}
.sc__table summary {
  cursor: pointer;
  color: var(--a-muted);
  font-size: 13px;
}
.sc__table table {
  width: 100%;
  margin-top: 8px;
  border-collapse: collapse;
  font-size: 13px;
}
.sc__table th,
.sc__table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--a-line);
  text-align: left;
  font-weight: 500;
}
.sc__table thead th {
  color: var(--a-muted);
  font-size: 12px;
}
</style>
