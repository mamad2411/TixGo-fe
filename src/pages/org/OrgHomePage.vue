<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Calendar, CurrencyDollar, Ticket, Armchair } from '@vicons/tabler'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { listOrgEvents, type OrgEvent } from '@/api/organizer'
import ErrorState from '@/components/app/ErrorState.vue'
import EventThumb from '@/components/app/EventThumb.vue'
import KpiCard from '@/components/dash/KpiCard.vue'
import PageHeader from '@/components/dash/PageHeader.vue'
import StatusTag from '@/components/dash/StatusTag.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { formatEventDate, formatRupiah } from '@/utils/format'

const { t, locale } = useI18n()
useHead({ title: computed(() => t('dash.nav.org-home')) })
const apiMessage = useApiMessage()
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))

const rows = ref<OrgEvent[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = (await listOrgEvents()).data
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

// ---- angka (dihitung dari data event yang sama dengan daftar; tidak ada angka tersembunyi) ----
const sold = computed(() =>
  rows.value.reduce((a, e) => a + e.tiers.reduce((x, k) => x + k.sold, 0), 0),
)
const quota = computed(() =>
  rows.value.reduce((a, e) => a + e.tiers.reduce((x, k) => x + k.quota, 0), 0),
)
const left = computed(() =>
  rows.value.reduce(
    (a, e) => a + e.tiers.reduce((x, k) => x + Math.max(0, k.quota - k.sold - k.held), 0),
    0,
  ),
)
const gross = computed(() =>
  rows.value.reduce((a, e) => a + e.tiers.reduce((x, k) => x + k.sold * k.price, 0), 0),
)
const published = computed(() => rows.value.filter((e) => e.status === 'published').length)
const nf = (n: number) => new Intl.NumberFormat(bcp.value).format(n)

// ---- langkah berikutnya: satu hal paling penting sekarang (docs/24 §3.1) ----
type Next = { key: 'none' | 'draft' | 'in_review' | 'approved' | 'done'; ev?: OrgEvent }
const next = computed<Next>(() => {
  const by = (s: string) => rows.value.find((e) => e.status === s)
  if (!rows.value.length) return { key: 'none' }
  const approved = by('approved')
  if (approved) return { key: 'approved', ev: approved }
  const draft = by('draft')
  if (draft) return { key: 'draft', ev: draft }
  const review = by('in_review')
  if (review) return { key: 'in_review', ev: review }
  return { key: 'done' }
})
const nextTo = computed(() =>
  next.value.ev
    ? { name: 'org-event', params: { id: next.value.ev.id } }
    : { name: 'org-event-new' },
)
const recent = computed(() =>
  [...rows.value].sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 5),
)
const pct = (e: OrgEvent): number => {
  const q = e.tiers.reduce((a, k) => a + k.quota, 0)
  const s = e.tiers.reduce((a, k) => a + k.sold, 0)
  return q ? Math.min(100, Math.round((s / q) * 100)) : 0
}
</script>

