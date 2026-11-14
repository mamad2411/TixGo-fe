<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { CircleCheck, Clock, CreditCard, Download, Receipt, Ticket, CircleX } from '@vicons/tabler'
import { NIcon, useDialog, useMessage } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import {
  cancelOrder,
  downloadInvoice,
  getOrder,
  listOrderRefunds,
  newIdempotencyKey,
  payOrder,
  type OrderView,
  type Refund,
} from '@/api/orders'
import Countdown from '@/components/app/Countdown.vue'
import BackLink from '@/components/app/BackLink.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import RefundTimeline from '@/components/app/RefundTimeline.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import { formatRupiah } from '@/utils/format'

const { t, locale } = useI18n()
useHeaderTone(computed(() => 'light'))
const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const apiMessage = useApiMessage()
useHead({ title: computed(() => t('order.title')) })

const id = computed(() => String(route.params.id))
const rp = (n: number) => formatRupiah(n, locale.value === 'en' ? 'en-GB' : 'id-ID')

const order = ref<OrderView | null>(null)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const errText = ref('')
const busy = ref(false)
const payKey = newIdempotencyKey()

// Status pesanan -> tampilan. Nilai mengikuti order state machine BE (docs/11 §order).
const view = computed<'pending' | 'paid' | 'closed'>(() => {
  const s = order.value?.status
  if (s === 'paid' || s === 'completed') return 'paid'
  if (s === 'pending_payment' || s === 'awaiting_payment' || s === 'pending') return 'pending'
  return 'closed'
})

