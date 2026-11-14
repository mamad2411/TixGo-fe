<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Clock, Receipt2, ShieldCheck } from '@vicons/tabler'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { getBusiness, listReviewEvents, type BusinessDashboard } from '@/api/admin'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import KpiCard from '@/components/dash/KpiCard.vue'
import PageHeader from '@/components/dash/PageHeader.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useAuthStore } from '@/stores/auth'

const { t, locale } = useI18n()
useHead({ title: computed(() => t('dash.nav.admin-home')) })
const apiMessage = useApiMessage()
const auth = useAuthStore()
const router = useRouter()
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const nf = (n: number) => new Intl.NumberFormat(bcp.value).format(n)

const data = ref<BusinessDashboard | null>(null)
const waiting = ref<number | null>(null)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const canReview = computed(() => auth.user?.role === 'admin')

async function load(): Promise<void> {
  state.value = 'loading'
  // Ringkasan bisnis hanya untuk admin. Keuangan langsung ke antreannya; peran lain belum punya halaman sendiri.
  if (auth.user?.role === 'finance') {
    await router.replace({ name: 'admin-payouts' })
    return
  }
  if (!canReview.value) {
    state.value = 'ok'
    return
  }
  try {
    const [b, q] = await Promise.all([
      getBusiness(),
      canReview.value ? listReviewEvents('in_review') : Promise.resolve(null),
    ])
    data.value = b
    waiting.value = q ? q.meta.total : null
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

const top = computed(() => data.value?.funnel[0]?.count ?? 0)
const minutes = computed(() => {
  const s = data.value?.median_checkout_sec ?? 0
  return s ? t('dash.admin.minSec', { m: Math.floor(s / 60), s: Math.round(s % 60) }) : '-'
})
</script>

<template>
  <div data-test="admin-home">
    <PageHeader :title="t('dash.admin.title')" :lead="t('dash.admin.lead')" />

    <ErrorState v-if="state === 'error'" :message="err" @retry="load" />
    <template v-else>
      <section
        v-if="canReview"
        class="aq"
        :class="{ 'is-hot': (waiting ?? 0) > 0 }"
        data-test="queue-card"
      >
        <div>
          <p class="a-caps aq__k">{{ t('dash.admin.queueLabel') }}</p>
          <h2 class="a-serif aq__t">
            {{
              waiting === null
                ? '…'
                : waiting
                  ? t('dash.admin.queueN', { n: waiting })
                  : t('dash.admin.queueZero')
            }}
          </h2>
          <p class="aq__b">{{ t('dash.admin.queueBody') }}</p>
        </div>
        <RouterLink :to="{ name: 'admin-events' }" class="a-pill a-pill--solid">
          {{ t('dash.admin.queueCta') }}
        </RouterLink>
      </section>

      <EmptyState
        v-if="!canReview"
        :title="t('dash.admin.limitedT')"
        :body="t('dash.admin.limitedB')"
      />
      <section v-else class="kp">
        <KpiCard
          :label="t('dash.admin.kpi.paid')"
          :value="nf(data?.paid_orders ?? 0)"
          :hint="t('dash.admin.kpi.paidHint')"
          :icon="Receipt2"
          tone="gold"
          :loading="state === 'loading'"
        />
        <KpiCard
          :label="t('dash.admin.kpi.median')"
          :value="minutes"
          :hint="t('dash.admin.kpi.medianHint')"
          :icon="Clock"
          :loading="state === 'loading'"
        />
        <KpiCard
          :label="t('dash.admin.kpi.views')"
          :value="nf(top)"
          :hint="t('dash.admin.kpi.viewsHint')"
          :icon="ShieldCheck"
          :loading="state === 'loading'"
        />
      </section>

      <section v-if="data" class="fn" data-test="funnel">
        <h2 class="a-serif fn__t">{{ t('dash.admin.funnel') }}</h2>
        <p class="a-muted fn__lead">{{ t('dash.admin.funnelLead') }}</p>
        <ol class="fn__list">
          <li v-for="s in data.funnel" :key="s.stage">
            <span class="fn__n">{{ t(`dash.admin.stage.${s.stage}`, s.stage) }}</span>
            <span class="fn__bar" aria-hidden="true">
              <i
                :style="{ width: `${top ? Math.max(2, Math.round((s.count / top) * 100)) : 0}%` }"
              />
            </span>
            <span class="fn__c">{{ nf(s.count) }}</span>
            <small class="a-muted fn__p">{{
              s.conversion_from_prev ? `${Math.round(s.conversion_from_prev * 100)}%` : ''
            }}</small>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

<style scoped>
.aq {
  display: grid;
  gap: 14px;
  margin-bottom: 20px;
  padding: 22px;
  border: 1px solid var(--a-line);
  border-radius: 20px;
  background: var(--a-panel);
}
.aq.is-hot {
  border-color: var(--a-line-strong);
  background: linear-gradient(135deg, rgb(224 178 94 / 0.14), transparent 70%), var(--a-panel);
}
.aq__k {
  margin: 0 0 4px;
}
.aq__t {
  margin: 0;
  color: var(--a-cream);
  font-size: clamp(26px, 3.6vw, 34px);
}
.aq__b {
  margin: 6px 0 0;
  max-width: 60ch;
  color: var(--a-muted);
}
.kp {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
  margin-bottom: 28px;
}
.fn {
  padding: 20px;
  border: 1px solid var(--a-line);
  border-radius: 20px;
  background: var(--a-panel);
}
.fn__t {
  margin: 0;
  color: var(--a-cream);
  font-size: 26px;
}
.fn__lead {
  margin: 4px 0 16px;
  font-size: 14px;
}
.fn__list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.fn__list li {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    'n c'
    'b p';
  align-items: center;
  gap: 4px 12px;
}
.fn__n {
  grid-area: n;
  font-size: 14px;
  font-weight: 600;
}
.fn__c {
  grid-area: c;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.fn__bar {
  grid-area: b;
  height: 8px;
  border-radius: 999px;
  background: var(--a-line);
  overflow: hidden;
}
.fn__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--a-gold);
}
.fn__p {
  grid-area: p;
  min-width: 36px;
  text-align: right;
}
@media (min-width: 720px) {
  .aq {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }
  .fn__list li {
    grid-template-columns: 150px minmax(0, 1fr) 70px 44px;
    grid-template-areas: 'n b c p';
    gap: 12px;
  }
  .fn__c {
    text-align: right;
  }
}
</style>
