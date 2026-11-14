<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { ArrowsMaximize, CalendarPlus, Copy, Send, Tag, X } from '@vicons/tabler'
import { NIcon, NModal, useMessage } from 'naive-ui'
import QRCode from 'qrcode'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import {
  createResale,
  createTransfer,
  getTicket,
  getTicketQR,
  myListings,
  cancelListing,
  revokeTransfer,
  type ClaimLink,
  type ResaleListing,
  type TicketDetail,
} from '@/api/account'
import { ApiError, toApiError } from '@/api/errors'
import BackLink from '@/components/app/BackLink.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import ReviewForm from '@/components/app/ReviewForm.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { formatEventDate, formatRupiah } from '@/utils/format'
import './accountStyle.css'

// Tiket digital: QR dinamis (TOTP) yang diganti otomatis sebelum kedaluwarsa — tangkapan layar cepat usang.
const { t, locale } = useI18n()
const route = useRoute()
const message = useMessage()
const apiMessage = useApiMessage()
const id = computed(() => String(route.params.id))
// Aturan bisnis (resale dilarang penyelenggara, harga melebihi plafon, dst.) harus terbaca spesifik oleh pembeli.
const RULE = ['NOT_ALLOWED', 'VALIDATION_FAILED', 'LIMIT_EXCEEDED', 'INVALID_STATE']
function ruleMessage(e: unknown): string {
  const ae = toApiError(e)
  return ae instanceof ApiError && RULE.includes(ae.code) && ae.message ? ae.message : apiMessage(e)
}
const lc = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const rp = (n: number) => formatRupiah(n, lc.value)
useHead({ title: computed(() => t('tk.title')) })

const tk = ref<TicketDetail | null>(null)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const listing = ref<ResaleListing | null>(null)
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    tk.value = await getTicket(id.value)
    state.value = 'ok'
    void refreshQR()
    listing.value =
      (await myListings().catch(() => [])).find(
        (l) => l.ticket_id === id.value && l.status === 'active',
      ) ?? null
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}

// ---- QR berputar ----
const qrImg = ref('')
const qrLeft = ref(0)
const qrStep = ref(30)
const qrErr = ref('')
let qrTimer: ReturnType<typeof setTimeout> | undefined
let tick: ReturnType<typeof setInterval> | undefined
let until = 0
async function refreshQR(): Promise<void> {
  clearTimeout(qrTimer)
  if (!tk.value?.qr_available) return
  try {
    const q = await getTicketQR(id.value)
    qrImg.value = await QRCode.toDataURL(q.payload, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'M',
    })
    qrStep.value = q.step_sec
    until = new Date(q.valid_until).getTime()
    qrErr.value = ''
    qrTimer = setTimeout(() => void refreshQR(), Math.max(1000, until - Date.now() - 1500))
  } catch (e) {
    qrErr.value = apiMessage(e)
    qrTimer = setTimeout(() => void refreshQR(), 10000)
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  void load()
  tick = setInterval(
    () => (qrLeft.value = Math.max(0, Math.ceil((until - Date.now()) / 1000))),
    500,
  )
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  closeFull()
  clearTimeout(qrTimer)
  clearInterval(tick)
})

const status = computed(() => tk.value?.status ?? '')
const live = computed(() => status.value === 'valid' || status.value === 'active')

// ---- layar penuh di pintu masuk ----
const full = ref(false)
const closeBtn = ref<HTMLButtonElement>()
let wake: { release(): Promise<void> } | null = null
async function openFull(): Promise<void> {
  full.value = true
  try {
    wake =
      (await (
        navigator as unknown as {
          wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> }
        }
      ).wakeLock?.request('screen')) ?? null
  } catch {
    wake = null // tidak didukung / ditolak: layar boleh mati, QR tetap tampil
  }
  await nextTick()
  closeBtn.value?.focus()
}
function closeFull(): void {
  full.value = false
  void wake?.release().catch(() => undefined)
  wake = null
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && full.value) closeFull()
}

