<script setup lang="ts">
import Panzoom, { type PanzoomObject } from '@panzoom/panzoom'
import { Minus, Plus } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatRupiah } from '@/utils/format'
import { bounds, rowLabels, sectionsOf, sectors, type SeatVM } from '@/utils/venue'

const props = defineProps<{ seats: SeatVM[]; selected: Set<string>; max: number }>()
const emit = defineEmits<{ toggle: [id: string]; limit: [] }>()
const { t, locale } = useI18n()
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))

const host = ref<HTMLElement>()
let pz: PanzoomObject | undefined
const scale = ref(1)

const b = computed(() => bounds(props.seats))
// viewBox: panggung di atas (y negatif), seluruh kursi di bawahnya, ruang untuk label & tombol.
const vb = computed(() => {
  const w = b.value.maxX - b.value.minX + 220
  return { x: b.value.minX - 110, y: -250, w, h: b.value.maxY + 250 + 90 }
})
const sections = computed(() => sectionsOf(props.seats))
const sects = computed(() => sectors(props.seats))
// Pengungkapan bertahap: zona dulu, kursi muncul saat diperbesar (pola Ticketmaster/SeatGeek).
const detail = computed(() => scale.value >= 1.7)
const tilt = ref(false)
const hoverSect = ref('')
const shortRp = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)} jt`
    : `${Math.round(n / 1000)} rb`
function zoomInto(e: MouseEvent): void {
  if (!detail.value)
    pz?.zoomToPoint(2.6, { clientX: e.clientX, clientY: e.clientY }, { animate: true })
}
const rows = computed(() => rowLabels(props.seats))
const stageW = computed(() => Math.max(300, Math.min(640, (b.value.maxX - b.value.minX) * 0.46)))
const byId = computed(() => new Map(props.seats.map((s) => [s.id, s])))

onMounted(async () => {
  await nextTick()
  if (!host.value) return
  pz = Panzoom(host.value, {
    maxScale: 6,
    minScale: 1,
    contain: 'outside',
    cursor: 'grab',
    step: 0.3,
  })
  host.value.addEventListener('panzoomzoom', (e) => {
    scale.value = (e as CustomEvent<{ scale: number }>).detail.scale
  })
  host.value.parentElement?.addEventListener('wheel', (e) => pz?.zoomWithWheel(e as WheelEvent), {
    passive: false,
  })
})
onBeforeUnmount(() => pz?.destroy())

// ---- interaksi: klik hanya bila tidak sedang menggeser peta ----
let down: { x: number; y: number } | null = null
function onDown(e: PointerEvent): void {
  down = { x: e.clientX, y: e.clientY }
}
function seatOf(el: EventTarget | null): SeatVM | undefined {
  const g = (el as Element | null)?.closest?.('[data-seat]')
  const id = g?.getAttribute('data-seat')
  return id ? byId.value.get(id) : undefined
}
function pick(s: SeatVM): void {
  if (s.state !== 'available') return
  if (!props.selected.has(s.id) && props.selected.size >= props.max) {
    emit('limit')
    return
  }
  emit('toggle', s.id)
}
function onUp(e: PointerEvent): void {
  if (!down) return
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6
  down = null
  if (moved) return
  const s = seatOf(e.target)
  if (s) pick(s)
}

// ---- tooltip ----
const tip = ref<{ s: SeatVM; x: number; y: number } | null>(null)
function onMove(e: PointerEvent): void {
  const s = seatOf(e.target)
  const r = host.value?.parentElement?.getBoundingClientRect()
  tip.value = s && r ? { s, x: e.clientX - r.left, y: e.clientY - r.top } : null
}

// ---- papan ketik: panah memindah fokus ke kursi terdekat searah; Enter/Spasi memilih ----
const focusId = ref('')
function onKey(e: KeyboardEvent): void {
  const cur = byId.value.get(focusId.value) ?? props.seats.find((s) => s.state === 'available')
  if (!cur) return
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    pick(cur)
    return
  }
  const dir: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }
  const d = dir[e.key]
  if (!d) return
  e.preventDefault()
  let best: SeatVM | undefined
  let bestScore = Infinity
  for (const s of props.seats) {
    if (s === cur) continue
    const dx = s.x - cur.x
    const dy = s.y - cur.y
    const along = dx * d[0] + dy * d[1]
    if (along <= 2) continue
    const across = Math.abs(dx * d[1]) + Math.abs(dy * d[0])
    const score = along + across * 2.2
    if (score < bestScore) {
      bestScore = score
      best = s
    }
  }
  if (best) focusId.value = best.id
}
watch(
  () => props.seats,
  (list) => {
    if (!focusId.value) focusId.value = list.find((s) => s.state === 'available')?.id ?? ''
  },
  { immediate: true },
)
const focusSeat = computed(() => byId.value.get(focusId.value))
const live = computed(() =>
  focusSeat.value
    ? `${focusSeat.value.sectionName}, ${t('seats.row')} ${focusSeat.value.row}, ${t('seats.seat')} ${focusSeat.value.no}, ${t(`seats.state.${focusSeat.value.state}`)}`
    : '',
)

const showRows = computed(() => scale.value >= 1.6)
function zoom(dir: 1 | -1): void {
  if (dir > 0) pz?.zoomIn()
  else pz?.zoomOut()
}
</script>

<template>
  <div class="m2">
    <div
      class="m2__frame"
      tabindex="0"
      role="application"
      :aria-label="t('seats.mapAria', { n: seats.length })"
      @keydown="onKey"
    >
      <div class="m2__tilt" :class="{ 'is-tilt': tilt }">
        <div ref="host" class="m2__pz">
          <svg
            :viewBox="`${vb.x} ${vb.y} ${vb.w} ${vb.h}`"
            @pointerdown="onDown"
            @pointerup="onUp"
            @pointermove="onMove"
            @pointerleave="tip = null"
          >
            <defs>
              <symbol id="seat" viewBox="-9 -9 18 18" overflow="visible">
                <rect x="-7" y="-7" width="14" height="11" rx="4" fill="currentColor" />
                <rect
                  x="-8"
                  y="3"
                  width="16"
                  height="4.5"
                  rx="2.2"
                  fill="currentColor"
                  opacity=".78"
                />
              </symbol>
              <radialGradient id="m2-spot" cx="50%" cy="0%" r="90%">
                <stop offset="0" stop-color="#f2e4bd" stop-opacity=".42" />
                <stop offset="1" stop-color="#f2e4bd" stop-opacity="0" />
              </radialGradient>
              <linearGradient id="m2-stage" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stop-color="#f4ecd8" />
                <stop offset="1" stop-color="#b9a47a" />
              </linearGradient>
            </defs>

            <!-- berkas cahaya panggung -->
            <path
              :d="`M ${-stageW / 2} -40 L ${b.minX - 60} ${b.maxY + 60} L ${b.maxX + 60} ${b.maxY + 60} L ${stageW / 2} -40 Z`"
              fill="url(#m2-spot)"
            />

            <!-- panggung: layar LED, lampu, apron melengkung -->
            <g aria-hidden="true">
              <rect
                :x="-stageW / 2 - 40"
                y="-210"
                :width="stageW + 80"
                height="14"
                rx="4"
                fill="var(--a-line)"
              />
              <rect
                :x="-stageW / 2 + 12"
                y="-196"
                :width="stageW - 24"
                height="46"
                fill="#201c16"
              />
              <path
                :d="`M ${-stageW / 2} -150 H ${stageW / 2} L ${stageW / 2 + 38} -46 Q 0 -4 ${-stageW / 2 - 38} -46 Z`"
                fill="url(#m2-stage)"
              />
              <path
                :d="`M ${-stageW / 2 - 38} -46 Q 0 -4 ${stageW / 2 + 38} -46`"
                fill="none"
                stroke="#8a6b34"
                stroke-width="3"
              />
              <text x="0" y="-86" text-anchor="middle" class="m2__stage">{{ t('map.stage') }}</text>
              <circle
                v-for="(x, i) in [-0.38, -0.19, 0, 0.19, 0.38]"
                :key="i"
                :cx="x * stageW"
                cy="-176"
                r="5"
                fill="#f2e4bd"
                opacity=".9"
              />
            </g>

            <!-- bidang zona: terlihat penuh saat zoom-out, memudar saat kursi muncul -->
            <g class="m2__zones" :class="{ 'is-detail': detail }">
              <g
                v-for="z in sects"
                :key="z.key"
                class="m2__zone"
                :class="{ 'is-off': z.free === 0, 'is-hover': hoverSect === z.key }"
                @pointerenter="hoverSect = z.key"
                @pointerleave="hoverSect = ''"
                @click="zoomInto"
              >
                <path
                  :d="z.d"
                  :fill="z.free === 0 ? 'var(--a-line)' : z.color"
                  :fill-opacity="z.free === 0 ? 0.55 : 0.3 + 0.55 * (z.free / z.total)"
                  :stroke="z.color"
                  stroke-width="3"
                  stroke-linejoin="round"
                />
                <g v-if="!detail" class="m2__chip">
                  <rect :x="z.cx - 92" :y="z.cy - 38" width="184" height="76" rx="20" />
                  <text :x="z.cx" :y="z.cy - 6" text-anchor="middle" class="m2__cn">
                    {{ z.sectionName }}
                  </text>
                  <text :x="z.cx" :y="z.cy + 20" text-anchor="middle" class="m2__cp">
                    {{
                      z.free === 0
                        ? t('seats.state.sold')
                        : `${shortRp(z.price)} · ${t('map.left', { n: z.free })}`
                    }}
                  </text>
                </g>
              </g>
            </g>

            <!-- label seksi saat detail (di atas kursi) -->
            <g v-if="detail" aria-hidden="true">
              <text
                v-for="sc in sections"
                :key="sc.id"
                :x="sc.lx"
                :y="sc.ly"
                text-anchor="middle"
                class="m2__sec"
              >
                {{ sc.name }}
              </text>
            </g>

            <!-- huruf baris (muncul saat diperbesar) -->
            <g v-if="showRows" aria-hidden="true">
              <text
                v-for="r in rows"
                :key="r.key"
                :x="r.x"
                :y="r.y + 3"
                text-anchor="middle"
                class="m2__row"
              >
                {{ r.text }}
              </text>
            </g>

            <!-- kursi: tersembunyi di zoom-out kecuali yang dipilih -->
            <g class="m2__seats" :class="{ 'is-detail': detail }">
              <g
                v-for="s in seats"
                :key="s.id"
                :data-seat="s.id"
                :transform="`translate(${s.x} ${s.y}) rotate(${s.rot})`"
                :class="['m2__s', `is-${s.state}`, { 'is-sel': selected.has(s.id) }]"
                aria-hidden="true"
              >
                <use
                  href="#seat"
                  x="-9"
                  y="-9"
                  width="18"
                  height="18"
                  :color="
                    selected.has(s.id)
                      ? 'var(--a-ink)'
                      : s.state === 'available'
                        ? s.color
                        : 'var(--a-line-strong)'
                  "
                />
                <path
                  v-if="s.state === 'sold' && showRows"
                  d="M-6 -5 L6 6 M6 -5 L-6 6"
                  class="m2__x"
                />
                <circle
                  v-if="s.accessible && s.state === 'available'"
                  r="3.6"
                  cy="-1"
                  fill="#fff"
                  stroke="#1a1613"
                  stroke-width="1"
                />
                <path v-if="selected.has(s.id)" d="M-4 -1 l3 3 l5 -6" class="m2__ck" />
                <rect
                  v-if="focusId === s.id"
                  x="-10.5"
                  y="-10.5"
                  width="21"
                  height="21"
                  rx="6"
                  class="m2__focus"
                />
              </g>
            </g>
          </svg>
        </div>
      </div>

      <div class="m2__ctl">
        <button type="button" :aria-label="t('map.zoomIn')" @click="zoom(1)">
          <NIcon :component="Plus" :size="20" aria-hidden="true" />
        </button>
        <button type="button" :aria-label="t('map.zoomOut')" @click="zoom(-1)">
          <NIcon :component="Minus" :size="20" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="m2__reset"
          :aria-pressed="tilt"
          data-test="tilt"
          @click="tilt = !tilt"
        >
          {{ t('seats.tilt') }}
        </button>
        <button type="button" class="m2__reset" @click="pz?.reset()">{{ t('map.reset') }}</button>
      </div>

      <div v-if="tip" class="m2__tip" :style="{ left: tip.x + 14 + 'px', top: tip.y + 14 + 'px' }">
        <strong>{{ tip.s.sectionName }}</strong>
        <span>{{ t('seats.row') }} {{ tip.s.row }} · {{ t('seats.seat') }} {{ tip.s.no }}</span>
        <span class="m2__tier"
          ><i :style="{ background: tip.s.color }" />{{ tip.s.tierName }} ·
          {{ formatRupiah(tip.s.price, bcp) }}</span
        >
        <em :data-st="tip.s.state"
          >{{ t(`seats.state.${tip.s.state}`)
          }}<template v-if="tip.s.accessible"> · {{ t('seats.accessible') }}</template></em
        >
      </div>
      <p class="a-sr" aria-live="polite">{{ live }}</p>
    </div>
  </div>
</template>

<style scoped>
.m2__frame {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--a-line);
  border-radius: 22px;
  background: radial-gradient(700px 300px at 50% 0%, rgb(217 185 121 / 0.18), var(--a-bg2) 72%);
}
.m2__frame:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 3px;
}
.m2__pz svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 620px;
  touch-action: none;
  user-select: none;
}
.m2__stage {
  font: 700 22px var(--a-sans);
  letter-spacing: 0.5em;
  fill: #1a1613;
}
.m2__sec {
  paint-order: stroke;
  stroke: var(--a-bg2);
  stroke-width: 5px;
  stroke-linejoin: round;
  font: 700 12px var(--a-sans);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  fill: var(--a-muted);
}
.m2__row {
  font: 700 9px var(--a-sans);
  fill: #8d846f;
}
.m2__s {
  cursor: pointer;
}
.m2__s.is-sold,
.m2__s.is-held {
  cursor: not-allowed;
}
.m2__s.is-held {
  opacity: 0.55;
}
.m2__s.is-available:hover {
  filter: brightness(1.25);
}
.m2__x {
  fill: none;
  stroke: #6b6355;
  stroke-width: 1.6;
  stroke-linecap: round;
}
.m2__ck {
  fill: none;
  stroke: #1a1613;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.m2__focus {
  fill: none;
  stroke: #d9b979;
  stroke-width: 2;
}
.m2__frame:not(:focus-within) .m2__focus {
  display: none;
}
.m2__ctl {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  gap: 6px;
}
.m2__ctl button {
  /* ikon & teks benar-benar di tengah kotak; tanpa flex, ikon SVG duduk di garis dasar teks (naik ~3px) */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0 10px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: var(--a-glass);
  color: var(--a-gold);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.m2__ctl button:hover {
  background: var(--a-gold);
  color: var(--a-on-gold);
}
.m2__tip {
  position: absolute;
  z-index: 5;
  display: grid;
  gap: 2px;
  min-width: 190px;
  padding: 10px 12px;
  border: 1px solid var(--a-line-strong);
  border-radius: 12px;
  background: var(--a-panel);
  font-size: 13px;
  pointer-events: none;
}
.m2__tip strong {
  color: var(--a-cream);
}
.m2__tier {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--a-gold);
}
.m2__tier i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.m2__tip em {
  font-style: normal;
  color: var(--a-ok);
}
.m2__tip em[data-st='sold'],
.m2__tip em[data-st='held'] {
  color: #ff9a8a;
}
.m2__tilt {
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.m2__tilt.is-tilt {
  transform: perspective(1200px) rotateX(34deg) scale(1.08);
  transform-origin: 50% 85%;
}
.m2__tilt.is-tilt .m2__s {
  filter: drop-shadow(0 4px 3px rgb(0 0 0 / 0.7));
}
.m2__zones {
  transition: opacity 0.35s;
}
.m2__zones.is-detail {
  opacity: 0.16;
  pointer-events: none;
}
.m2__zone {
  cursor: zoom-in;
  transition: filter 0.2s;
}
.m2__zone.is-hover {
  filter: brightness(1.3);
}
.m2__chip rect {
  fill: rgb(12 10 9 / 0.86);
  stroke: rgb(217 185 121 / 0.55);
  stroke-width: 1.5;
}
.m2__cn {
  font: 700 21px var(--a-sans);
  fill: #f2ead8;
}
.m2__cp {
  font: 600 16px var(--a-sans);
  fill: #d9b979;
}
.m2__seats {
  opacity: 0;
  transition: opacity 0.35s;
}
.m2__seats.is-detail {
  opacity: 1;
}
.m2__seats:not(.is-detail) .m2__s:not(.is-sel) {
  pointer-events: none;
}
.m2__ctl button[aria-pressed='true'] {
  background: var(--a-gold);
  color: var(--a-on-gold);
}
</style>
