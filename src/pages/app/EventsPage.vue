<script setup lang="ts">
import { AdjustmentsHorizontal, CalendarOff } from '@vicons/tabler'
import axios from 'axios'
import { NIcon } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'

import { listEvents, type EventCard as EventCardT, type Page } from '@/api/events'
import BackLink from '@/components/app/BackLink.vue'
import ConcertBackdrop from '@/components/app/ConcertBackdrop.vue'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import EventCard from '@/components/app/EventCard.vue'
import EventCardSkeleton from '@/components/app/EventCardSkeleton.vue'
import EventRail from '@/components/app/EventRail.vue'
import RecommendedRail from '@/components/app/RecommendedRail.vue'
import { clearRecentlyViewed, readRecentlyViewed } from '@/composables/useRecentlyViewed'
import FilterBar from '@/components/app/FilterBar.vue'
import HeroSpotlight from '@/components/app/HeroSpotlight.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import { activeCount, filtersFromQuery, toApiQuery, type Filters } from '@/utils/filters'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const apiMessage = useApiMessage()

const filters = computed<Filters>(() => filtersFromQuery(route.query))
// Mode terfilter hanya bila ada filter. Urutan (sort) cuma mengatur isi "Semua konser"; hero & rail tetap.
const hasFilters = computed(() => activeCount(filters.value) > 0 || !!filters.value.koleksi)
// Tanpa hero, hasil langsung berada di bawah header: header ikut terang.
useHeaderTone(computed(() => (hasFilters.value ? 'light' : 'dark')))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))

// Filter = sumber kebenaran di query-string supaya bisa dibagikan dan tombol Kembali berfungsi (docs/09 F2).
function setFilters(f: Filters): void {
  const q: LocationQueryRaw = {}
  for (const [k, v] of Object.entries(f)) if (v) q[k] = String(v)
  void router.push({ name: 'events', query: q })
}
function goPage(p: number): void {
  void router.push({ query: { ...route.query, page: p > 1 ? String(p) : undefined } })
}

// ---- seluruh katalog (untuk spotlight, rail, dan facet kota/genre) ----
const all = ref<EventCardT[]>([])
const allState = ref<'loading' | 'ok' | 'error'>('loading')
const allError = ref('')
async function loadAll(): Promise<void> {
  allState.value = 'loading'
  try {
    all.value = (await listEvents({ per_page: 50, sort: filters.value.sort || undefined })).data
    allState.value = 'ok'
  } catch (e) {
    allError.value = apiMessage(e)
    allState.value = 'error'
  }
}
onMounted(loadAll)
watch(() => filters.value.sort, loadAll) // urutan baru -> muat ulang urutan "Semua konser"

