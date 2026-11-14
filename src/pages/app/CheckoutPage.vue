<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Armchair, CircleCheck, Clock, Receipt, Tag, Ticket, User, X } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { toApiError } from '@/api/errors'
import { getEvent, type PublicEvent } from '@/api/events'
import {
  acceptConsent,
  createOrder,
  extendHold,
  getHold,
  newIdempotencyKey,
  quote as fetchQuote,
  releaseHold,
  type Hold,
  type Quote,
} from '@/api/orders'
import BackLink from '@/components/app/BackLink.vue'
import Countdown from '@/components/app/Countdown.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import { useAuthStore } from '@/stores/auth'
import { formatEventDate, formatRupiah } from '@/utils/format'
import { mediaAt } from '@/utils/media'

const { t, locale } = useI18n()
useHeaderTone(computed(() => 'light'))
const route = useRoute()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
useHead({ title: computed(() => t('checkout.title')) })

const holdId = computed(() => String(route.params.holdId))
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const rp = (n: number) => formatRupiah(n, bcp.value)

const hold = ref<Hold | null>(null)
const ev = ref<PublicEvent | null>(null)
const q = ref<Quote | null>(null)
const state = ref<'loading' | 'ok' | 'expired' | 'error'>('loading')
const errText = ref('')
const busy = ref(false)

const code = ref('')
const voucherError = ref('')
const applied = computed(() => q.value?.promo_code ?? '')

async function load(): Promise<void> {
  state.value = 'loading'
  try {
    hold.value = await getHold(holdId.value)
    if (hold.value.status !== 'active') {
      state.value = 'expired'
      return
    }
    ;[ev.value, q.value] = await Promise.all([
      getEvent(hold.value.event_id),
      fetchQuote(holdId.value),
    ])
    state.value = 'ok'
  } catch (e) {
    const err = toApiError(e)
    errText.value = apiMessage(err)
    state.value = ['HOLD_EXPIRED', 'NOT_FOUND', 'FORBIDDEN'].includes(err.code)
      ? 'expired'
      : 'error'
  }
}
onMounted(load)

