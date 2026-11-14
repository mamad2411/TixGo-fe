<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Tag } from '@vicons/tabler'
import { useMessage } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { cancelListing, myListings, type ResaleListing } from '@/api/account'
import { myPayouts, setPayoutAccount, type SellerPayout } from '@/api/resale'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { formatRupiah } from '@/utils/format'
import './accountStyle.css'

// Jual-beli saya: tiket yang kupasang untuk dijual, dan pencairan hasilnya. Hasil jual dikirim ke rekening
// yang kamu isi di sini setelah pembeli membayar; BE hanya menerima rekening untuk pencairan milikmu.
const { t, locale } = useI18n()
useHead({ title: computed(() => t('rs.pageTitle')) })
const message = useMessage()
const apiMessage = useApiMessage()
const rp = (n: number) => formatRupiah(n, locale.value === 'en' ? 'en-GB' : 'id-ID')

const listings = ref<ResaleListing[]>([])
const payouts = ref<SellerPayout[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const busy = ref('')

async function load(): Promise<void> {
  state.value = 'loading'
  try {
    ;[listings.value, payouts.value] = await Promise.all([myListings(), myPayouts()])
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

async function cancel(l: ResaleListing): Promise<void> {
  busy.value = l.id
  try {
    await cancelListing(l.id)
    message.success(t('rs.cancelled'))
    await load()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = ''
  }
}

// ---- rekening pencairan ----
const open = ref('')
const form = reactive({ bank_code: '', account_name: '', account_no: '' })
const errs = reactive({ bank_code: '', account_name: '', account_no: '' })
function edit(p: SellerPayout): void {
  open.value = p.id
  form.bank_code = p.bank_code ?? ''
  form.account_name = p.account_name ?? ''
  form.account_no = ''
  Object.assign(errs, { bank_code: '', account_name: '', account_no: '' })
}
async function save(p: SellerPayout): Promise<void> {
  errs.bank_code = /^[A-Za-z0-9_]{2,16}$/.test(form.bank_code.trim()) ? '' : t('rs.errBank')
  errs.account_name = form.account_name.trim().length >= 2 ? '' : t('rs.errName')
  errs.account_no = /^[0-9]{6,20}$/.test(form.account_no.replace(/[\s-]/g, '')) ? '' : t('rs.errNo')
  if (errs.bank_code || errs.account_name || errs.account_no) return
  busy.value = p.id
  try {
    await setPayoutAccount(p.id, {
      bank_code: form.bank_code.trim(),
      account_name: form.account_name.trim(),
      account_no: form.account_no,
    })
    message.success(t('rs.accountSaved'))
    open.value = ''
    await load()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = ''
  }
}
const live = computed(() =>
  listings.value.filter((l) => l.status === 'active' || l.status === 'reserved'),
)
const past = computed(() =>
  listings.value.filter((l) => l.status !== 'active' && l.status !== 'reserved'),
)
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('rs.pageTitle') }}</h1>
    <p class="a-muted">{{ t('rs.pageLead') }}</p>
    <SkeletonPage v-if="state === 'loading'" :rows="3" />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <template v-else>
      <section class="ac__card" data-test="my-listings">
        <h2 class="a-serif">{{ t('rs.mine') }}</h2>
        <EmptyState
          v-if="!listings.length"
          :icon="Tag"
          :title="t('rs.noneTitle')"
          :body="t('rs.noneBody')"
        >
          <RouterLink :to="{ name: 'tickets' }" class="a-pill a-pill--solid">{{
            t('rs.toTickets')
          }}</RouterLink>
        </EmptyState>
        <ul v-else class="rsp">
          <li v-for="l in [...live, ...past]" :key="l.id" class="rsp__row" :data-status="l.status">
            <div class="rsp__info">
              <strong>{{ rp(l.price) }}</strong>
              <small class="a-muted"
                >{{ t('rs.face', { n: rp(l.face_price) }) }} ·
                {{ t(`rs.st.${l.status}`, l.status ?? '') }}</small
              >
            </div>
            <RouterLink
              v-if="l.ticket_id"
              :to="{ name: 'ticket', params: { id: l.ticket_id } }"
              class="a-pill a-pill--sm a-pill--ghost"
              >{{ t('rs.seeTicket') }}</RouterLink
            >
            <button
              v-if="l.status === 'active'"
              type="button"
              class="a-pill a-pill--sm"
              :aria-busy="busy === l.id"
              :disabled="busy === l.id"
              data-test="listing-cancel"
              @click="cancel(l)"
            >
              {{ t('rs.cancel') }}
            </button>
          </li>
        </ul>
      </section>

      <section v-if="payouts.length" class="ac__card" data-test="payouts">
        <h2 class="a-serif">{{ t('rs.payouts') }}</h2>
        <ul class="rsp">
          <li v-for="p in payouts" :key="p.id" class="rsp__col" :data-status="p.status">
            <div class="rsp__row">
              <div class="rsp__info">
                <strong>{{ rp(p.amount) }}</strong>
                <small class="a-muted">{{ t(`rs.pst.${p.status}`) }}</small>
              </div>
              <button
                v-if="p.status !== 'paid'"
                type="button"
                class="a-pill a-pill--sm"
                :class="{ 'a-pill--solid': p.status === 'awaiting_account' }"
                data-test="payout-edit"
                @click="open === p.id ? (open = '') : edit(p)"
              >
                {{ p.status === 'awaiting_account' ? t('rs.fillAccount') : t('rs.changeAccount') }}
              </button>
              <small v-else class="a-muted">{{ p.bank_code }} · {{ p.account_name }}</small>
            </div>
            <form v-if="open === p.id" class="rsp__form" novalidate @submit.prevent="save(p)">
              <label>
                {{ t('rs.bank') }}
                <input v-model="form.bank_code" data-test="acc-bank" placeholder="BCA" />
                <small v-if="errs.bank_code" class="rsp__err" role="alert">{{
                  errs.bank_code
                }}</small>
              </label>
              <label>
                {{ t('rs.accName') }}
                <input v-model="form.account_name" data-test="acc-name" autocomplete="name" />
                <small v-if="errs.account_name" class="rsp__err" role="alert">{{
                  errs.account_name
                }}</small>
              </label>
              <label>
                {{ t('rs.accNo') }}
                <input v-model="form.account_no" data-test="acc-no" inputmode="numeric" />
                <small v-if="errs.account_no" class="rsp__err" role="alert">{{
                  errs.account_no
                }}</small>
              </label>
              <button
                type="submit"
                class="a-pill a-pill--solid"
                :aria-busy="busy === p.id"
                :disabled="busy === p.id"
                data-test="acc-save"
              >
                {{ t('rs.saveAccount') }}
              </button>
            </form>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.rsp {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.rsp__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.rsp__col {
  display: grid;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--a-line);
}
.rsp__info {
  display: grid;
  gap: 2px;
  margin-right: auto;
}
.rsp__form {
  display: grid;
  gap: 12px;
  max-width: 420px;
}
.rsp__form label {
  display: grid;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
}
.rsp__form input {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--a-line-strong);
  border-radius: 12px;
  background: var(--a-panel);
  color: var(--a-ink);
  font: inherit;
}
.rsp__form input:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 2px;
}
.rsp__err {
  color: var(--a-danger, #b3261e);
  font-weight: 400;
}
</style>