<template>
  <div data-test="org-home">
    <PageHeader :title="t('dash.home.title')" :lead="t('dash.home.lead')">
      <RouterLink
        :to="{ name: 'org-event-new' }"
        class="a-pill a-pill--solid"
        data-test="new-event"
      >
        {{ t('org.event.new') }}
      </RouterLink>
    </PageHeader>

    <ErrorState v-if="state === 'error'" :message="err" @retry="load" />

    <template v-else>
      <section
        class="nx"
        :class="`is-${next.key}`"
        :aria-label="t('dash.home.nextLabel')"
        data-test="next-step"
      >
        <p class="a-caps nx__k">{{ t('dash.home.nextLabel') }}</p>
        <div v-if="state === 'loading'" class="nx__sk a-sk" aria-hidden="true" />
        <template v-else>
          <h2 class="a-serif nx__t">
            {{ t(`dash.home.next.${next.key}.t`, { title: next.ev?.title ?? '' }) }}
          </h2>
          <p class="nx__b">{{ t(`dash.home.next.${next.key}.b`) }}</p>
          <RouterLink :to="nextTo" class="a-pill a-pill--solid nx__cta">
            {{ t(`dash.home.next.${next.key}.cta`) }}
          </RouterLink>
        </template>
      </section>

      <section class="kp" :aria-label="t('dash.home.kpiLabel')">
        <KpiCard
          :label="t('dash.home.kpi.events')"
          :value="nf(rows.length)"
          :hint="t('dash.home.kpi.eventsHint', { n: published })"
          :icon="Calendar"
          :loading="state === 'loading'"
        />
        <KpiCard
          :label="t('dash.home.kpi.sold')"
          :value="nf(sold)"
          :hint="t('dash.home.kpi.soldHint', { n: nf(quota) })"
          :icon="Ticket"
          tone="gold"
          :loading="state === 'loading'"
        />
        <KpiCard
          :label="t('dash.home.kpi.left')"
          :value="nf(left)"
          :hint="t('dash.home.kpi.leftHint')"
          :icon="Armchair"
          :loading="state === 'loading'"
        />
        <KpiCard
          :label="t('dash.home.kpi.gross')"
          :value="formatRupiah(gross, bcp)"
          :hint="t('dash.home.kpi.grossHint')"
          :icon="CurrencyDollar"
          :loading="state === 'loading'"
        />
      </section>

      <section v-if="state === 'ok' && recent.length" class="rc" data-test="recent">
        <header class="rc__h">
          <h2 class="a-serif rc__t">{{ t('dash.home.recent') }}</h2>
          <RouterLink :to="{ name: 'org-events' }" class="rc__all">{{
            t('dash.home.viewAll')
          }}</RouterLink>
        </header>
        <ul class="rc__list">
          <li v-for="e in recent" :key="e.id">
            <RouterLink :to="{ name: 'org-event', params: { id: e.id } }" class="rc__row">
              <EventThumb :src="e.poster_url" :title="e.title" :w="48" :h="60" />
              <span class="rc__m">
                <strong>{{ e.title }}</strong>
                <small class="a-muted">
                  {{ e.venue?.name
                  }}<template v-if="e.venue">
                    · {{ formatEventDate(e.starts_at, e.venue.tz, bcp) }}</template
                  >
                </small>
                <span
                  class="rc__bar"
                  role="img"
                  :aria-label="t('dash.home.soldPct', { n: pct(e) })"
                >
                  <i :style="{ width: `${pct(e)}%` }" />
                </span>
              </span>
              <StatusTag :status="e.status" />
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.nx {
  display: grid;
  justify-items: start;
  gap: 8px;
  margin-bottom: 20px;
  padding: 22px;
  border: 1px solid var(--a-line-strong);
  border-radius: 20px;
  background: linear-gradient(135deg, rgb(224 178 94 / 0.14), transparent 70%), var(--a-panel);
}
.nx__k {
  margin: 0;
}
.nx__t {
  margin: 0;
  color: var(--a-cream);
  font-size: clamp(26px, 3.6vw, 36px);
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.nx__b {
  max-width: 60ch;
  margin: 0;
  color: var(--a-muted);
}
.nx__cta {
  margin-top: 8px;
}
.nx__sk {
  width: 100%;
  min-height: 96px;
  border-radius: 12px;
}
.kp {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  margin-bottom: 28px;
}
.rc__h {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.rc__t {
  margin: 0;
  color: var(--a-cream);
  font-size: 26px;
}
.rc__all {
  color: var(--a-gold);
  font-size: 14px;
  font-weight: 600;
}
.rc__list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rc__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px 14px;
  min-height: 64px;
  padding: 10px 14px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
  color: var(--a-ink);
  text-decoration: none;
}
.rc__row:hover {
  border-color: var(--a-line-strong);
}
.rc__row > :last-child {
  grid-column: 2;
  justify-self: start;
}
.rc__m {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.rc__m strong {
  overflow-wrap: anywhere;
}
.rc__bar {
  display: block;
  height: 6px;
  border-radius: 999px;
  background: var(--a-line);
  overflow: hidden;
}
.rc__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--a-gold);
}
@media (min-width: 720px) {
  .rc__row {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .rc__row > :last-child {
    grid-column: 3;
    justify-self: end;
  }
}
</style>
