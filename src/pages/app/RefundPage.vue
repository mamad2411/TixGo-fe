<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { InfoCircle, Ticket } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import {
  getOrder,
  getRefundEligibility,
  newIdempotencyKey,
  requestRefund,
  type OrderView,
  type RefundEligibility,
} from '@/api/orders'
import BackLink from '@/components/app/BackLink.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import { formatRupiah } from '@/utils/format'
import '@/pages/account/accountStyle.css'

// Ajukan refund: kelayakan + jumlah ditunjukkan SEBELUM mengajukan (Baymard), alasan opsional,
// konfirmasi dampak (tiket dibatalkan), alternatif jual ulang. Jumlah final dihitung server.
const { t, locale } = useI18n()
useHeaderTone(computed(() => 'light'))
useHead({ title: computed(() => t('refund.title')) })
const route = useRoute()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const id = computed(() => String(route.params.id))
const rp = (n: number) => formatRupiah(n, locale.value === 'en' ? 'en-GB' : 'id-ID')

const order = ref<OrderView | null>(null)
const elig = ref<RefundEligibility | null>(null)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const errText = ref('')
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    ;[order.value, elig.value] = await Promise.all([
      getOrder(id.value),
      getRefundEligibility(id.value),
    ])
    state.value = 'ok'
  } catch (e) {
    errText.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

const REASONS = ['cannot', 'mistake', 'schedule', 'other'] as const
const reason = ref<(typeof REASONS)[number]>('cannot')
const detail = ref('')
const agree = ref(false)
const tried = ref(false)
const busy = ref(false)
const key = newIdempotencyKey()
// BE mengirim err.Error() ("KODE: pesan"); pembeli hanya perlu kalimatnya.
const reasonText = computed(() => {
  const r = (elig.value?.reason ?? '').replace(/^[A-Z][A-Z_]+:\s*/, '')
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : ''
})
const deduction = computed(() =>
  order.value && elig.value ? order.value.quote.total - elig.value.amount : 0,
)

async function submit(): Promise<void> {
  tried.value = true
  if (!agree.value || busy.value) return
  busy.value = true
  try {
    const text = [t(`refund.reason.${reason.value}`), detail.value.trim()]
      .filter(Boolean)
      .join(' — ')
    await requestRefund(id.value, text.slice(0, 500), key)
    message.success(t('refund.sentOk'))
    await router.replace({ name: 'order', params: { id: id.value } })
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ToneLight class="tone-page">
    <div class="rf">
      <BackLink plain :fallback="{ name: 'order', params: { id } }" :label="t('refund.back')" />
      <h1 class="a-serif ac__title">{{ t('refund.title') }}</h1>

      <SkeletonPage v-if="state === 'loading'" variant="detail" />
      <ErrorState v-else-if="state === 'error'" :message="errText" @retry="load" />

      <template v-else-if="order && elig">
        <section class="ac__card">
          <p class="a-caps">{{ order.event_title }}</p>
          <dl class="rf__sum">
            <div>
              <dt>{{ t('refund.tickets') }}</dt>
              <dd>{{ order.items.length }}</dd>
            </div>
            <div>
              <dt>{{ t('refund.paid') }}</dt>
              <dd>{{ rp(order.quote.total) }}</dd>
            </div>
            <template v-if="elig.eligible">
              <div v-if="deduction > 0">
                <dt>{{ t('refund.deduction') }}</dt>
                <dd>− {{ rp(deduction) }}</dd>
              </div>
              <div class="rf__total">
                <dt>{{ t('refund.youGet') }}</dt>
                <dd data-test="refund-amount">{{ rp(elig.amount) }}</dd>
              </div>
            </template>
          </dl>
          <p class="rf__policy">
            <NIcon :component="InfoCircle" :size="18" aria-hidden="true" /> {{ elig.summary }}
          </p>
          <p v-if="elig.basis === 'reschedule_window'" class="a-muted">
            {{ t('refund.rescheduleNote') }}
          </p>
        </section>

        <section v-if="!elig.eligible" class="ac__card" data-test="refund-blocked">
          <h2 class="a-serif">{{ t('refund.notEligible') }}</h2>
          <p>{{ reasonText }}</p>
          <div class="ac__act">
            <RouterLink class="a-pill a-pill--solid" :to="{ name: 'tickets' }">
              <NIcon :component="Ticket" :size="16" aria-hidden="true" />
              {{ t('refund.resaleCta') }}
            </RouterLink>
            <RouterLink class="a-pill" :to="{ name: 'order', params: { id } }">{{
              t('refund.back')
            }}</RouterLink>
          </div>
        </section>

        <form v-else class="ac__card" novalidate @submit.prevent="submit">
          <fieldset class="rf__reasons">
            <legend class="a-serif">{{ t('refund.whyTitle') }}</legend>
            <label v-for="r in REASONS" :key="r" class="rf__opt" :class="{ on: reason === r }">
              <input v-model="reason" type="radio" name="reason" :value="r" />
              <span>{{ t(`refund.reason.${r}`) }}</span>
            </label>
          </fieldset>
          <div class="ac__f">
            <label for="rf-detail">{{ t('refund.detail') }}</label>
            <textarea
              id="rf-detail"
              v-model="detail"
              rows="3"
              maxlength="400"
              class="rf__ta"
              data-test="refund-detail"
            />
          </div>
          <ul class="rf__effects">
            <li>{{ t('refund.eff1') }}</li>
            <li>{{ t('refund.eff2') }}</li>
            <li>{{ t('refund.eff3') }}</li>
          </ul>
          <label class="rf__agree">
            <input v-model="agree" type="checkbox" data-test="refund-agree" />
            <span>{{ t('refund.agree') }}</span>
          </label>
          <small class="rf__err" role="alert">{{
            tried && !agree ? t('refund.errAgree') : ''
          }}</small>
          <div class="ac__act">
            <button
              type="submit"
              class="a-pill a-pill--solid"
              :disabled="busy"
              data-test="refund-submit"
            >
              {{ busy ? t('common.loading') : t('refund.submit', { n: rp(elig.amount) }) }}
            </button>
            <RouterLink class="a-pill" :to="{ name: 'order', params: { id } }">{{
              t('acct.cancel')
            }}</RouterLink>
          </div>
        </form>
      </template>
    </div>
  </ToneLight>
</template>

<style scoped>
.rf {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px var(--a-pad) 56px;
  display: grid;
  gap: 18px;
}
.rf__sum {
  margin: 0;
  display: grid;
  gap: 8px;
}
.rf__sum div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.rf__sum dt {
  color: var(--a-muted);
}
.rf__sum dd {
  margin: 0;
  font-weight: 600;
}
.rf__total {
  padding-top: 10px;
  border-top: 1px dashed var(--a-line);
  font-size: 20px;
}
.rf__total dt {
  color: var(--a-ink);
  font-weight: 600;
}
.rf__policy {
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--a-bg2);
}
.rf__policy :deep(svg) {
  flex: none;
  margin-top: 2px;
}
.rf__reasons {
  border: 0;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.rf__reasons legend {
  font-size: 22px;
  margin-bottom: 8px;
  padding: 0;
}
.rf__opt {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid var(--a-line);
  border-radius: 12px;
  cursor: pointer;
}
.rf__opt.on {
  border-color: var(--a-gold);
  background: var(--a-bg2);
}
.rf__opt input {
  accent-color: var(--a-gold);
  width: 18px;
  height: 18px;
}
.rf__ta {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--a-line);
  background: var(--a-bg);
  color: var(--a-ink);
  font: inherit;
  resize: vertical;
}
.rf__effects {
  margin: 0;
  padding-left: 20px;
  display: grid;
  gap: 4px;
  color: var(--a-muted);
  font-size: 14px;
}
.rf__agree {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.rf__agree input {
  margin-top: 3px;
  width: 18px;
  height: 18px;
  accent-color: var(--a-gold);
}
.rf__err {
  min-height: 16px;
  color: var(--a-danger);
  font-size: 13px;
}
</style>