async function applyVoucher(): Promise<void> {
  const c = code.value.trim().toUpperCase()
  voucherError.value = ''
  if (!c) return
  busy.value = true
  try {
    const next = await fetchQuote(holdId.value, c)
    q.value = next
    code.value = ''
    message.success(t('checkout.voucherOk', { amount: rp(next.discount) }))
  } catch (e) {
    voucherError.value = apiMessage(e) // kode salah tidak mengubah ringkasan sebelumnya
  } finally {
    busy.value = false
  }
}
async function removeVoucher(): Promise<void> {
  busy.value = true
  try {
    q.value = await fetchQuote(holdId.value)
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
async function extend(): Promise<void> {
  busy.value = true
  try {
    hold.value = await extendHold(holdId.value)
    message.success(t('checkout.extended'))
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
async function release(): Promise<void> {
  busy.value = true
  try {
    await releaseHold(holdId.value)
    message.success(t('checkout.released'))
    await router.push(
      ev.value ? { name: 'event', params: { slug: ev.value.slug } } : { name: 'events' },
    )
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}

// ---- data pemegang tiket, persetujuan, buat pesanan ----
const auth = useAuthStore()
interface Holder {
  name: string
  email: string
  seat_id?: string
  label: string
}
const holders = reactive<Holder[]>([])
const agreed = ref(false)
const ageOk = ref(false)
const submitted = ref(false)
const orderKey = newIdempotencyKey() // dipakai ulang bila kirim ulang (idempoten)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

watch(
  hold,
  (h) => {
    if (!h || holders.length) return
    for (const it of h.items) {
      const n = it.seat_id ? 1 : it.qty
      for (let i = 0; i < n; i++)
        holders.push({
          name: '',
          email: '',
          seat_id: it.seat_id,
          label: it.seat_id ? t('checkout.seatLine', { label: it.label }) : it.tier_name,
        })
    }
    if (holders[0]) {
      holders[0].name = auth.user?.name ?? ''
      holders[0].email = auth.user?.email ?? ''
    }
  },
  { immediate: true },
)
function fillFromAccount(): void {
  for (const h of holders) {
    h.name = auth.user?.name ?? ''
    h.email = auth.user?.email ?? ''
  }
}
function copyFirst(): void {
  for (const h of holders.slice(1)) {
    h.name = holders[0].name
    h.email = holders[0].email
  }
}
const nameErr = (h: Holder) => (h.name.trim().length < 2 ? t('checkout.errName') : '')
const emailErr = (h: Holder) => (EMAIL.test(h.email.trim()) ? '' : t('checkout.errEmail'))
const needAge = computed(() => (ev.value?.age_min ?? 0) > 0)
const formOk = computed(
  () =>
    holders.length > 0 &&
    holders.every((h) => !nameErr(h) && !emailErr(h)) &&
    agreed.value &&
    (!needAge.value || ageOk.value),
)
const showErrors = computed(() => submitted.value)

async function submitOrder(): Promise<void> {
  submitted.value = true
  if (!formOk.value) {
    await Promise.resolve()
    document.querySelector<HTMLElement>('[aria-invalid="true"], .is-bad input')?.focus()
    return
  }
  busy.value = true
  const body = {
    hold_id: holdId.value,
    attendees: holders.map((h) => ({
      name: h.name.trim(),
      email: h.email.trim(),
      ...(h.seat_id ? { seat_id: h.seat_id } : {}),
    })),
    age_confirmed: needAge.value ? ageOk.value : undefined,
    promo_code: q.value?.promo_code,
  }
  try {
    let o
    try {
      o = await createOrder(body, orderKey)
    } catch (e) {
      // Versi S&K/Privasi baru: centang persetujuan di form = persetujuan atas dokumen yang diminta server.
      const err = toApiError(e)
      const docs = err.details.documents
      if (err.code !== 'CONSENT_REQUIRED' || !Array.isArray(docs)) throw e
      for (const d of docs as { document_id: string }[]) await acceptConsent(d.document_id)
      o = await createOrder(body, orderKey)
    }
    await router.push({ name: 'order-pay', params: { id: o.id } })
  } catch (e) {
    const err = toApiError(e)
    if (['SEAT_TAKEN', 'HOLD_EXPIRED', 'CONFLICT'].includes(err.code)) {
      errText.value = apiMessage(err)
      state.value = 'expired'
    } else message.error(apiMessage(err))
  } finally {
    busy.value = false
  }
}

const eventLink = computed(() =>
  ev.value ? { name: 'event', params: { slug: ev.value.slug } } : { name: 'events' },
)
</script>

<template>
  <ToneLight class="tone-page">
    <div class="co">
      <div class="co__top">
        <BackLink plain :fallback="eventLink" :label="t('checkout.back')" />
      </div>

      <SkeletonPage v-if="state === 'loading'" variant="detail" />
      <ErrorState v-else-if="state === 'error'" :message="errText" @retry="load" />

      <div v-else-if="state === 'expired'" class="co__exp" data-state="expired">
        <NIcon :component="Clock" :size="40" aria-hidden="true" />
        <h1 class="a-serif">{{ t('checkout.expiredTitle') }}</h1>
        <p class="a-muted">{{ t('checkout.expiredBody') }}</p>
        <RouterLink class="a-pill a-pill--solid" :to="eventLink">{{
          t('checkout.again')
        }}</RouterLink>
      </div>

      <template v-else-if="hold && ev && q">
        <header class="co__head">
          <img v-if="ev.poster_url" :src="mediaAt(ev.poster_url, 400)" alt="" class="co__poster" />
          <div>
            <p class="a-caps">{{ t('checkout.title') }}</p>
            <h1 class="a-serif co__title">{{ ev.title }}</h1>
            <p class="a-muted">
              {{ formatEventDate(ev.starts_at, ev.tz, bcp) }} · {{ ev.venue_name }}, {{ ev.city }}
            </p>
          </div>
          <div class="co__timer" role="timer" aria-live="off" data-test="hold-timer">
            <p class="a-caps">
              <NIcon :component="Clock" :size="14" aria-hidden="true" />
              {{ t('checkout.holdTimer') }}
            </p>
            <Countdown :to="hold.expires_at" @done="state = 'expired'" />
            <button
              v-if="hold.can_extend"
              type="button"
              class="a-pill"
              :disabled="busy"
              @click="extend"
            >
              {{ t('checkout.extend') }}
            </button>
          </div>
        </header>

        <div class="co__grid">
          <div class="co__main">
            <section class="blk">
              <h2 class="a-serif blk__h">
                <NIcon :component="Ticket" :size="26" aria-hidden="true" />
                {{ t('checkout.items') }}
              </h2>
              <ul class="items">
                <li v-for="(it, i) in hold.items" :key="i">
                  <span class="items__ic"
                    ><NIcon
                      :component="it.seat_id ? Armchair : Ticket"
                      :size="18"
                      aria-hidden="true"
                  /></span>
                  <span>
                    <strong>{{
                      it.seat_id
                        ? t('checkout.seatLine', { label: it.label })
                        : t('checkout.qtyLine', { qty: it.qty, name: it.tier_name })
                    }}</strong>
                    <small v-if="it.seat_id" class="a-muted">{{ it.tier_name }}</small>
                  </span>
                  <b>{{ rp(it.price * it.qty) }}</b>
                </li>
              </ul>
            </section>

            <section class="blk">
              <h2 class="a-serif blk__h">
                <NIcon :component="User" :size="26" aria-hidden="true" />
                {{ t('checkout.holders') }}
              </h2>
              <p class="a-muted">{{ t('checkout.holdersHint') }}</p>
              <div class="hl__tools">
                <button type="button" class="a-pill" @click="fillFromAccount">
                  {{ t('checkout.fillAccount') }}
                </button>
                <button v-if="holders.length > 1" type="button" class="a-pill" @click="copyFirst">
                  {{ t('checkout.copyFirst') }}
                </button>
              </div>
              <ul class="hl" data-test="holders">
                <li v-for="(h, i) in holders" :key="i" class="hl__card">
                  <p class="a-caps">{{ i + 1 }}. {{ h.label }}</p>
                  <div class="hl__f" :class="{ 'is-bad': showErrors && nameErr(h) }">
                    <label :for="`hn${i}`">{{ t('checkout.name') }}</label>
                    <input
                      :id="`hn${i}`"
                      v-model="h.name"
                      autocomplete="name"
                      maxlength="60"
                      :aria-invalid="showErrors && !!nameErr(h)"
                      :aria-describedby="`hne${i}`"
                    />
                    <small :id="`hne${i}`" role="alert">{{ showErrors ? nameErr(h) : '' }}</small>
                  </div>
                  <div class="hl__f" :class="{ 'is-bad': showErrors && emailErr(h) }">
                    <label :for="`he${i}`">{{ t('checkout.email') }}</label>
                    <input
                      :id="`he${i}`"
                      v-model="h.email"
                      type="email"
                      inputmode="email"
                      autocomplete="email"
                      :aria-invalid="showErrors && !!emailErr(h)"
                      :aria-describedby="`hee${i}`"
                    />
                    <small :id="`hee${i}`" role="alert">{{ showErrors ? emailErr(h) : '' }}</small>
                  </div>
                </li>
              </ul>
            </section>

            <section class="blk">
              <h2 class="a-serif blk__h">
                <NIcon :component="Tag" :size="26" aria-hidden="true" /> {{ t('checkout.voucher') }}
              </h2>
              <div v-if="applied" class="vch is-on" data-test="voucher-applied">
                <NIcon :component="CircleCheck" :size="22" aria-hidden="true" />
                <span
                  ><strong>{{ t('checkout.voucherApplied', { code: applied }) }}</strong
                  ><small>− {{ rp(q.discount) }}</small></span
                >
                <button
                  type="button"
                  :aria-label="t('checkout.voucherRemove')"
                  :disabled="busy"
                  @click="removeVoucher"
                >
                  <NIcon :component="X" :size="16" aria-hidden="true" />
                </button>
              </div>
              <form v-else class="vch" novalidate @submit.prevent="applyVoucher">
                <label class="a-sr" for="voucher">{{ t('checkout.voucher') }}</label>
                <input
                  id="voucher"
                  v-model="code"
                  :placeholder="t('checkout.voucherPh')"
                  maxlength="32"
                  autocomplete="off"
                  autocapitalize="characters"
                  spellcheck="false"
                  :aria-invalid="!!voucherError"
                  aria-describedby="voucher-msg"
                />
                <button
                  type="submit"
                  class="a-pill a-pill--solid"
                  :disabled="busy || !code.trim()"
                  data-test="voucher-apply"
                >
                  {{ t('checkout.voucherUse') }}
                </button>
              </form>
              <p
                id="voucher-msg"
                class="vch__msg"
                :class="{ 'is-err': voucherError }"
                aria-live="polite"
                data-test="voucher-msg"
              >
                {{ voucherError || (applied ? '' : t('checkout.voucherHint')) }}
              </p>
            </section>

            <section class="blk">
              <h2 class="a-serif blk__h">{{ t('checkout.refundTitle') }}</h2>
              <p class="callout">{{ ev.refund_summary }}</p>
              <label v-if="needAge" class="chk" :class="{ 'is-bad': showErrors && !ageOk }">
                <input v-model="ageOk" type="checkbox" data-test="age" />
                <span>{{ t('checkout.age', { n: ev.age_min }) }}</span>
              </label>
              <label class="chk" :class="{ 'is-bad': showErrors && !agreed }">
                <input v-model="agreed" type="checkbox" data-test="agree" />
                <span>{{ t('checkout.agree') }}</span>
              </label>
              <p v-if="showErrors && !agreed" class="chk__err" role="alert">
                {{ t('checkout.errAgree') }}
              </p>
            </section>
          </div>

          <aside class="co__sum" :aria-label="t('checkout.summary')">
            <h2 class="a-serif">
              <NIcon :component="Receipt" :size="26" aria-hidden="true" />
              {{ t('checkout.summary') }}
            </h2>
            <dl class="sum">
              <div v-for="l in q.lines" :key="l.tier_id">
                <dt>{{ l.qty }} × {{ l.name }}</dt>
                <dd>{{ rp(l.subtotal) }}</dd>
              </div>
              <div>
                <dt>{{ t('checkout.subtotal') }}</dt>
                <dd data-test="subtotal">{{ rp(q.subtotal) }}</dd>
              </div>
              <div v-if="q.discount > 0" class="sum__disc">
                <dt>{{ t('checkout.discount') }} ({{ q.promo_code }})</dt>
                <dd data-test="discount">− {{ rp(q.discount) }}</dd>
              </div>
              <div>
                <dt>{{ t('checkout.fee') }}</dt>
                <dd>{{ rp(q.fee) }}</dd>
              </div>
              <div v-if="q.tax > 0">
                <dt>{{ t('checkout.tax') }}</dt>
                <dd>{{ rp(q.tax) }}</dd>
              </div>
              <div class="sum__total">
                <dt>{{ t('checkout.total') }}</dt>
                <dd data-test="grand-total">{{ rp(q.total) }}</dd>
              </div>
            </dl>
            <p class="sum__honest">{{ t('checkout.honest') }}</p>
            <button
              type="button"
              class="a-pill a-pill--solid co__pay"
              :disabled="busy"
              data-test="pay"
              @click="submitOrder"
            >
              {{ busy ? t('checkout.creating') : t('checkout.pay') }}
            </button>
            <p v-if="showErrors && !formOk" class="chk__err" role="alert">
              {{ t('checkout.errForm') }}
            </p>
            <button
              type="button"
              class="co__release"
              :disabled="busy"
              data-test="release"
              @click="release"
            >
              {{ t('checkout.release') }}
            </button>
          </aside>
        </div>
      </template>
    </div>
  </ToneLight>
</template>

<style scoped>
.co {
  max-width: var(--a-max);
  margin: 0 auto;
  padding: 24px var(--a-pad) 0;
  display: grid;
  gap: 24px;
}
.co__top .bk {
  background: var(--a-bg2);
  border-color: var(--a-line-strong);
}
.co__exp {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 72px 16px;
  text-align: center;
  border: 1px solid var(--a-line-strong);
  border-radius: 24px;
  color: var(--a-gold);
}
.co__exp h1 {
  font-size: 44px;
  color: var(--a-cream);
}
.co__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 20px;
}
.co__poster {
  width: 96px;
  height: 120px;
  object-fit: cover;
  border-radius: 14px;
  border: 1px solid var(--a-line-strong);
}
.co__title {
  font-size: clamp(32px, 4vw, 52px);
  color: var(--a-cream);
}
.co__timer {
  display: grid;
  justify-items: end;
  gap: 8px;
  padding: 14px 18px;
  border: 1px solid var(--a-gold);
  border-radius: 18px;
  background: rgb(217 185 121 / 0.08);
}
.co__timer .a-caps {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--a-gold);
}
.co__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 40px;
  align-items: start;
}
.co__main {
  display: grid;
  gap: 36px;
}
.blk {
  display: grid;
  gap: 14px;
}
.blk__h {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 32px;
  color: var(--a-cream);
}
.items {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.items li {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-bg2);
}
.items small {
  display: block;
}
.items__ic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgb(217 185 121 / 0.14);
  color: var(--a-gold);
}
.items b {
  color: var(--a-gold);
}
.vch {
  display: flex;
  gap: 10px;
}
.vch input {
  flex: 1;
  min-width: 0;
  min-height: 52px;
  padding: 0 20px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: var(--a-bg);
  color: var(--a-ink);
  font: inherit;
  font-size: 16px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.vch input:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 2px;
}
.vch input[aria-invalid='true'] {
  border-color: var(--a-danger);
}
.vch.is-on {
  align-items: center;
  padding: 14px 16px;
  border: 1px solid var(--a-ok);
  border-radius: 18px;
  background: rgb(155 216 168 / 0.08);
  color: var(--a-ok);
}
.vch.is-on span {
  flex: 1;
  display: grid;
}
.vch.is-on button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--a-muted);
  cursor: pointer;
}
.vch__msg {
  min-height: 20px;
  font-size: 13px;
  color: var(--a-muted);
}
.vch__msg.is-err {
  color: var(--a-danger);
}
.callout {
  padding: 18px 20px;
  border-left: 3px solid var(--a-gold);
  border-radius: 4px 16px 16px 4px;
  background: var(--a-bg2);
  max-width: 68ch;
}
.co__sum {
  position: sticky;
  top: 92px;
  display: grid;
  gap: 14px;
  padding: 24px;
  border: 1px solid var(--a-line-strong);
  border-radius: 24px;
  background: linear-gradient(180deg, var(--a-bg2), var(--a-bg));
  box-shadow: 0 30px 60px rgb(0 0 0 / 0.45);
}
.co__sum h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 30px;
  color: var(--a-cream);
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
  font-size: 15px;
}
.sum dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.sum__disc {
  color: var(--a-ok);
}
.sum__total {
  margin-top: 6px;
  padding-top: 14px;
  border-top: 1px dashed var(--a-line-strong);
  align-items: baseline;
}
.sum__total dt {
  font-size: 16px;
}
.sum__total dd {
  font-family: var(--a-serif);
  font-size: 38px;
  color: var(--a-cream);
}
.sum__honest {
  font-size: 12px;
  color: var(--a-muted);
}
.co__pay {
  width: 100%;
  min-height: 54px;
}
.co__pay:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.co__release {
  min-height: 44px;
  border: 0;
  background: none;
  color: var(--a-danger);
  font: inherit;
  font-size: 14px;
  text-decoration: underline;
  cursor: pointer;
}
@media (max-width: 960px) {
  .co__head {
    grid-template-columns: auto 1fr;
  }
  .co__timer {
    grid-column: 1 / -1;
    justify-items: start;
  }
  .co__grid {
    grid-template-columns: 1fr;
  }
  .co__sum {
    position: static;
  }
}
.hl__tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.hl {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.hl__card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--a-line);
  border-radius: 14px;
  background: var(--a-panel);
}
.hl__f {
  display: grid;
  gap: 4px;
}
.hl__f label {
  font-size: 13px;
  font-weight: 600;
}
.hl__f input {
  min-height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--a-line);
  background: var(--a-bg);
  color: var(--a-ink);
  font: inherit;
}
.hl__f.is-bad input {
  border-color: var(--a-danger);
}
.hl__f small {
  min-height: 16px;
  color: var(--a-danger);
  font-size: 12px;
}
.chk {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 14px;
  min-height: 44px;
  cursor: pointer;
}
.chk input {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  accent-color: var(--a-gold);
}
.chk.is-bad span {
  color: var(--a-danger);
}
.chk__err {
  margin: 6px 0 0;
  color: var(--a-danger);
  font-size: 13px;
}
</style>