// ---- kirim tiket ----
const xferOpen = ref(false)
const xferEmail = ref('')
const xferEmailErr = ref('')
const xferBusy = ref(false)
const claim = ref<ClaimLink | null>(null)
async function sendTicket(): Promise<void> {
  xferEmailErr.value = ''
  const e = xferEmail.value.trim()
  if (e && !/^\S+@\S+\.\S+$/.test(e)) {
    xferEmailErr.value = t('tk.errEmail')
    return
  }
  xferBusy.value = true
  try {
    claim.value = await createTransfer(id.value, e || undefined)
  } catch (er) {
    xferEmailErr.value = ruleMessage(er)
  } finally {
    xferBusy.value = false
  }
}
async function copyLink(): Promise<void> {
  if (!claim.value?.link) return
  try {
    await navigator.clipboard.writeText(claim.value.link)
    message.success(t('tk.copied'))
  } catch {
    message.error(t('tk.copyFail'))
  }
}
async function revoke(): Promise<void> {
  try {
    await revokeTransfer(id.value)
    claim.value = null
    message.success(t('tk.revoked'))
  } catch (e) {
    message.error(apiMessage(e))
  }
}
function closeXfer(): void {
  xferOpen.value = false
  claim.value = null
  xferEmail.value = ''
  xferEmailErr.value = ''
}

// ---- jual ulang ----
const resaleOpen = ref(false)
const price = ref('')
const priceErr = ref('')
const resaleBusy = ref(false)
async function listIt(): Promise<void> {
  priceErr.value = ''
  const n = Number(price.value.replace(/\D/g, ''))
  if (!n || n < 1000) {
    priceErr.value = t('tk.errPrice')
    return
  }
  resaleBusy.value = true
  try {
    listing.value = await createResale(id.value, n)
    resaleOpen.value = false
    message.success(t('tk.listed'))
  } catch (e) {
    priceErr.value = ruleMessage(e)
  } finally {
    resaleBusy.value = false
  }
}
async function unlist(): Promise<void> {
  if (!listing.value) return
  try {
    await cancelListing(listing.value.id)
    listing.value = null
    message.success(t('tk.unlisted'))
  } catch (e) {
    message.error(apiMessage(e))
  }
}
</script>

