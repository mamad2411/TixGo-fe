<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { CurrencyDollar, Receipt2, Ticket, TrendingUp } from '@vicons/tabler'
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { getFunnel, getSales, type FunnelStage, type SeriesPoint } from '@/api/organizer'
import ErrorState from '@/components/app/ErrorState.vue'
import KpiCard from '@/components/dash/KpiCard.vue'
import { ORG_EVENT } from '@/components/dash/orgEventCtx'
import SalesChart from '@/components/dash/SalesChart.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { formatRupiah } from '@/utils/format'

const { t, locale } = useI18n()
useHead({ title: computed(() => t('dash.event.tab.sales')) })
const route = useRoute()
const apiMessage = useApiMessage()
const ctx = inject(ORG_EVENT)!
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const nf = (n: number) => new Intl.NumberFormat(bcp.value).format(n)
const rp = (n: number) => formatRupiah(n, bcp.value)
const day = (iso: string) =>
  new Intl.DateTimeFormat(bcp.value, { day: 'numeric', month: 'short' }).format(new Date(iso))

const days = ref<7 | 30 | 90>(30)
const metric = ref<'tickets' | 'revenue'>('tickets')
const points = ref<SeriesPoint[]>([])
const funnel = ref<FunnelStage[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
let seq = 0

async function load(): Promise<void> {
  const my = ++seq
  state.value = 'loading'
  const to = new Date()
  const from = new Date(to.getTime() - days.value * 86_400_000)
  try {
    const id = String(route.params.id)
    const [s, f] = await Promise.all([getSales(id, from, to), getFunnel(id)])
    if (my !== seq) return
    points.value = s
    funnel.value = f
    state.value = 'ok'
  } catch (e) {
    if (my !== seq) return
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
watch(days, load, { immediate: true })

const sum = (k: 'tickets' | 'orders' | 'revenue') => points.value.reduce((a, p) => a + p[k], 0)
const avg = computed(() => (sum('orders') ? Math.round(sum('revenue') / sum('orders')) : 0))
const empty = computed(() => state.value === 'ok' && sum('tickets') === 0)
const top = computed(() => funnel.value[0]?.count ?? 0)

// Kategori: terjual / ditahan / sisa dari data event (satu sumber dengan form).
const tiers = computed(() =>
  (ctx.ev.value?.tiers ?? []).map((k) => {
    const free = Math.max(0, k.quota - k.sold - k.held)
    const pct = (n: number) => (k.quota ? (n / k.quota) * 100 : 0)
    return { ...k, free, sp: pct(k.sold), hp: pct(k.held), left: Math.round(pct(free)) }
  }),
)
</script>

<template>
  <div data-test="org-sales">
    <div class="rg" role="group" :aria-label="t('dash.event.sales.range')">
      <button
        v-for="d in [7, 30, 90] as const"
        :key="d"
        type="button"
        :aria-pressed="days === d"
        @click="days = d"
      >
        {{ t('dash.event.sales.lastDays', { n: d }) }}
      </button>
    </div>

    <ErrorState v-if="state === 'error'" :message="err" @retry="load" />
    <template v-else>
      <section class="kp">
        <KpiCard
          :label="t('dash.event.sales.tickets')"
          :value="nf(sum('tickets'))"
          :hint="t('dash.event.sales.ticketsHint', { n: days })"
          :icon="Ticket"
          tone="gold"
          :loading="state === 'loading'"
        />
        <KpiCard
          :label="t('dash.event.sales.orders2')"
          :value="nf(sum('orders'))"
          :hint="t('dash.event.sales.ordersHint')"
          :icon="Receipt2"
          :loading="state === 'loading'"
        />
        <KpiCard
          :label="t('dash.event.sales.revenue')"
          :value="rp(sum('revenue'))"
          :hint="t('dash.event.sales.revenueHint')"
          :icon="CurrencyDollar"
          :loading="state === 'loading'"
        />
        <KpiCard
          :label="t('dash.event.sales.avg')"
          :value="rp(avg)"
          :hint="t('dash.event.sales.avgHint')"
          :icon="TrendingUp"
          :loading="state === 'loading'"
        />
      </section>

      <section class="card" data-test="sales-chart">
        <header class="card__h">
          <h2 class="a-serif card__t">{{ t('dash.event.sales.trend') }}</h2>
          <div class="seg" role="group" :aria-label="t('dash.event.sales.metric')">
            <button type="button" :aria-pressed="metric === 'tickets'" @click="metric = 'tickets'">
              {{ t('dash.event.sales.tickets') }}
            </button>
            <button type="button" :aria-pressed="metric === 'revenue'" @click="metric = 'revenue'">
              {{ t('dash.event.sales.revenue') }}
            </button>
          </div>
        </header>
        <div v-if="state === 'loading'" class="a-sk chart-sk" aria-hidden="true" />
        <div v-else-if="empty" class="empty" data-test="sales-empty">
          <strong>{{ t('dash.event.sales.emptyT') }}</strong>
          <p class="a-muted">{{ t('dash.event.sales.emptyB') }}</p>
        </div>
        <SalesChart
          v-else
          :points="points"
          :metric="metric"
          :format="metric === 'tickets' ? nf : rp"
          :day-label="day"
        />
      </section>

      <section class="card" data-test="tier-bars">
        <h2 class="a-serif card__t">{{ t('dash.event.sales.byTier') }}</h2>
        <p class="a-muted card__lead">{{ t('dash.event.sales.byTierLead') }}</p>
        <ul class="tb">
          <li v-for="k in tiers" :key="k.id">
            <div class="tb__top">
              <strong>{{ k.name }}</strong>
              <span class="a-muted">{{ rp(k.price) }}</span>
              <span class="tb__n">{{
                t('dash.event.sales.soldOf', { s: nf(k.sold), q: nf(k.quota) })
              }}</span>
            </div>
            <div
              class="tb__bar"
              role="img"
              :aria-label="t('dash.event.sales.tierAria', { s: k.sold, h: k.held, f: k.free })"
            >
              <i class="is-sold" :style="{ width: `${k.sp}%` }" />
              <i class="is-held" :style="{ width: `${k.hp}%` }" />
            </div>
            <small class="a-muted">{{
              t('dash.event.sales.tierLegend', { h: nf(k.held), f: nf(k.free), p: k.left })
            }}</small>
          </li>
        </ul>
        <p v-if="!tiers.length" class="a-muted">{{ t('dash.event.sales.noTier') }}</p>
      </section>

      <section v-if="funnel.length && top" class="card" data-test="sales-funnel">
        <h2 class="a-serif card__t">{{ t('dash.event.sales.funnel') }}</h2>
        <p class="a-muted card__lead">{{ t('dash.event.sales.funnelLead') }}</p>
        <ol class="fn">
          <li v-for="s in funnel" :key="s.stage">
            <span>{{ t(`dash.admin.stage.${s.stage}`, s.stage) }}</span>
            <span class="fn__bar" aria-hidden="true"
              ><i :style="{ width: `${Math.max(2, Math.round((s.count / top) * 100))}%` }"
            /></span>
            <b>{{ nf(s.count) }}</b>
            <small class="a-muted">{{
              s.conversion_from_prev ? `${Math.round(s.conversion_from_prev * 100)}%` : ''
            }}</small>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

<style scoped>
.rg,
.seg {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--a-line);
  border-radius: 999px;
  background: var(--a-panel);
}
.rg {
  margin-bottom: 16px;
}
.rg button,
.seg button {
  min-height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--a-muted);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.rg button[aria-pressed='true'],
.seg button[aria-pressed='true'] {
  background: rgb(224 178 94 / 0.18);
  color: var(--a-gold);
}
.kp {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  margin-bottom: 18px;
}
.card {
  margin-bottom: 18px;
  padding: 18px;
  border: 1px solid var(--a-line);
  border-radius: 20px;
  background: var(--a-panel);
}
.card__h {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.card__t {
  margin: 0;
  color: var(--a-cream);
  font-size: 24px;
}
.card__lead {
  margin: 4px 0 14px;
  font-size: 14px;
}
.chart-sk {
  min-height: 240px;
  border-radius: 12px;
}
.empty {
  display: grid;
  gap: 4px;
  padding: 34px 12px;
  border: 1px dashed var(--a-line-strong);
  border-radius: 14px;
  text-align: center;
}
.empty p {
  margin: 0;
}
.tb {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tb li {
  display: grid;
  gap: 6px;
}
.tb__top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}
.tb__n {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
}
.tb__bar {
  display: flex;
  height: 12px;
  border-radius: 999px;
  background: var(--a-line);
  overflow: hidden;
}
.tb__bar i {
  display: block;
  height: 100%;
}
.is-sold {
  background: var(--a-gold);
}
.is-held {
  background: repeating-linear-gradient(45deg, var(--a-gold) 0 3px, transparent 3px 6px);
  opacity: 0.6;
}
.fn {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.fn li {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: 'a c' 'b p';
  gap: 4px 12px;
  align-items: center;
  font-size: 14px;
}
.fn li > :nth-child(1) {
  grid-area: a;
  font-weight: 600;
}
.fn li > :nth-child(2) {
  grid-area: b;
}
.fn li > :nth-child(3) {
  grid-area: c;
  font-variant-numeric: tabular-nums;
}
.fn li > :nth-child(4) {
  grid-area: p;
  text-align: right;
  min-width: 36px;
}
.fn__bar {
  height: 8px;
  border-radius: 999px;
  background: var(--a-line);
  overflow: hidden;
}
.fn__bar i {
  display: block;
  height: 100%;
  background: var(--a-gold);
}
@media (min-width: 720px) {
  .fn li {
    grid-template-columns: 150px minmax(0, 1fr) 70px 44px;
    grid-template-areas: 'a b c p';
  }
}
</style>
