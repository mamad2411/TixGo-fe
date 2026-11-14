<script setup lang="ts">
import { Armchair, Box, LayoutGrid, MapPin, MapSearch, Wand, X } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { http } from '@/api/client'
import {
  getSeatmap,
  getSeatStatuses,
  type PublicEvent,
  type Seatmap,
  type SeatStatuses,
} from '@/api/events'
import { useApiMessage } from '@/composables/useApiMessage'
import ErrorState from '@/components/app/ErrorState.vue'
import { festivalLayout, seatedStage } from '@/utils/festival'
import { seatGuide, zoneGuide } from '@/utils/guide'
import { formatRupiah } from '@/utils/format'
import { tierColor } from '@/utils/tiers'
import { bounds, buildSeats, type SeatVM } from '@/utils/venue'

import ZoneGuide from './ZoneGuide.vue'

// Denah berat (SVG ribuan kursi, three.js) baru diunduh & dipasang saat tabnya dibuka.
const SeatMap2D = defineAsyncComponent(() => import('./SeatMap2D.vue'))
const FestivalPlan2D = defineAsyncComponent(() => import('./FestivalPlan2D.vue'))
const Venue3D = defineAsyncComponent(() => import('./Venue3D.vue'))

export interface SeatPick {
  id: string
  label: string
  tierId: string
  tierName: string
  price: number
}

const props = defineProps<{ event: PublicEvent; picked: SeatPick[]; tier: string }>()
const emit = defineEmits<{ 'update:picked': [SeatPick[]]; 'update:tier': [string] }>()
const { t, locale } = useI18n()
const message = useMessage()
const apiMessage = useApiMessage()
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const rp = (n: number) => formatRupiah(n, bcp.value)

const seated = computed(() => props.event.has_seatmap)
const view = ref<'guide' | '2d' | '3d'>('guide')
const map = ref<Seatmap | null>(null)
const status = ref<SeatStatuses | null>(null)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const errText = ref('')
const busy = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

async function load(): Promise<void> {
  if (!seated.value) {
    state.value = 'ok'
    return
  }
  state.value = 'loading'
  try {
    ;[map.value, status.value] = await Promise.all([
      getSeatmap(props.event.slug),
      getSeatStatuses(props.event.slug),
    ])
    state.value = 'ok'
  } catch (e) {
    errText.value = apiMessage(e)
    state.value = 'error'
  }
}
async function refreshStatus(): Promise<void> {
  if (!seated.value || document.hidden) return
  try {
    status.value = await getSeatStatuses(props.event.slug)
    // kursi pilihanku yang baru diambil orang lain dilepas dari pilihan + diberi tahu
    const taken = props.picked.filter(
      (p) => status.value!.sold.includes(p.id) || status.value!.held.includes(p.id),
    )
    if (taken.length) {
      emit(
        'update:picked',
        props.picked.filter((p) => !taken.includes(p)),
      )
      message.warning(t('seats.taken', { labels: taken.map((x) => x.label).join(', ') }))
    }
  } catch {
    /* penyegaran latar: kegagalan sesaat tidak mengganggu pengguna */
  }
}
onMounted(() => {
  void load()
  timer = setInterval(() => void refreshStatus(), 15_000)
})
onBeforeUnmount(() => clearInterval(timer))

const seats = computed<SeatVM[]>(() =>
  map.value ? buildSeats(map.value, status.value, props.event.tiers) : [],
)
const selected = computed(() => new Set(props.picked.map((p) => p.id)))
const free = computed(() => seats.value.filter((s) => s.state === 'available').length)

function toggle(id: string): void {
  const s = seats.value.find((x) => x.id === id)
  if (!s) return
  if (selected.value.has(id))
    emit(
      'update:picked',
      props.picked.filter((p) => p.id !== id),
    )
  else
    emit('update:picked', [
      ...props.picked,
      { id, label: s.label, tierId: s.tierId, tierName: s.tierName, price: s.price },
    ])
}
function limit(): void {
  message.warning(t('seats.limit', { n: props.event.max_per_order }))
}