<template>
  <div class="ac">
    <BackLink plain :fallback="{ name: 'tickets' }" :label="t('acct.nav_.tickets')" />
    <SkeletonPage v-if="state === 'loading'" variant="detail" />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />

    <article v-else-if="tk" class="tk" data-test="ticket">
      <div class="tk__main">
        <p class="a-caps">
          {{ tk.tier_name }}<template v-if="tk.seat_label"> · {{ tk.seat_label }}</template>
        </p>
        <h1 class="a-serif ac__title">{{ tk.event_title }}</h1>
        <dl class="tk__facts">
          <div>
            <dt>{{ t('tk.when') }}</dt>
            <dd>{{ formatEventDate(tk.starts_at, tk.tz, lc) }}</dd>
          </div>
          <div v-if="tk.doors_at">
            <dt>{{ t('tk.doors') }}</dt>
            <dd>{{ formatEventDate(tk.doors_at, tk.tz, lc) }}</dd>
          </div>
          <div>
            <dt>{{ t('tk.where') }}</dt>
            <dd>
              {{ tk.venue_name
              }}<template v-if="tk.venue_address">, {{ tk.venue_address }}</template>
            </dd>
          </div>
          <div v-if="tk.attendee_name">
            <dt>{{ t('tk.holder') }}</dt>
            <dd>{{ tk.attendee_name }}</dd>
          </div>
          <div v-if="tk.entry_number">
            <dt>{{ t('tk.entry') }}</dt>
            <dd>{{ tk.entry_number }}</dd>
          </div>
        </dl>
        <span class="ac__badge tk__badge" :class="live ? 'is-paid' : 'is-bad'">{{
          t(`tk.s.${status}`, status)
        }}</span>
        <p
          v-if="tk.schedule_state !== 'scheduled' && tk.schedule_state"
          class="tk__warn"
          role="status"
        >
          {{ t(`tk.sched.${tk.schedule_state}`, t('tk.schedChanged')) }}
        </p>
      </div>

      <div class="tk__qr" data-test="qr-box">
        <template v-if="tk.qr_available && qrImg">
          <img :src="qrImg" :alt="t('tk.qrAlt')" width="260" height="260" data-test="qr" />
          <div class="tk__bar" role="timer" aria-live="off">
            <span :style="{ width: `${Math.min(100, (qrLeft / qrStep) * 100)}%` }" />
          </div>
          <small class="a-muted">{{ t('tk.qrRefresh', { n: qrLeft }) }}</small>
          <button type="button" class="tk__full" data-test="qr-full" @click="openFull">
            <NIcon :component="ArrowsMaximize" :size="16" aria-hidden="true" /> {{ t('tk.full') }}
          </button>
        </template>
        <p v-else-if="qrErr" class="tk__warn" role="alert">{{ qrErr }}</p>
        <p v-else class="a-muted">{{ t(live ? 'tk.qrLoading' : 'tk.qrOff') }}</p>
      </div>
    </article>

    <ReviewForm v-if="tk && status === 'used'" :ticket-id="tk.id" />

    <section v-if="tk && live" class="ac__card">
      <h2 class="a-serif">{{ t('tk.actions') }}</h2>
      <div class="ac__act">
        <button type="button" class="a-pill" data-test="open-transfer" @click="xferOpen = true">
          <NIcon :component="Send" :size="16" aria-hidden="true" /> {{ t('tk.send') }}
        </button>
        <button
          v-if="!listing"
          type="button"
          class="a-pill"
          data-test="open-resale"
          @click="resaleOpen = true"
        >
          <NIcon :component="Tag" :size="16" aria-hidden="true" /> {{ t('tk.resale') }}
        </button>
        <a class="a-pill" :href="`/api/v1/events/${tk.event_slug}/calendar.ics`">
          <NIcon :component="CalendarPlus" :size="16" aria-hidden="true" /> {{ t('tk.calendar') }}
        </a>
        <RouterLink class="a-pill" :to="{ name: 'event', params: { slug: tk.event_slug } }">{{
          t('acct.eventPage')
        }}</RouterLink>
      </div>
      <p v-if="listing" class="tk__listing" data-test="listing">
        {{ t('tk.listedAt', { p: rp(listing.price) }) }}
        <button type="button" class="od__link" @click="unlist">{{ t('tk.unlist') }}</button>
      </p>
    </section>

    <Teleport to="body">
      <div
        v-if="full && tk"
        class="tkf"
        role="dialog"
        aria-modal="true"
        :aria-label="t('tk.fullTitle')"
        data-test="qr-overlay"
      >
        <button
          ref="closeBtn"
          type="button"
          class="tkf__close"
          data-test="qr-close"
          @click="closeFull"
        >
          <NIcon :component="X" :size="20" aria-hidden="true" /> {{ t('tk.fullClose') }}
        </button>
        <p class="tkf__name">{{ tk.event_title }}</p>
        <p class="tkf__sub">
          {{ tk.tier_name }}<template v-if="tk.seat_label"> · {{ tk.seat_label }}</template>
        </p>
        <img v-if="qrImg" :src="qrImg" :alt="t('tk.qrAlt')" class="tkf__qr" />
        <div class="tkf__bar" aria-hidden="true">
          <span :style="{ width: `${Math.min(100, (qrLeft / qrStep) * 100)}%` }" />
        </div>
        <p class="tkf__tip">{{ t('tk.fullTip') }}</p>
      </div>
    </Teleport>

    <NModal
      v-model:show="xferOpen"
      preset="card"
      :title="t('tk.sendTitle')"
      style="max-width: 460px"
      @after-leave="closeXfer"
    >
      <template v-if="!claim">
        <p class="a-muted">{{ t('tk.sendBody') }}</p>
        <div class="ac__f">
          <label for="tk-mail">{{ t('tk.sendEmail') }}</label>
          <input
            id="tk-mail"
            v-model="xferEmail"
            type="email"
            autocomplete="off"
            data-test="transfer-email"
          />
          <small role="alert">{{ xferEmailErr }}</small>
        </div>
        <button
          type="button"
          class="a-pill a-pill--solid"
          :disabled="xferBusy"
          data-test="transfer-create"
          @click="sendTicket"
        >
          {{ xferBusy ? t('common.loading') : t('tk.sendCreate') }}
        </button>
      </template>
      <template v-else>
        <p>{{ t('tk.linkReady') }}</p>
        <input
          class="tk__link"
          :value="claim.link"
          readonly
          :aria-label="t('tk.linkLabel')"
          data-test="transfer-link"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <div class="ac__act">
          <button type="button" class="a-pill a-pill--solid" @click="copyLink">
            <NIcon :component="Copy" :size="16" aria-hidden="true" /> {{ t('tk.copy') }}
          </button>
          <button type="button" class="a-pill" data-test="transfer-revoke" @click="revoke">
            {{ t('tk.revoke') }}
          </button>
        </div>
        <small class="a-muted">{{ t('tk.linkNote') }}</small>
      </template>
    </NModal>

    <NModal
      v-model:show="resaleOpen"
      preset="card"
      :title="t('tk.resaleTitle')"
      style="max-width: 460px"
    >
      <p class="a-muted">{{ t('tk.resaleBody') }}</p>
      <div class="ac__f">
        <label for="tk-price">{{ t('tk.price') }}</label>
        <input
          id="tk-price"
          v-model="price"
          inputmode="numeric"
          autocomplete="off"
          data-test="resale-price"
        />
        <small role="alert">{{ priceErr }}</small>
      </div>
      <button
        type="button"
        class="a-pill a-pill--solid"
        :disabled="resaleBusy"
        data-test="resale-create"
        @click="listIt"
      >
        {{ resaleBusy ? t('common.loading') : t('tk.resaleCreate') }}
      </button>
    </NModal>
  </div>