function facet(pick: (e: EventCardT) => string | null): { name: string; count: number }[] {
  const m = new Map<string, number>()
  for (const e of all.value) {
    const k = pick(e)
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
const cities = computed(() => facet((e) => e.city))
const genres = computed(() => facet((e) => e.genre))

const spotlight = computed(() =>
  all.value
    .filter((e) => e.poster_url && ['onsale', 'upcoming'].includes(e.sale_state))
    .sort(
      (a, b) =>
        Number(b.almost_gone) - Number(a.almost_gone) ||
        Number(b.queue_required) - Number(a.queue_required) ||
        a.starts_at.localeCompare(b.starts_at),
    )
    .slice(0, 5),
)
const almostGone = computed(() =>
  all.value.filter((e) => e.sale_state === 'onsale' && e.almost_gone),
)
// "Terakhir kamu lihat": slug dari perangkat dicocokkan ke katalog yang sudah dimuat (konser tak ada lagi dilewati).
const viewedSlugs = ref<string[]>(readRecentlyViewed())
const viewed = computed(() =>
  viewedSlugs.value
    .map((s) => all.value.find((e) => e.slug === s))
    .filter((e): e is EventCardT => !!e)
    .slice(0, 8),
)
function clearViewed(): void {
  clearRecentlyViewed()
  viewedSlugs.value = []
}
const upcoming = computed(() => all.value.filter((e) => e.sale_state === 'upcoming'))
const everything = computed(() => all.value) // urutan dari server (date|new|popular)

// ---- hasil terfilter (server) ----
const res = ref<Page<EventCardT> | null>(null)
const resState = ref<'idle' | 'loading' | 'ok' | 'error'>('idle')
const resError = ref('')
let ctrl: AbortController | undefined
async function loadFiltered(): Promise<void> {
  if (!hasFilters.value) {
    resState.value = 'idle'
    return
  }
  ctrl?.abort()
  ctrl = new AbortController()
  resState.value = 'loading'
  try {
    res.value = await listEvents(
      toApiQuery(filters.value, page.value, filters.value.koleksi === 'hot' ? 50 : 12),
      ctrl.signal,
    )
    resState.value = 'ok'
  } catch (e) {
    if (axios.isCancel(e)) return
    resError.value = apiMessage(e)
    resState.value = 'error'
  }
}
watch(() => route.fullPath, loadFiltered, { immediate: true })
onBeforeUnmount(() => ctrl?.abort())

// "Hampir habis" dihitung di BE per kartu, jadi disaring di klien dari satu halaman besar (tanpa halaman).
const shown = computed(() =>
  filters.value.koleksi === 'hot'
    ? (res.value?.data ?? []).filter((e) => e.almost_gone)
    : (res.value?.data ?? []),
)
const totalPages = computed(() =>
  res.value && filters.value.koleksi !== 'hot'
    ? Math.max(1, Math.ceil(res.value.meta.total / res.value.meta.per_page))
    : 1,
)
const detail = (e: EventCardT) => ({ name: 'event', params: { slug: e.slug } })
</script>

<template>
  <div class="cat">
    <h1 class="a-sr">{{ t('events.title') }}</h1>

    <HeroSpotlight
      v-if="!hasFilters && allState === 'ok' && spotlight.length"
      :events="spotlight"
    />
    <div
      v-else-if="!hasFilters && allState === 'loading'"
      class="cat__hero-sk a-sk"
      aria-hidden="true"
    />

    <ToneLight class="cat__band">
      <ConcertBackdrop />
      <div class="cat__wrap" :class="{ 'has-hero': !hasFilters }">
        <FilterBar
          :model-value="filters"
          :cities="cities"
          :genres="genres"
          @update:model-value="setFilters"
        />

        <!-- Mode jelajah: rail + semua konser -->
        <template v-if="!hasFilters">
          <ErrorState v-if="allState === 'error'" :message="allError" @retry="loadAll" />
          <div
            v-else-if="allState === 'loading'"
            class="cat__grid"
            role="status"
            :aria-label="t('common.loading')"
          >
            <EventCardSkeleton v-for="n in 6" :key="n" />
          </div>
          <template v-else>
            <RecommendedRail class="cat__sec" />
            <EventRail
              v-if="viewed.length"
              :kicker="t('events.viewedKicker')"
              :title="t('events.viewed')"
              class="cat__sec"
              data-test="viewed"
            >
              <li v-for="e in viewed" :key="e.id"><EventCard :event="e" :to="detail(e)" /></li>
              <template #extra>
                <button type="button" class="a-pill" data-test="viewed-clear" @click="clearViewed">
                  {{ t('events.viewedClear') }}
                </button>
              </template>
            </EventRail>
            <EventRail
              v-if="almostGone.length"
              :kicker="t('events.railHotKicker')"
              :title="t('events.railHot')"
              :to="{ name: 'events', query: { koleksi: 'hot' } }"
              :count="almostGone.length"
              class="cat__sec"
            >
              <li v-for="e in almostGone" :key="e.id"><EventCard :event="e" :to="detail(e)" /></li>
            </EventRail>

            <EventRail
              v-if="upcoming.length"
              :kicker="t('events.railSoonKicker')"
              :title="t('events.railSoon')"
              :to="{ name: 'events', query: { koleksi: 'soon' } }"
              :count="upcoming.length"
              class="cat__sec"
            >
              <li v-for="e in upcoming" :key="e.id"><EventCard :event="e" :to="detail(e)" /></li>
            </EventRail>

            <section class="cat__sec">
              <header class="cat__head cat__head--row">
                <div class="cat__headtxt">
                  <p class="a-caps">{{ t('events.allKicker') }}</p>
                  <h2 class="a-serif cat__title">{{ t('events.all') }}</h2>
                  <p class="a-muted" aria-live="polite" data-test="count">
                    {{ t('events.count', { n: everything.length }) }}
                  </p>
                </div>
                <RouterLink
                  :to="{ name: 'events', query: { koleksi: 'all' } }"
                  class="a-pill cat__all"
                  data-test="all-link"
                >
                  <NIcon :component="AdjustmentsHorizontal" :size="18" aria-hidden="true" />
                  {{ t('events.seeAllWithFilters') }}
                </RouterLink>
              </header>
              <ul class="cat__grid cat__grid--bento" data-test="event-list">
                <li v-for="(e, n) in everything" :key="e.id" :class="{ 'is-wide': n === 0 }">
                  <EventCard :event="e" :to="detail(e)" :size="n === 0 ? 'lg' : 'md'" />
                </li>
              </ul>
            </section>
          </template>
        </template>

        <!-- Mode terfilter -->
        <section v-else class="cat__sec">
          <header v-if="filters.koleksi" class="cat__head" data-test="collection-head">
            <p class="a-caps">{{ t(`events.col.${filters.koleksi}.kicker`) }}</p>
            <h2 class="a-serif cat__title">{{ t(`events.col.${filters.koleksi}.title`) }}</h2>
            <p class="a-muted">{{ t(`events.col.${filters.koleksi}.body`) }}</p>
            <BackLink plain class="cat__back" :label="t('events.backToAll')" />
          </header>
          <div
            v-if="resState === 'loading' || resState === 'idle'"
            class="cat__grid"
            role="status"
            :aria-label="t('common.loading')"
          >
            <EventCardSkeleton v-for="n in 6" :key="n" />
          </div>
          <ErrorState v-else-if="resState === 'error'" :message="resError" @retry="loadFiltered" />
          <template v-else-if="res">
            <EmptyState
              v-if="shown.length === 0"
              :icon="CalendarOff"
              :title="t('events.emptySearchTitle')"
              :body="t('events.emptyFilterBody')"
            >
              <button
                type="button"
                class="a-pill"
                @click="
                  setFilters({
                    ...filters,
                    q: '',
                    city: '',
                    genre: '',
                    status: '',
                    when: '',
                    price: '',
                  })
                "
              >
                {{ t('events.clearSearch') }}
              </button>
            </EmptyState>
            <template v-else>
              <p class="a-muted cat__count" aria-live="polite" data-test="count">
                {{
                  t('events.count', {
                    n: filters.koleksi === 'hot' ? shown.length : res.meta.total,
                  })
                }}
              </p>
              <ul class="cat__grid" data-test="event-list">
                <li v-for="e in shown" :key="e.id"><EventCard :event="e" :to="detail(e)" /></li>
              </ul>
              <nav v-if="totalPages > 1" class="cat__pager" :aria-label="t('events.pager')">
                <button
                  type="button"
                  class="a-pill"
                  :disabled="page <= 1"
                  @click="goPage(page - 1)"
                >
                  {{ t('common.prev') }}
                </button>
                <span class="a-muted">{{ t('events.pageOf', { p: page, n: totalPages }) }}</span>
                <button
                  type="button"
                  class="a-pill"
                  :disabled="page >= totalPages"
                  @click="goPage(page + 1)"
                >
                  {{ t('common.next') }}
                </button>
              </nav>
            </template>
          </template>
        </section>
      </div>
    </ToneLight>
  </div>
</template>

<style scoped>
.cat__hero-sk {
  min-height: clamp(520px, 78vh, 760px);
}
.cat__band {
  position: relative;
  isolation: isolate;
  /* bagian krem bergaya landing: hero gelap lalu hasil di atas kertas; menyerap jarak ke footer */
  margin-bottom: 0;
  padding-bottom: 96px;
}
.cat__wrap {
  position: relative;
  z-index: 1;
  grid-template-columns: minmax(0, 1fr);
  max-width: var(--a-max);
  margin: 0 auto;
  padding: 28px var(--a-pad) 0;
  display: grid;
  gap: 56px;
}
@media (max-width: 899px) {
  .cat__wrap {
    gap: 36px;
    padding-top: 20px;
  }
  .cat__band {
    padding-bottom: 56px;
  }
  .cat__hero-sk {
    min-height: 420px;
  }
}
.cat__wrap.has-hero > :first-child {
  margin-top: -24px; /* filter bar menimpa tepi bawah hero; kontrol hero sudah diberi ruang aman */
  position: relative;
  z-index: 3;
}
.cat__sec {
  min-width: 0;
}
.cat__head {
  display: grid;
  gap: 4px;
  margin-bottom: 22px;
}
.cat__title {
  font-size: clamp(36px, 5vw, 64px);
  color: var(--a-cream);
}
.cat__head--row {
  gap: 20px;
  align-items: end;
}
.cat__headtxt {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.cat__all {
  justify-self: start;
}
@media (min-width: 720px) {
  .cat__head--row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .cat__all {
    justify-self: end;
    margin-bottom: 6px;
  }
}
.cat__count {
  margin-bottom: 16px;
  font-size: 14px;
}
.cat__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
}
@media (min-width: 900px) {
  .cat__wrap.has-hero > :first-child {
    margin-top: -48px;
  }
  .cat__grid--bento {
    grid-template-columns: repeat(4, 1fr);
  }
  .cat__grid--bento .is-wide {
    grid-column: span 2;
  }
}
.cat__grid li {
  min-width: 0;
}
.cat__pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 32px;
}
.a-pill:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.cat__back {
  justify-self: start;
  width: fit-content;
  margin-top: 8px;
}
</style>