// ---- pilih otomatis (best-available) lewat API ----
const autoQty = ref(2)
const autoTier = ref('')
async function suggest(): Promise<void> {
  const tierId = autoTier.value || props.event.tiers.find((x) => x.available > 0)?.id
  if (!tierId) return
  busy.value = true
  try {
    const r = await http.get<{
      data: { seat_ids: string[]; labels: string[]; contiguous: boolean }
    }>(`/events/${encodeURIComponent(props.event.slug)}/seats/suggest`, {
      params: { qty: autoQty.value, tier_id: tierId },
    })
    const ids = r.data.data.seat_ids
    const picks: SeatPick[] = ids.flatMap((id) => {
      const s = seats.value.find((x) => x.id === id)
      return s
        ? [{ id, label: s.label, tierId: s.tierId, tierName: s.tierName, price: s.price }]
        : []
    })
    emit('update:picked', picks)
    message.success(
      t(r.data.data.contiguous ? 'seats.autoOk' : 'seats.autoSplit', {
        labels: r.data.data.labels.join(', '),
      }),
    )
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}

// ---- festival ----
const layout = computed(() => festivalLayout(props.event.tiers))
const density = computed(() =>
  Object.fromEntries(
    props.event.tiers.map((x) => [
      x.id,
      x.capacity ? Math.min(1, (x.capacity - x.available) / x.capacity) : 1,
    ]),
  ),
)
const stageW = computed(() => {
  if (!seats.value.length) return 400
  const b = bounds(seats.value)
  return Math.max(300, Math.min(640, (b.maxX - b.minX) * 0.46))
})
const blocks3d = computed(() => (seated.value ? seatedStage(stageW.value) : layout.value.blocks))
const total = computed(() => props.picked.reduce((a, p) => a + p.price, 0))

// ---- dropdown cepat: tanpa klik peta ----
const finderTier = ref('')
const finderSection = ref('')
const finderSeat = ref('')
const tierOpts = computed(() => props.event.tiers.filter((x) => x.available > 0))
const sectionOpts = computed(() => {
  const m = new Map<string, string>()
  for (const s of seats.value)
    if (s.state === 'available' && (!finderTier.value || s.tierId === finderTier.value))
      m.set(s.sectionId, s.sectionName)
  return [...m].map(([id, name]) => ({ id, name }))
})
const seatOpts = computed(() =>
  seats.value.filter(
    (s) =>
      s.state === 'available' &&
      (!finderTier.value || s.tierId === finderTier.value) &&
      (!finderSection.value || s.sectionId === finderSection.value),
  ),
)
function onFinderTier(): void {
  finderSection.value = ''
  finderSeat.value = ''
}
function addFinderSeat(): void {
  if (!finderSeat.value) return
  if (!selected.value.has(finderSeat.value)) {
    if (props.picked.length >= props.event.max_per_order) limit()
    else toggle(finderSeat.value)
  }
  finderSeat.value = ''
}
const zoneInfo = computed(() => props.event.tiers.find((x) => x.id === props.tier))

// ---- panduan zona: letak tiap seksi/zona tanpa membuka denah ----
const guideActive = ref('')
const guideStage = computed(() =>
  seated.value
    ? { x: -stageW.value / 2, y: -170, w: stageW.value, h: 110 }
    : (layout.value.blocks.find((b) => b.kind === 'stage') ?? { x: 0, y: 0, w: 0, h: 0 }),
)
const guideItems = computed(() =>
  seated.value ? seatGuide(seats.value) : zoneGuide(layout.value.zones, guideStage.value),
)
const guideBox = computed(() => {
  if (!seated.value) return layout.value.viewBox
  const b = bounds(seats.value)
  const pad = 50
  const x = Math.min(b.minX, -stageW.value / 2) - pad
  const y = -190
  return { x, y, w: Math.max(b.maxX, stageW.value / 2) + pad - x, h: b.maxY + pad - y }
})
// jari kursi proporsional terhadap lebar denah agar titik tidak menumpuk
const guideDot = computed(() => Math.max(5, Math.min(9, guideBox.value.w / 110)))
const guideCurrent = computed(() =>
  seated.value ? guideActive.value : !guideActive.value ? props.tier : guideActive.value,
)
function guideSelect(id: string): void {
  guideActive.value = id
  if (!seated.value) emit('update:tier', id)
}
async function guideChoose(id: string): Promise<void> {
  const it = guideItems.value.find((x) => x.id === id)
  if (!it) return
  if (!seated.value) {
    emit('update:tier', id)
    return
  }
  finderTier.value = it.tierId
  finderSection.value = it.id
  finderSeat.value = ''
  await nextTick()
  document.querySelector<HTMLSelectElement>('[data-test="find-seat"]')?.focus()
}
function guideMap(id: string): void {
  guideSelect(id)
  if (seated.value) {
    finderTier.value = guideItems.value.find((x) => x.id === id)?.tierId ?? ''
  }
  view.value = '2d'
}

const legend = computed(() => props.event.tiers.map((x, i) => ({ tier: x, color: tierColor(i) })))
</script>

<template>
  <div class="ve">
    <div class="ve__tabs" role="tablist" :aria-label="t('seats.viewGroup')">
      <button
        type="button"
        role="tab"
        :aria-selected="view === 'guide'"
        data-test="view-guide"
        @click="view = 'guide'"
      >
        <NIcon :component="MapPin" :size="17" aria-hidden="true" /> {{ t('guide.tab') }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="view === '2d'"
        data-test="view-2d"
        @click="view = '2d'"
      >
        <NIcon :component="LayoutGrid" :size="17" aria-hidden="true" /> {{ t('seats.view2d') }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="view === '3d'"
        data-test="view-3d"
        @click="view = '3d'"
      >
        <NIcon :component="Box" :size="17" aria-hidden="true" /> {{ t('seats.view3d') }}
      </button>
    </div>

    <div
      v-if="state === 'loading'"
      class="ve__sk a-sk"
      role="status"
      :aria-label="t('common.loading')"
    >
      <span class="ve__skmap" />
      <div class="ve__skrows">
        <span class="a-sk-bar" style="width: 74%" />
        <span class="a-sk-bar a-sk-bar--sm" style="width: 52%" />
        <span class="a-sk-bar a-sk-bar--sm" style="width: 62%" />
      </div>
    </div>
    <ErrorState v-else-if="state === 'error'" :message="errText" @retry="load" />

    <template v-else>
      <!-- ACARA BERNOMOR -->
      <template v-if="seated">
        <div class="ve__find" role="group" :aria-label="t('seats.findTitle')">
          <p class="ve__find-t">
            <NIcon :component="MapSearch" :size="20" aria-hidden="true" />
            <strong>{{ t('seats.findTitle') }}</strong>
            <span class="a-muted">{{ t('seats.findBody') }}</span>
          </p>
          <label class="ve__sel">
            <span class="ve__lbl">{{ t('seats.findTier') }}</span>
            <select v-model="finderTier" data-test="find-tier" @change="onFinderTier">
              <option value="">{{ t('seats.anyTier') }}</option>
              <option v-for="x in tierOpts" :key="x.id" :value="x.id">
                {{ x.name }} · {{ rp(x.final_price) }}
              </option>
            </select>
          </label>
          <label class="ve__sel">
            <span class="ve__lbl">{{ t('seats.findSection') }}</span>
            <select v-model="finderSection" data-test="find-section" @change="finderSeat = ''">
              <option value="">{{ t('seats.anySection') }}</option>
              <option v-for="s in sectionOpts" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="ve__sel">
            <span class="ve__lbl">{{ t('seats.findSeat') }}</span>
            <select v-model="finderSeat" data-test="find-seat" @change="addFinderSeat">
              <option value="">{{ t('seats.findSeatPlaceholder', { n: seatOpts.length }) }}</option>
              <option v-for="s in seatOpts.slice(0, 400)" :key="s.id" :value="s.id">
                {{ s.label }}
              </option>
            </select>
          </label>
        </div>
        <ZoneGuide
          v-if="view === 'guide'"
          :items="guideItems"
          :view-box="guideBox"
          :stage="guideStage"
          :active="guideCurrent"
          :dot="guideDot"
          :rp="rp"
          seated
          @select="guideSelect"
          @choose="guideChoose"
          @map="guideMap"
        />
        <SeatMap2D
          v-if="view === '2d'"
          :seats="seats"
          :selected="selected"
          :max="event.max_per_order"
          @toggle="toggle"
          @limit="limit"
        />
        <Venue3D
          v-if="view === '3d'"
          :seats="seats"
          :selected="selected"
          :blocks="blocks3d"
          @toggle="toggle"
        />

        <div class="ve__auto">
          <NIcon :component="Wand" :size="20" aria-hidden="true" class="ve__wand" />
          <div class="ve__auto-t">
            <strong>{{ t('seats.autoTitle') }}</strong>
            <span class="a-muted">{{ t('seats.autoBody') }}</span>
          </div>
          <label class="ve__sel">
            <span class="a-sr">{{ t('tickets.qty') }}</span>
            <select v-model.number="autoQty" :aria-label="t('tickets.qty')">
              <option v-for="n in Math.min(event.max_per_order, 6)" :key="n" :value="n">
                {{ n }} {{ t('seats.persons') }}
              </option>
            </select>
          </label>
          <label class="ve__sel">
            <span class="a-sr">{{ t('tickets.pickTier') }}</span>
            <select v-model="autoTier" :aria-label="t('tickets.pickTier')">
              <option value="">{{ t('seats.anyTier') }}</option>
              <option
                v-for="x in event.tiers.filter((q) => q.available > 0)"
                :key="x.id"
                :value="x.id"
              >
                {{ x.name }}
              </option>
            </select>
          </label>
          <button
            type="button"
            class="a-pill a-pill--solid"
            :disabled="busy"
            data-test="auto-pick"
            @click="suggest"
          >
            {{ t('seats.autoGo') }}
          </button>
        </div>

        <ul class="ve__leg" :aria-label="t('seats.legend')">
          <li v-for="l in legend" :key="l.tier.id">
            <i :style="{ background: l.color }" /><strong>{{ l.tier.name }}</strong
            ><span class="a-muted">{{ rp(l.tier.final_price) }}</span
            ><em>{{ t('map.left', { n: l.tier.available }) }}</em>
          </li>
          <li class="ve__st"><span class="ve__sw ve__sw--sel" />{{ t('seats.state.selected') }}</li>
          <li class="ve__st"><span class="ve__sw ve__sw--sold" />{{ t('seats.state.sold') }}</li>
          <li class="ve__st"><span class="ve__sw ve__sw--held" />{{ t('seats.state.held') }}</li>
          <li class="ve__st"><span class="ve__sw ve__sw--ada" />{{ t('seats.accessible') }}</li>
        </ul>

        <div v-if="picked.length" class="ve__tray" data-test="tray">
          <p class="ve__tray-h">
            <NIcon :component="Armchair" :size="18" aria-hidden="true" />
            {{ t('seats.picked', { n: picked.length }) }} · <strong>{{ rp(total) }}</strong>
          </p>
          <ul>
            <li v-for="p in picked" :key="p.id">
              <span>{{ p.label }}</span><small class="a-muted"
                >{{ p.tierName }} · {{ rp(p.price) }}</small
              >
              <button
                type="button"
                :aria-label="t('seats.remove', { label: p.label })"
                @click="toggle(p.id)"
              >
                <NIcon :component="X" :size="14" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </div>
        <p class="a-muted ve__note">{{ t('seats.liveNote', { n: free }) }}</p>
      </template>

      <!-- ACARA BERDIRI / FESTIVAL -->
      <template v-else>
        <div class="ve__find" role="group" :aria-label="t('plan.pickZone')">
          <p class="ve__find-t">
            <NIcon :component="MapSearch" :size="20" aria-hidden="true" />
            <strong>{{ t('plan.pickZone') }}</strong>
            <span class="a-muted">{{ t('plan.pickZoneBody') }}</span>
          </p>
          <label class="ve__sel ve__sel--wide">
            <span class="ve__lbl">{{ t('tickets.pickTier') }}</span>
            <select
              :value="tier"
              data-test="zone-select"
              @change="emit('update:tier', ($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="x in event.tiers"
                :key="x.id"
                :value="x.id"
                :disabled="x.available <= 0"
              >
                {{ x.name }} · {{ rp(x.final_price) }} ·
                {{
                  x.available > 0 ? t('map.left', { n: x.available }) : t('tickets.status.sold_out')
                }}
              </option>
            </select>
          </label>
          <p v-if="zoneInfo" class="ve__zinfo a-muted" aria-live="polite">
            {{ zoneInfo.name }}: {{ rp(zoneInfo.final_price) }}
          </p>
        </div>
        <ZoneGuide
          v-if="view === 'guide'"
          :items="guideItems"
          :view-box="guideBox"
          :stage="guideStage"
          :active="guideCurrent"
          :dot="guideDot"
          :rp="rp"
          :seated="false"
          @select="guideSelect"
          @choose="guideChoose"
          @map="guideMap"
        />
        <FestivalPlan2D
          v-if="view === '2d'"
          :layout="layout"
          :active-tier="tier"
          :density="density"
          @pick="emit('update:tier', $event)"
        />
        <Venue3D v-if="view === '3d'" :blocks="blocks3d" :zones="layout.zones" :crowd="density" />
      </template>
    </template>
  </div>
</template>

<style scoped>
.ve {
  display: grid;
  gap: 14px;
}
.ve__tabs {
  display: inline-flex;
  justify-self: start;
  padding: 4px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: var(--a-bg2);
}
.ve__tabs button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--a-muted);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.ve__tabs button[aria-selected='true'] {
  background: var(--a-gold);
  color: var(--a-on-gold);
}
.ve__sk {
  display: grid;
  gap: 16px;
  min-height: 360px;
  align-content: start;
  padding: 18px;
  border: 1px solid var(--a-line);
  border-radius: 22px;
}
.ve__skmap {
  display: block;
  height: 240px;
  border-radius: 16px;
  background: var(--a-bg3);
  opacity: 0.5;
}
.ve__skrows {
  display: grid;
  gap: 10px;
}
.ve__auto {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 14px 16px;
  border: 1px dashed var(--a-line-strong);
  border-radius: 18px;
  background: rgb(217 185 121 / 0.06);
}
.ve__find {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 14px;
  padding: 14px 16px;
  border: 1px solid var(--a-line-strong);
  border-radius: 18px;
  background: var(--a-bg2);
}
.ve__find-t {
  flex: 1 0 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 0;
  color: var(--a-gold);
}
.ve__find-t strong {
  color: var(--a-ink);
}
.ve__find-t span {
  font-size: 14px;
}
.ve__lbl {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--a-muted);
}
.ve__sel--wide {
  flex: 1 1 320px;
}
.ve__sel--wide select {
  width: 100%;
}
.ve__zinfo {
  margin: 0;
  font-size: 14px;
}
.ve__wand {
  color: var(--a-gold);
}
.ve__auto-t {
  display: grid;
  flex: 1 1 220px;
  font-size: 14px;
}
.ve__sel {
  position: relative;
  display: block;
  min-width: 0;
  --chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6l6-6'/%3E%3C/svg%3E");
}
/* panah select digambar sendiri supaya jaraknya dari tepi pil terkendali (panah bawaan Chrome menempel ~6px) */
.ve__sel::after {
  content: '';
  position: absolute;
  right: 16px;
  bottom: 14px;
  width: 16px;
  height: 16px;
  background: var(--a-muted);
  -webkit-mask: var(--chevron) center / 16px 16px no-repeat;
  mask: var(--chevron) center / 16px 16px no-repeat;
  pointer-events: none;
}
.ve__sel select {
  appearance: none;
  width: 100%;
  min-height: 44px;
  padding: 0 42px 0 18px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: var(--a-bg);
  color: var(--a-ink);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.ve__leg {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
}
.ve__leg li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid var(--a-line);
  border-radius: 999px;
  background: var(--a-bg2);
}
.ve__leg li i {
  width: 12px;
  height: 12px;
  border-radius: 4px;
}
.ve__leg li em {
  font-style: normal;
  color: var(--a-gold);
}
.ve__st {
  color: var(--a-muted);
}
.ve__sw {
  width: 14px;
  height: 12px;
  border-radius: 4px 4px 2px 2px;
  background: #3a352c;
}
.ve__sw--sel {
  background: #f4ecd8;
}
.ve__sw--held {
  opacity: 0.55;
}
.ve__sw--ada {
  background: #fff;
  border-radius: 50%;
  width: 12px;
}
.ve__tray {
  padding: 14px 16px;
  border: 1px solid var(--a-gold);
  border-radius: 18px;
  background: rgb(217 185 121 / 0.08);
}
.ve__tray-h {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--a-gold);
}
.ve__tray ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}
.ve__tray li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 4px 12px;
  border-radius: 999px;
  background: var(--a-bg);
  border: 1px solid var(--a-line-strong);
  font-size: 13px;
}
.ve__tray li button {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--a-muted);
  cursor: pointer;
}
.ve__note {
  font-size: 13px;
}
</style>
