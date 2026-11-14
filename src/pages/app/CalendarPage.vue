<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { CalendarEvent, ChevronLeft, ChevronRight, MapPin } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { getCalendar, type CalendarDay } from '@/api/discover'
import type { EventCard } from '@/api/events'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import EventThumb from '@/components/app/EventThumb.vue'
import BackLink from '@/components/app/BackLink.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import { formatRupiah, formatTime } from '@/utils/format'
import { mediaAt } from '@/utils/media'

const { t, locale } = useI18n()
useHeaderTone(computed(() => 'light'))
useHead({ title: computed(() => t('cal.title')) })
const apiMessage = useApiMessage()
const route = useRoute()
const router = useRouter()

const today = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD lokal
const nowMonth = today.slice(0, 7)
const month = computed(() => {
  const m = String(route.query.bulan ?? '')
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : nowMonth
})
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const days = ref<CalendarDay[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const picked = ref<string | null>(null)
const genre = ref('')

let ctl: AbortController | null = null
async function load(): Promise<void> {
  ctl?.abort()
  ctl = new AbortController()
  state.value = 'loading'
  picked.value = null
  try {
    days.value = await getCalendar(month.value, ctl.signal)
    state.value = 'ok'
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_CANCELED') return
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
watch(month, load, { immediate: true })

// Genre yang ada bulan ini -> chip filter; warna genre stabil dari namanya.
const genres = computed(() =>
  [
    ...new Set(days.value.flatMap((d) => d.events.map((e) => e.genre ?? '')).filter(Boolean)),
  ].sort(),
)
const hue = (g: string | null) => {
  let h = 0
  for (const c of g ?? '') h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}
const dayEvents = (d: CalendarDay) =>
  d.events.filter((e) => !genre.value || e.genre === genre.value)
const byDate = computed(() => {
  const m = new Map<string, EventCard[]>()
  for (const d of days.value) {
    const evs = dayEvents(d)
    if (evs.length) m.set(d.date, evs)
  }
  return m
})
const all = computed(() =>
  [...byDate.value.entries()].flatMap(([date, evs]) => evs.map((e) => ({ date, e }))),
)
const venues = computed(() => new Set(all.value.map((x) => x.e.city)).size)

const label = computed(() =>
  new Intl.DateTimeFormat(bcp.value, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month.value}-01T00:00:00Z`),
  ),
)
const weekdays = computed(() => {
  const f = new Intl.DateTimeFormat(bcp.value, { weekday: 'short', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i)))) // Sen..Min
})
const cells = computed(() => {
  const [y, m] = month.value.split('-').map(Number) as [number, number]
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => `${month.value}-${String(i + 1).padStart(2, '0')}`),
  ]
})
const yearNum = computed(() => Number(month.value.slice(0, 4)))
const monthNum = computed(() => Number(month.value.slice(5, 7)))
const monthNames = computed(() => {
  const f = new Intl.DateTimeFormat(bcp.value, { month: 'long', timeZone: 'UTC' })
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2024, i, 1))))
})
// Tahun yang bisa dipilih: tahun lalu sampai 4 tahun ke depan, plus tahun terpilih bila di luar rentang (URL).
const years = computed(() => {
  const y = Number(today.slice(0, 4))
  const base = Array.from({ length: 6 }, (_, i) => y - 1 + i)
  return base.includes(yearNum.value) ? base : [...base, yearNum.value].sort((a, b) => a - b)
})
const nextMonth = computed(() => {
  const [y, m] = nowMonth.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)
})
function goMonth(m: string): void {
  void router.replace({ query: m === nowMonth ? {} : { bulan: m } })
}
function jump(y: number, m: number): void {
  goMonth(`${y}-${String(m).padStart(2, '0')}`)
}
function shift(n: number): void {
  const [y, m] = month.value.split('-').map(Number) as [number, number]
  void router.replace({
    query: { bulan: new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7) },
  })
}
// Panel agenda: tanggal terpilih; tanpa pilihan = semua konser bulan ini berurutan.
const agenda = computed(() =>
  picked.value
    ? (byDate.value.get(picked.value) ?? []).map((e) => ({ date: picked.value as string, e }))
    : all.value,
)
const dayNum = (d: string) => Number(d.slice(8))
const longDate = (d: string) =>
  new Intl.DateTimeFormat(bcp.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${d}T00:00:00Z`))
const stateLabel = (e: EventCard) => t(`events.state.${e.sale_state}`)
</script>

<template>
  <ToneLight class="tone-page">
    <div class="cal">
      <BackLink plain class="pg-back" />
      <header class="cal__top">
        <div>
          <p class="a-caps">{{ t('cal.kicker') }}</p>
          <h1 class="a-serif">{{ t('cal.title') }}</h1>
          <p class="a-muted">{{ t('cal.lead') }}</p>
        </div>
        <div class="cal__stats" aria-live="polite">
          <span
            ><strong>{{ all.length }}</strong> {{ t('cal.statEvents') }}</span
          >
          <span
            ><strong>{{ venues }}</strong> {{ t('cal.statCities') }}</span
          >
        </div>
      </header>

      <div class="cal__bar">
        <div class="cal__nav">
          <button
            type="button"
            class="cal__arrow"
            :aria-label="t('cal.prev')"
            data-test="cal-prev"
            @click="shift(-1)"
          >
            <NIcon :component="ChevronLeft" :size="20" />
          </button>
          <div class="cal__pick" data-test="cal-month" role="group" :aria-label="t('cal.jump')">
            <label class="sr-only" for="cal-mo">{{ t('cal.month') }}</label>
            <select
              id="cal-mo"
              class="cal__sel a-select"
              :value="monthNum"
              data-test="cal-select-month"
              @change="jump(yearNum, Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="(m, i) in monthNames" :key="m" :value="i + 1">{{ m }}</option>
            </select>
            <label class="sr-only" for="cal-yr">{{ t('cal.year') }}</label>
            <select
              id="cal-yr"
              class="cal__sel a-select"
              :value="yearNum"
              data-test="cal-select-year"
              @change="jump(Number(($event.target as HTMLSelectElement).value), monthNum)"
            >
              <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
          <span class="sr-only" aria-live="polite">{{ label }}</span>
          <button
            type="button"
            class="cal__arrow"
            :aria-label="t('cal.next')"
            data-test="cal-next"
            @click="shift(1)"
          >
            <NIcon :component="ChevronRight" :size="20" />
          </button>
          <button
            type="button"
            class="a-pill"
            :class="{ 'a-pill--solid': month === nowMonth }"
            data-test="cal-this"
            @click="goMonth(nowMonth)"
          >
            {{ t('cal.today') }}
          </button>
          <button
            type="button"
            class="a-pill"
            :class="{ 'a-pill--solid': month === nextMonth }"
            data-test="cal-nextmonth"
            @click="goMonth(nextMonth)"
          >
            {{ t('cal.nextMonth') }}
          </button>
        </div>
        <ul v-if="genres.length" class="cal__chips" :aria-label="t('cal.genre')">
          <li>
            <button
              type="button"
              class="cal__chip"
              :class="{ 'is-on': !genre }"
              :aria-pressed="!genre"
              @click="genre = ''"
            >
              {{ t('cal.allGenres') }}
            </button>
          </li>
          <li v-for="g in genres" :key="g">
            <button
              type="button"
              class="cal__chip"
              :class="{ 'is-on': genre === g }"
              :aria-pressed="genre === g"
              @click="genre = genre === g ? '' : g"
            >
              <i
                class="cal__swatch"
                :style="{ background: `hsl(${hue(g)} 62% 46%)` }"
                aria-hidden="true"
              />{{ g }}
            </button>
          </li>
        </ul>
      </div>

      <ErrorState v-if="state === 'error'" :message="err" @retry="load" />
      <div v-else class="cal__body">
        <div class="cal__grid" role="grid" :aria-busy="state === 'loading'" :aria-label="label">
          <span v-for="w in weekdays" :key="w" class="cal__w" role="columnheader">{{ w }}</span>
          <template v-for="(c, i) in cells" :key="c ?? `e${i}`">
            <span v-if="!c" class="cal__empty" role="gridcell" />
            <button
              v-else
              type="button"
              role="gridcell"
              class="cal__d"
              :class="{
                'cal__d--on': byDate.has(c),
                'cal__d--pick': picked === c,
                'cal__d--today': c === today,
                'cal__d--past': c < today,
              }"
              :disabled="!byDate.has(c)"
              :aria-pressed="picked === c"
              :aria-current="c === today ? 'date' : undefined"
              :aria-label="t('cal.dayLabel', { d: dayNum(c), n: byDate.get(c)?.length ?? 0 })"
              data-test="cal-day"
              @click="picked = picked === c ? null : c"
            >
              <!-- Latar sel hanya hiasan 70 px. Dulu URL mentah (800 px) dipakai, jadi tiap poster
                   diunduh dua kali: 800 px untuk latar dan 400 px untuk thumbnail di panel hari. -->
              <img
                v-if="byDate.get(c)?.[0]?.poster_url"
                class="cal__bg"
                :src="mediaAt(byDate.get(c)?.[0]?.poster_url, 400)"
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span class="cal__n">{{ dayNum(c) }}</span>
              <span v-if="byDate.has(c)" class="cal__t">
                <span class="cal__title">{{ byDate.get(c)?.[0]?.title }}</span>
                <span v-if="(byDate.get(c)?.length ?? 0) > 1" class="cal__more"
                  >+{{ (byDate.get(c)?.length ?? 1) - 1 }}</span
                >
              </span>
              <span v-if="byDate.has(c)" class="cal__dots" aria-hidden="true">
                <i
                  v-for="e in byDate.get(c)?.slice(0, 3)"
                  :key="e.id"
                  :style="{ background: `hsl(${hue(e.genre)} 70% 58%)` }"
                />
              </span>
            </button>
          </template>
        </div>

        <aside class="cal__agenda" data-test="cal-agenda" aria-live="polite">
          <h2 class="cal__ah a-serif">
            <NIcon :component="CalendarEvent" :size="20" aria-hidden="true" />
            {{ picked ? longDate(picked) : t('cal.thisMonth') }}
          </h2>
          <button v-if="picked" type="button" class="cal__clear" @click="picked = null">
            {{ t('cal.showAll') }}
          </button>
          <EmptyState
            v-if="state === 'ok' && !agenda.length"
            :title="t('cal.empty')"
            :body="t('cal.emptyBody')"
          >
            <RouterLink :to="{ name: 'events' }" class="a-pill a-pill--solid">{{
              t('cal.all')
            }}</RouterLink>
          </EmptyState>
          <div
            v-else-if="state === 'loading'"
            class="a-sk"
            style="min-height: 200px; border-radius: 16px"
            role="status"
            :aria-label="t('common.loading')"
          />
          <ul v-else class="cal__list" data-test="cal-events">
            <li v-for="x in agenda" :key="x.e.id">
              <RouterLink :to="{ name: 'event', params: { slug: x.e.slug } }" class="cal__row">
                <span class="cal__date" :style="{ '--g': `hsl(${hue(x.e.genre)} 62% 46%)` }">
                  <strong>{{ dayNum(x.date) }}</strong>
                  <small>{{
                    new Intl.DateTimeFormat(bcp, { weekday: 'short', timeZone: 'UTC' }).format(
                      new Date(`${x.date}T00:00:00Z`),
                    )
                  }}</small>
                </span>
                <EventThumb :src="x.e.poster_url" :title="x.e.title" :w="64" :h="80" />
                <span class="cal__info">
                  <strong>{{ x.e.title }}</strong>
                  <small class="cal__meta"
                    ><NIcon :component="MapPin" :size="14" aria-hidden="true" />
                    {{ x.e.venue_name }}, {{ x.e.city }}</small
                  >
                  <small class="a-muted"
                    >{{ formatTime(x.e.starts_at, x.e.tz, bcp) }} ·
                    {{ x.e.genre ?? t('events.genreNone') }}</small
                  >
                  <small class="cal__price">
                    <template v-if="x.e.min_final_price != null">{{
                      t('events.from', { price: formatRupiah(x.e.min_final_price, bcp) })
                    }}</template>
                    <span class="cal__state" :class="`is-${x.e.sale_state}`">{{
                      stateLabel(x.e)
                    }}</span>
                  </small>
                </span>
              </RouterLink>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  </ToneLight>
</template>

<style scoped>
.cal {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px var(--a-pad) 72px;
  display: grid;
  gap: 20px;
}
.cal__top {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 16px;
  flex-wrap: wrap;
}
.cal h1 {
  margin: 0;
  font-size: clamp(34px, 5vw, 56px);
  color: var(--a-cream);
}
.cal__top p {
  margin: 6px 0 0;
  max-width: 56ch;
}
.cal__stats {
  display: flex;
  gap: 10px;
}
.cal__stats span {
  padding: 10px 16px;
  border: 1px solid var(--a-line);
  border-radius: 14px;
  background: var(--a-panel);
  color: var(--a-muted);
}
.cal__stats strong {
  color: var(--a-ink);
  font-size: 22px;
  margin-right: 4px;
}
.cal__bar {
  display: grid;
  gap: 12px;
}
.cal__nav {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.cal__arrow {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid var(--a-line-strong);
  background: var(--a-panel);
  color: var(--a-ink);
  cursor: pointer;
}
.cal__arrow:hover,
.cal__arrow:focus-visible {
  border-color: var(--a-gold);
}
.cal__pick {
  display: flex;
  gap: 10px;
}
.cal__sel {
  font-size: 16px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.cal__m {
  min-width: 11ch;
  text-align: center;
  font-size: 26px;
  text-transform: capitalize;
  color: var(--a-cream);
}
.cal__chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.cal__chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--a-line-strong);
  background: transparent;
  color: var(--a-ink);
  font: inherit;
  cursor: pointer;
}
.cal__chip.is-on {
  background: var(--a-ink);
  color: var(--a-bg);
  border-color: var(--a-ink);
}
.cal__swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.cal__body {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr);
  align-items: start;
}
.cal__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}
.cal__w {
  text-align: center;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--a-muted);
  padding: 4px 0;
}
.cal__d,
.cal__empty {
  min-height: 96px;
  border-radius: 14px;
}
.cal__d {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr auto;
  text-align: left;
  padding: 8px;
  border: 1px solid var(--a-line);
  background: transparent;
  color: var(--a-muted);
  font: inherit;
}
.cal__d--past {
  opacity: 0.55;
}
.cal__d--today {
  border-color: var(--a-gold);
  box-shadow: inset 0 0 0 1px var(--a-gold);
  opacity: 1;
}
.cal__d--on {
  background: #1b1814;
  color: #fff;
  border-color: transparent;
  cursor: pointer;
  opacity: 1;
}
.cal__d--on:hover,
.cal__d--on:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.25);
}
.cal__d--pick {
  outline: 3px solid var(--a-gold);
  outline-offset: 1px;
}
.cal__d:focus-visible {
  outline: 3px solid var(--a-gold);
  outline-offset: 2px;
}
.cal__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.55;
}
.cal__d--on::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgb(0 0 0 / 0.1), rgb(0 0 0 / 0.78));
}
.cal__d > * {
  position: relative;
  z-index: 1;
}
.cal__n {
  font-weight: 700;
  font-size: 15px;
}
.cal__d--today .cal__n {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--a-gold);
  color: var(--a-on-gold);
}
.cal__t {
  align-self: end;
  display: grid;
  gap: 2px;
  font-size: 12px;
  line-height: 1.25;
}
.cal__title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-weight: 600;
}
.cal__more {
  font-weight: 700;
  color: var(--a-gold);
}
.cal__dots {
  display: none;
  gap: 3px;
}
.cal__dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.cal__agenda {
  position: sticky;
  top: 88px;
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--a-line);
  border-radius: 20px;
  background: var(--a-panel);
  max-height: calc(100vh - 110px);
  overflow: auto;
}
.cal__ah {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
}
.cal__clear {
  justify-self: start;
  background: none;
  border: 0;
  padding: 0;
  color: var(--a-gold-d, var(--a-gold));
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.cal__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.cal__row {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 12px;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  color: var(--a-ink);
  text-decoration: none;
  background: var(--a-bg);
}
.cal__row:hover,
.cal__row:focus-visible {
  border-color: var(--a-gold);
}
.cal__date {
  display: grid;
  place-items: center;
  width: 48px;
  padding: 6px 0;
  border-radius: 12px;
  background: var(--g, var(--a-gold));
  color: #fff;
  line-height: 1.1;
}
.cal__date strong {
  font-size: 20px;
}
.cal__date small {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.cal__info {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.cal__info strong {
  font-size: 15px;
  line-height: 1.3;
}
.cal__meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--a-muted);
}
.cal__price {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-weight: 600;
}
.cal__state {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: rgb(217 185 121 / 0.2);
  color: var(--a-gold-d, var(--a-gold));
}
.cal__state.is-sold_out,
.cal__state.is-full_booked,
.cal__state.is-cancelled,
.cal__state.is-ended {
  background: rgb(120 120 120 / 0.2);
  color: var(--a-muted);
}
.cal__state.is-onsale {
  background: rgb(46 160 90 / 0.16);
  color: var(--a-ok, #2a9d5c);
}
@media (max-width: 960px) {
  .cal__body {
    grid-template-columns: 1fr;
  }
  .cal__agenda {
    position: static;
    max-height: none;
  }
}
@media (max-width: 640px) {
  .cal__grid {
    gap: 4px;
  }
  .cal__d,
  .cal__empty {
    min-height: 54px;
    padding: 5px;
    border-radius: 10px;
  }
  .cal__t {
    display: none;
  }
  .cal__dots {
    display: flex;
  }
  .cal__bg {
    display: none;
  }
  .cal__d--on {
    background: var(--a-panel);
    color: var(--a-ink);
    border-color: var(--a-line-strong);
  }
  .cal__d--on::after {
    display: none;
  }
  .cal__row {
    grid-template-columns: auto 1fr;
  }
  .cal__row :deep(.th) {
    display: none;
  }
  .cal__m {
    font-size: 22px;
    min-width: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cal__d--on:hover {
    transform: none;
  }
}
</style>
