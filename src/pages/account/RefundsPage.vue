<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { listOrders, type OrderBrief } from '@/api/account'
import { listOrderRefunds, type Refund } from '@/api/orders'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import RefundTimeline from '@/components/app/RefundTimeline.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { formatRupiah } from '@/utils/format'
import './accountStyle.css'

// Pusat refund: satu tempat untuk mengajukan, memantau, dan mengisi rekening. Data diturunkan dari
// pesanan akun + refund per pesanan (BE belum punya daftar refund lintas pesanan).
const { t, locale } = useI18n()
useHead({ title: computed(() => t('rfs.title')) })
const apiMessage = useApiMessage()
const lc = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const rp = (n: number) => formatRupiah(n, lc.value)
const day = (iso: string) =>
  new Intl.DateTimeFormat(lc.value, { dateStyle: 'medium' }).format(new Date(iso))

interface Row {
  order: OrderBrief
  refunds: Refund[]
}
const rows = ref<Row[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const REFUNDISH = ['paid', 'completed', 'refunding', 'partially_refunded', 'refunded']
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    const orders = (await listOrders()).data.filter((o) => REFUNDISH.includes(o.status))
    rows.value = await Promise.all(
      orders.map(async (order) => ({
        order,
        refunds: await listOrderRefunds(order.id).catch(() => [] as Refund[]),
      })),
    )
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

const open = (r: Refund) => !['rejected', 'refunded', 'refund_failed'].includes(r.status)
const canAsk = computed(() =>
  rows.value.filter((x) => x.order.status === 'paid' && !x.refunds.some(open)),
)
const tracked = computed(() => rows.value.filter((x) => x.refunds.length))
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('rfs.title') }}</h1>
    <p class="a-muted">{{ t('rfs.intro') }}</p>

    <div
      v-if="state === 'loading'"
      class="a-sk"
      style="min-height: 180px; border-radius: 14px"
      role="status"
      :aria-label="t('common.loading')"
    />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <template v-else>
      <section>
        <h2 class="a-serif">{{ t('rfs.canTitle') }}</h2>
        <p v-if="!canAsk.length" class="a-muted" data-test="refund-none">{{ t('rfs.canEmpty') }}</p>
        <ul v-else class="ac__list" data-test="refund-can">
          <li v-for="x in canAsk" :key="x.order.id" class="ac__row">
            <span class="ac__main">
              <strong>{{ x.order.event_title }}</strong>
              <small class="a-muted"
                >{{ rp(x.order.total) }} ·
                {{ t('rfs.paidOn', { d: day(x.order.created_at) }) }}</small
              >
            </span>
            <RouterLink
              class="a-pill a-pill--solid"
              :to="{ name: 'order-refund', params: { id: x.order.id } }"
              >{{ t('rfs.check') }}</RouterLink
            >
          </li>
        </ul>
      </section>

      <section>
        <h2 class="a-serif">{{ t('rfs.trackTitle') }}</h2>
        <EmptyState v-if="!tracked.length" :title="t('rfs.trackEmpty')" />
        <div v-else class="rfs__list" data-test="refund-tracked">
          <div v-for="x in tracked" :key="x.order.id" class="rfs__grp">
            <p class="rfs__head">
              <strong>{{ x.order.event_title }}</strong>
              <RouterLink :to="{ name: 'order', params: { id: x.order.id } }">{{
                t('rfs.order')
              }}</RouterLink>
            </p>
            <RefundTimeline v-for="r in x.refunds" :key="r.id" :refund="r" @changed="load" />
          </div>
        </div>
      </section>

      <p class="a-muted">
        {{ t('rfs.help') }}
        <RouterLink :to="{ name: 'help', query: { kategori: 'refund' } }">{{
          t('rfs.helpCta')
        }}</RouterLink>
      </p>
    </template>
  </div>
</template>

<style scoped>
.rfs__list {
  display: grid;
  gap: 18px;
}
.rfs__grp {
  display: grid;
  gap: 8px;
}
.rfs__head {
  margin: 0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.rfs__head a {
  color: var(--a-gold);
}
</style>