const REFUND_STATES = ['paid', 'completed', 'refunding', 'partially_refunded', 'refunded']
const refunds = ref<Refund[]>([])
const refundish = computed(() => REFUND_STATES.includes(order.value?.status ?? ''))
const openRefund = computed(() =>
  refunds.value.some((r) => !['rejected', 'refunded', 'refund_failed'].includes(r.status)),
)
const canRefund = computed(() => view.value === 'paid' && !openRefund.value)
async function loadRefunds(): Promise<void> {
  if (!refundish.value) return
  try {
    refunds.value = await listOrderRefunds(id.value)
  } catch {
    /* riwayat refund opsional; halaman tetap berfungsi */
  }
}
const dlBusy = ref(false)
async function invoice(): Promise<void> {
  dlBusy.value = true
  try {
    await downloadInvoice(id.value, `invoice-${order.value?.invoice_number ?? id.value}.pdf`)
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    dlBusy.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
let polls = 0
async function load(initial = false): Promise<void> {
  if (initial) state.value = 'loading'
  try {
    order.value = await getOrder(id.value)
    state.value = 'ok'
    void loadRefunds()
    schedule()
  } catch (e) {
    if (initial || !order.value) {
      errText.value = apiMessage(e)
      state.value = 'error'
    }
  }
}
// Polling status bayar: 3 dtk, melambat bertahap, berhenti setelah ±5 menit atau status final.
function schedule(): void {
  clearTimeout(timer)
  if (view.value !== 'pending' || !order.value?.payment) return
  if (document.hidden && polls > 0) return
  if (polls > 60) return
  const wait = polls < 20 ? 3000 : 6000
  polls++
  timer = setTimeout(() => void load(), wait)
}
function onVisible(): void {
  if (!document.hidden && view.value === 'pending') void load()
}
onMounted(() => {
  void load(true)
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  document.removeEventListener('visibilitychange', onVisible)
})

async function pay(): Promise<void> {
  busy.value = true
  try {
    const r = await payOrder(id.value, payKey)
    polls = 0
    if (r.redirect_url) window.location.assign(r.redirect_url)
    else await load()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
function askCancel(): void {
  dialog.warning({
    title: t('order.cancelTitle'),
    content: t('order.cancelBody'),
    positiveText: t('order.cancelYes'),
    negativeText: t('order.cancelNo'),
    onPositiveClick: async () => {
      try {
        await cancelOrder(id.value)
        message.success(t('order.cancelled'))
        await load()
      } catch (e) {
        message.error(apiMessage(e))
      }
    },
  })
}
const eventLink = computed(() =>
  order.value ? { name: 'event', params: { slug: order.value.event_slug } } : { name: 'events' },
)
async function share(): Promise<void> {
  const url = `${location.origin}/events/${order.value?.event_slug}`
  try {
    if (navigator.share) await navigator.share({ title: order.value?.event_title, url })
    else {
      await navigator.clipboard.writeText(url)
      message.success(t('order.linkCopied'))
    }
  } catch {
    /* dibatalkan pengguna */
  }
}
void router
</script>

<template>
  <ToneLight class="tone-page">
    <div class="od">
      <BackLink plain :fallback="{ name: 'orders' }" />
      <SkeletonPage v-if="state === 'loading'" variant="detail" />
      <ErrorState v-else-if="state === 'error'" :message="errText" @retry="load(true)" />

      <template v-else-if="order">
        <header class="od__head" :data-state="view">
          <span class="od__ic" :class="`is-${view}`">
            <NIcon
              :component="view === 'paid' ? CircleCheck : view === 'pending' ? Clock : CircleX"
              :size="34"
              aria-hidden="true"
            />
          </span>
          <div>
            <p class="a-caps">{{ t(`order.kicker.${view}`) }}</p>
            <h1 class="a-serif od__title">{{ t(`order.head.${view}`) }}</h1>
            <p class="a-muted" aria-live="polite">{{ order.event_title }}</p>
          </div>
          <div v-if="view === 'pending'" class="od__timer" role="timer" aria-live="off">
            <p class="a-caps">{{ t('order.payBefore') }}</p>
            <Countdown :to="order.expires_at" @done="load()" />
          </div>
        </header>

        <div class="od__grid">
          <section class="blk">
            <h2 class="a-serif blk__h">
              <NIcon :component="Ticket" :size="24" aria-hidden="true" /> {{ t('order.items') }}
            </h2>
            <ul class="its">
              <li v-for="it in order.items" :key="it.id">
                <span>
                  <strong>{{ it.seat_label ? it.seat_label : it.tier_name }}</strong>
                  <small class="a-muted">{{ it.attendee_name }} · {{ it.attendee_email }}</small>
                </span>
                <b>{{ rp(it.price) }}</b>
              </li>
            </ul>
            <p v-if="order.invoice_number" class="a-muted">
              {{ t('order.invoice') }}: <b>{{ order.invoice_number }}</b>
            </p>
          </section>

          <aside class="blk od__side" :aria-label="t('order.summary')">
            <h2 class="a-serif blk__h">
              <NIcon :component="Receipt" :size="24" aria-hidden="true" /> {{ t('order.summary') }}
            </h2>
            <dl class="sum">
              <div>
                <dt>{{ t('checkout.subtotal') }}</dt>
                <dd>{{ rp(order.quote.subtotal) }}</dd>
              </div>
              <div v-if="order.quote.discount > 0">
                <dt>{{ t('checkout.discount') }}</dt>
                <dd>− {{ rp(order.quote.discount) }}</dd>
              </div>
              <div>
                <dt>{{ t('checkout.fee') }}</dt>
                <dd>{{ rp(order.quote.fee) }}</dd>
              </div>
              <div v-if="order.quote.tax > 0">
                <dt>{{ t('checkout.tax') }}</dt>
                <dd>{{ rp(order.quote.tax) }}</dd>
              </div>
              <div class="sum__total">
                <dt>{{ t('checkout.total') }}</dt>
                <dd data-test="order-total">{{ rp(order.quote.total) }}</dd>
              </div>
            </dl>

            <template v-if="view === 'pending'">
              <button
                type="button"
                class="a-pill a-pill--solid od__btn"
                :disabled="busy || !order.can_pay"
                data-test="pay-now"
                @click="pay"
              >
                <NIcon :component="CreditCard" :size="18" aria-hidden="true" />
                {{
                  busy
                    ? t('order.opening')
                    : order.payment
                      ? t('order.continuePay')
                      : t('order.payNow')
                }}
              </button>
              <p class="a-muted od__note">{{ t('order.methodsNote') }}</p>
              <button type="button" class="od__link" :disabled="busy" @click="load()">
                {{ t('order.checkStatus') }}
              </button>
              <button type="button" class="od__link is-danger" :disabled="busy" @click="askCancel">
                {{ t('order.cancel') }}
              </button>
            </template>

            <template v-else-if="view === 'paid'">
              <RouterLink
                class="a-pill a-pill--solid od__btn"
                :to="{ name: 'tickets' }"
                data-test="see-tickets"
              >
                <NIcon :component="Ticket" :size="18" aria-hidden="true" />
                {{ t('order.seeTickets') }}
              </RouterLink>
              <button
                type="button"
                class="a-pill od__btn"
                :disabled="dlBusy"
                data-test="invoice"
                @click="invoice"
              >
                <NIcon :component="Download" :size="18" aria-hidden="true" />
                {{ t('order.invoiceDl') }}
              </button>
              <button type="button" class="a-pill od__btn" @click="share">
                {{ t('order.share') }}
              </button>
              <RouterLink
                v-if="canRefund"
                class="od__link"
                :to="{ name: 'order-refund', params: { id } }"
                data-test="ask-refund"
              >
                {{ t('order.refundCta') }}
              </RouterLink>
              <p class="a-muted od__note">{{ order.refund_summary }}</p>
            </template>

            <template v-else>
              <p class="a-muted">
                {{ refundish ? t('order.refundedBody') : t('order.closedBody') }}
              </p>
              <RouterLink class="a-pill a-pill--solid od__btn" :to="eventLink">
                {{ t('checkout.again') }}
              </RouterLink>
            </template>
          </aside>
        </div>

        <section v-if="refunds.length" class="blk" data-test="refunds">
          <h2 class="a-serif blk__h">{{ t('order.refunds') }}</h2>
          <RefundTimeline v-for="r in refunds" :key="r.id" :refund="r" @changed="loadRefunds" />
        </section>
      </template>
    </div>
  </ToneLight>
</template>

<style scoped>
.od {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px var(--a-pad) 0;
  display: grid;
  gap: 24px;
}
.od__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
}
.od__ic {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  border: 1px solid var(--a-line);
  background: var(--a-panel);
}
.od__ic.is-paid {
  color: var(--a-ok, var(--a-gold));
}
.od__ic.is-pending {
  color: var(--a-gold);
}
.od__ic.is-closed {
  color: var(--a-danger);
}
.od__title {
  font-size: clamp(28px, 4vw, 44px);
  color: var(--a-cream);
}
.od__timer {
  margin-left: auto;
}
.od__grid {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr);
}
@media (min-width: 900px) {
  .od__grid {
    grid-template-columns: minmax(0, 1.4fr) minmax(300px, 1fr);
    align-items: start;
  }
}
.blk {
  padding: 22px;
  border: 1px solid var(--a-line);
  border-radius: 18px;
  background: var(--a-panel);
  display: grid;
  gap: 14px;
}
.blk__h {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
}
.its {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.its li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--a-line);
}
.its small {
  display: block;
  overflow-wrap: anywhere;
}
.sum {
  display: grid;
  gap: 8px;
  margin: 0;
}
.sum div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.sum dd {
  margin: 0;
}
.sum__total {
  padding-top: 10px;
  border-top: 1px solid var(--a-line);
  font-weight: 700;
  font-size: 18px;
}
.od__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  width: 100%;
}
.od__note {
  font-size: 13px;
  margin: 0;
}
.od__link {
  min-height: 44px;
  background: none;
  border: 0;
  color: var(--a-gold);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.od__link.is-danger {
  color: var(--a-danger);
}
.od__link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