</template>

<style scoped>
.tk {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr);
  padding: 22px;
  border: 1px solid var(--a-line);
  border-radius: 20px;
  background: var(--a-panel);
}
@media (min-width: 760px) {
  .tk {
    grid-template-columns: minmax(0, 1fr) 300px;
  }
}
.tk__main {
  display: grid;
  gap: 12px;
  align-content: start;
}
.tk__badge {
  justify-self: start;
}
.tk__facts {
  margin: 0;
  display: grid;
  gap: 8px;
}
.tk__facts div {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 10px;
}
.tk__facts dt {
  color: var(--a-muted);
}
.tk__facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.tk__qr {
  display: grid;
  gap: 10px;
  justify-items: center;
  align-content: center;
  padding: 16px;
  border-radius: 16px;
  background: #fff;
  color: #1c1812;
  border: 2px dashed var(--a-line-strong, var(--a-line));
}
.tk__qr img {
  width: min(260px, 100%);
  height: auto;
  image-rendering: pixelated;
}
.tk__qr small,
.tk__qr p {
  color: #5f574a;
  text-align: center;
  margin: 0;
}
.tk__full {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid #8a5a12;
  background: #fff;
  color: #8a5a12;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.tk__full:hover {
  background: #f6f2ea;
}
.tk__bar {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgb(28 24 18 / 0.12);
  overflow: hidden;
}
.tk__bar span {
  display: block;
  height: 100%;
  background: #8a5a12;
  transition: width 0.5s linear;
}
.tk__warn {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--a-bg2);
  color: var(--a-danger);
}
.tk__listing {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.tk__link {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--a-line);
  background: var(--a-bg);
  color: var(--a-ink);
  font:
    13px ui-monospace,
    Menlo,
    monospace;
  margin: 10px 0;
}
.od__link {
  background: none;
  border: 0;
  color: var(--a-gold);
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
  padding: 0;
  min-height: 24px;
}
</style>

<style>
/* Overlay di <body>: tidak ikut gaya ber-scope/token halaman, selalu putih agar pemindai gerbang terbaca. */
.tkf {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: #fff;
  color: #1c1812;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 14px;
  padding: 24px;
  text-align: center;
}
.tkf__close {
  position: absolute;
  top: 16px;
  right: 16px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 48px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid #1c1812;
  background: #fff;
  color: #1c1812;
  font: inherit;
  font-size: 15px;
  cursor: pointer;
}
.tkf__name {
  margin: 0;
  font-size: clamp(20px, 4vw, 28px);
  font-weight: 700;
  overflow-wrap: anywhere;
}
.tkf__sub {
  margin: 0;
  font-size: 16px;
  color: #5f574a;
}
.tkf__qr {
  width: min(86vw, 62vh);
  height: min(86vw, 62vh);
  image-rendering: pixelated;
}
.tkf__bar {
  width: min(86vw, 62vh);
  height: 8px;
  border-radius: 4px;
  background: rgb(28 24 18 / 0.12);
  overflow: hidden;
}
.tkf__bar span {
  display: block;
  height: 100%;
  background: #8a5a12;
  transition: width 0.5s linear;
}
.tkf__tip {
  margin: 0;
  font-size: 15px;
  color: #5f574a;
  max-width: 36ch;
}
</style>
