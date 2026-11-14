<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Discount2 } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { listVouchers, redeemVoucher, removeVoucher, type Voucher } from '@/api/account'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import { ApiError, toApiError } from '@/api/errors'
import { useApiMessage } from '@/composables/useApiMessage'
import { formatRupiah } from '@/utils/format'
import './accountStyle.css'

const { t, locale } = useI18n()
useHead({ title: computed(() => t('acct.nav_.vouchers')) })
const message = useMessage()
const apiMessage = useApiMessage()
const lc = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const rp = (n: number) => formatRupiah(n, lc.value)
const day = (iso: string) =>
  new Intl.DateTimeFormat(lc.value, { dateStyle: 'medium' }).format(new Date(iso))

const rows = ref<Voucher[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = await listVouchers()
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

const tab = ref<'active' | 'past'>('active')
const usable = (v: Voucher) => v.status === 'available' || v.status === 'upcoming'
const shown = computed(() => rows.value.filter((v) => (tab.value === 'active') === usable(v)))
const counts = computed(() => ({
  active: rows.value.filter(usable).length,
  past: rows.value.filter((v) => !usable(v)).length,
}))

const code = ref('')
const codeErr = ref('')
const busy = ref(false)
async function redeem(): Promise<void> {
  const c = code.value.trim()
  codeErr.value = ''
  if (c.length < 3) {
    codeErr.value = t('acct.voucher.errShort')
    return
  }
  busy.value = true
  try {
    const got = await redeemVoucher(c)
    code.value = ''
    tab.value = 'active'
    await load()
    message.success(t('acct.voucher.added', { n: got.length }))
  } catch (e) {
    const ae = toApiError(e)
    codeErr.value =
      ae instanceof ApiError && ae.code === 'PROMO_INVALID'
        ? t('acct.voucher.errUnknown')
        : apiMessage(e)
  } finally {
    busy.value = false
  }
}
async function remove(v: Voucher): Promise<void> {
  try {
    await removeVoucher(v.promo_id)
    rows.value = rows.value.filter((x) => x.promo_id !== v.promo_id)
    message.success(t('acct.voucher.removed'))
  } catch (e) {
    message.error(apiMessage(e))
  }
}
const worth = (v: Voucher) => (v.kind === 'percent' ? `${v.value}%` : rp(v.value))
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('acct.nav_.vouchers') }}</h1>

    <form class="ac__card vc__form" novalidate @submit.prevent="redeem">
      <label for="vc-code" class="vc__lbl">
        <NIcon :component="Discount2" :size="18" aria-hidden="true" />
        {{ t('acct.voucher.redeemTitle') }}
      </label>
      <div class="vc__line">
        <input
          id="vc-code"
          v-model="code"
          class="vc__input"
          data-test="voucher-code"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          maxlength="32"
          :placeholder="t('acct.voucher.placeholder')"
          :aria-invalid="!!codeErr"
          aria-describedby="vc-err"
        />
        <button
          type="submit"
          class="a-pill a-pill--solid"
          :disabled="busy"
          data-test="voucher-redeem"
        >
          {{ busy ? t('common.loading') : t('acct.voucher.redeem') }}
        </button>
      </div>
      <small id="vc-err" class="vc__err" role="alert">{{ codeErr }}</small>
      <small class="a-muted">{{ t('acct.voucher.help') }}</small>
    </form>

    <div class="ac__tabs" role="group" :aria-label="t('acct.filter')">
      <button
        v-for="k in ['active', 'past'] as const"
        :key="k"
        type="button"
        class="a-pill"
        :class="{ 'a-pill--solid': tab === k }"
        :aria-pressed="tab === k"
        @click="tab = k"
      >
        {{ t(`acct.voucher.tab.${k}`) }} ({{ counts[k] }})
      </button>
    </div>

    <SkeletonPage v-if="state === 'loading'" :rows="4" />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <EmptyState
      v-else-if="!shown.length"
      :title="t(tab === 'active' ? 'acct.voucher.emptyActive' : 'acct.voucher.emptyPast')"
      :body="t('acct.voucher.emptyBody')"
    />
    <ul v-else class="ac__list" data-test="vouchers">
      <li v-for="v in shown" :key="v.promo_id" class="vc" :class="{ 'is-off': !usable(v) }">
        <div class="vc__stub">
          <strong class="a-serif">{{ worth(v) }}</strong>
          <small>{{ t('acct.voucher.off') }}</small>
        </div>
        <div class="vc__body">
          <code class="vc__code">{{ v.code }}</code>
          <strong>{{ v.event_title }}</strong>
          <small class="a-muted">
            <template v-if="v.min_total > 0"
              >{{ t('acct.voucher.min', { n: rp(v.min_total) }) }} ·
            </template>
            <template v-if="v.ends_at">{{
              t('acct.voucher.until', { d: day(v.ends_at) })
            }}</template>
            <template v-else>{{ t('acct.voucher.noEnd') }}</template>
          </small>
        </div>
        <div class="vc__side">
          <span
            class="ac__badge"
            :class="
              v.status === 'available'
                ? 'is-paid'
                : v.status === 'upcoming'
                  ? 'is-pending'
                  : 'is-bad'
            "
          >
            {{ t(`acct.voucher.s.${v.status}`) }}
          </span>
          <div class="ac__act">
            <RouterLink
              v-if="usable(v)"
              class="a-pill a-pill--solid"
              :to="{ name: 'event', params: { slug: v.event_slug } }"
            >
              {{ t('acct.voucher.use') }}
            </RouterLink>
            <button
              type="button"
              class="a-pill"
              :aria-label="t('acct.voucher.remove', { c: v.code })"
              @click="remove(v)"
            >
              {{ t('acct.voucher.removeShort') }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.vc__form {
  gap: 8px;
}
.vc__lbl {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.vc__line {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.vc__input {
  flex: 1 1 220px;
  min-height: 48px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--a-line);
  background: var(--a-bg);
  color: var(--a-ink);
  font:
    600 16px/1 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.vc__input[aria-invalid='true'] {
  border-color: var(--a-danger);
}
.vc__err {
  min-height: 16px;
  color: var(--a-danger);
  font-size: 13px;
}
.vc {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr) auto;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
  overflow: hidden;
}
.vc.is-off {
  opacity: 0.62;
}
.vc__stub {
  display: grid;
  place-content: center;
  text-align: center;
  gap: 2px;
  padding: 18px 10px;
  background: var(--a-gold);
  color: var(--a-on-gold, var(--a-bg));
  border-right: 2px dashed var(--a-bg);
}
.vc__stub strong {
  font-size: 26px;
  line-height: 1.1;
}
.vc__body {
  display: grid;
  gap: 3px;
  padding: 16px 18px;
  min-width: 0;
  align-content: center;
}
.vc__body strong {
  overflow-wrap: anywhere;
}
.vc__code {
  justify-self: start;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--a-bg3);
  font-size: 13px;
  letter-spacing: 0.08em;
}
.vc__side {
  display: grid;
  gap: 10px;
  padding: 16px 18px;
  align-content: center;
  justify-items: end;
}
@media (max-width: 640px) {
  .vc {
    grid-template-columns: 96px minmax(0, 1fr);
  }
  .vc__side {
    grid-column: 1 / -1;
    justify-items: start;
    padding-top: 0;
  }
}
</style>
