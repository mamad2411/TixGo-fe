<script setup lang="ts">
import { queueStatus } from '@/api/queue'
import { useAdmissionStore } from '@/stores/admission'
import { Armchair, Minus, Plus } from '@vicons/tabler'
import { NIcon, NModal, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { joinWaitlist, setReminder, removeReminder, type PublicEvent } from '@/api/events'
import { toApiError } from '@/api/errors'
import { createHold } from '@/api/orders'
import Countdown from '@/components/app/Countdown.vue'
import PresaleBox from '@/components/app/PresaleBox.vue'
import SquadStart from '@/components/app/SquadStart.vue'
import type { SeatPick } from '@/components/venue/VenueExplorer.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useRequireLogin } from '@/composables/useRequireLogin'
import { useAuthStore } from '@/stores/auth'
import { formatRupiah } from '@/utils/format'
import { tierIcon } from '@/utils/icons'

const props = defineProps<{ event: PublicEvent; picked: SeatPick[] }>()
const emit = defineEmits<{ 'update:picked': [SeatPick[]] }>()
const tierId = defineModel<string>('tier', { default: '' })

const { t, locale } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
const apiMessage = useApiMessage()
const requireLogin = useRequireLogin()

const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const rp = (n: number) => formatRupiah(n, bcp.value)

const seated = computed(() => props.event.has_seatmap)
const state = computed(() => props.event.sale_state)
const soldOut = computed(() => ['sold_out', 'full_booked'].includes(state.value))
const tiers = computed(() => props.event.tiers)
const buyable = (s: string) => s === 'available' || s === 'almost_gone'

const qty = ref(1)
watch(
  tiers,
  (list) => {
    const first = list.find((x) => buyable(x.status)) ?? list[0]
    if (first && !list.some((x) => x.id === tierId.value)) tierId.value = first.id
  },
  { immediate: true },
)
const tier = computed(() => tiers.value.find((x) => x.id === tierId.value))
const maxQty = computed(() =>
  Math.max(
    1,
    Math.min(props.event.max_per_order, soldOut.value ? 10 : (tier.value?.available ?? 1)),
  ),
)
watch([tierId, maxQty], () => {
  if (qty.value > maxQty.value) qty.value = maxQty.value
})

// Estimasi tampilan = harga akhir per tiket (server) x jumlah. Total resmi (voucher, biaya) = halaman checkout.
const total = computed(() =>
  seated.value
    ? props.picked.reduce((a, p) => a + p.price, 0)
    : tier.value
      ? tier.value.final_price * qty.value
      : 0,
)
const count = computed(() => (seated.value ? props.picked.length : qty.value))

const opensAt = computed(() => {
  const now = Date.now()
  return (
    props.event.phases
      .map((p) => p.starts_at)
      .filter((s) => Date.parse(s) > now)
      .sort()[0] ?? null
  )
})

const busy = ref(false)
const waitlisted = ref(false)
const queueInfo = ref(false)

// Pengingat tidak punya endpoint baca (kontrak hanya POST/DELETE /events/{slug}/reminders), jadi
// statusnya disimpan di peramban per akun. Tanpa ini tombol kembali ke "Ingatkan" setiap halaman
// dibuka ulang. Kuncinya memuat id pengguna supaya tidak bocor antar akun di perangkat yang sama.
const REMIND_KEY = 'tixgo.remind'
const remindKey = computed(() => `${REMIND_KEY}.${auth.user?.id ?? 'tamu'}`)

function readReminded(): boolean {
  try {
    const raw = localStorage.getItem(remindKey.value)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) && list.includes(props.event.slug)
  } catch {
    return false
  }
}

function writeReminded(on: boolean): void {
  try {
    const raw = localStorage.getItem(remindKey.value)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    const list = new Set<string>(Array.isArray(parsed) ? (parsed as string[]) : [])
    if (on) list.add(props.event.slug)
    else list.delete(props.event.slug)
    localStorage.setItem(remindKey.value, JSON.stringify([...list]))
  } catch {
    // penyimpanan diblokir: status hanya bertahan selama halaman terbuka
  }
}

const reminded = ref(false)
watch(
  () => [props.event.slug, auth.user?.id],
  () => {
    reminded.value = auth.isAuthed && readReminded()
  },
  { immediate: true },
)

const admission = useAdmissionStore()
// Batas per akun hanya bisa diketahui dari server. Setelah ditolak, tombol berhenti ditawarkan
// supaya pengguna tidak mengulang klik yang pasti gagal.
const limitHit = ref<{ already: number; limit: number } | null>(null)

function meter(x: { capacity: number; available: number }): number {
  return x.capacity > 0 ? Math.round(((x.capacity - x.available) / x.capacity) * 100) : 100
}

// Syarat sebelum menahan kursi (beli biasa maupun squad): masuk, email+HP terverifikasi, dan bila acara wajib
// antre, token admisi yang masih berlaku. Mengembalikan token (atau undefined bila tak perlu) dan `null` bila
// pengguna sudah dialihkan ke halaman lain (login/verifikasi/ruang tunggu).
async function ensureReady(): Promise<string | undefined | null> {
  if (!(await requireLogin('tickets.needLogin'))) return null
  if (!auth.emailVerified) {
    message.info(t('tickets.needEmail'))
    await router.push({ name: 'verify-email', query: { next: router.currentRoute.value.fullPath } })
    return null
  }
  if (!auth.phoneVerified) {
    message.info(t('tickets.needPhone'))
    await router.push({ name: 'verify-phone', query: { next: router.currentRoute.value.fullPath } })
    return null
  }
  if (!props.event.queue_required) return undefined
  let token = admission.valid(props.event.slug)
  if (!token) {
    const q = await queueStatus(props.event.slug).catch(() => null)
    if (q?.state === 'admitted' && q.token) {
      admission.set(props.event.slug, q.token, q.expires_at)
      token = q.token
    }
  }
  if (!token) {
    await router.push({ name: 'queue', params: { slug: props.event.slug } })
    return null
  }
  return token
}

async function buy(): Promise<void> {
  busy.value = true
  try {
    const token = await ensureReady()
    if (token === null) return
    const hold = await createHold(
      props.event.slug,
      seated.value
        ? { seat_ids: props.picked.map((p) => p.id) }
        : { tier_id: tierId.value, qty: qty.value },
      token,
    )
    await router.push({ name: 'checkout', params: { holdId: hold.id } })
  } catch (e) {
    const err = toApiError(e)
    if (props.event.queue_required && /ADMISSION|QUEUE/.test(err.code)) {
      admission.clear(props.event.slug)
      await router.push({ name: 'queue', params: { slug: props.event.slug } })
      return
    }
    if (err.code === 'LIMIT_EXCEEDED' && err.details.scope === 'account') {
      limitHit.value = { already: Number(err.details.already), limit: Number(err.details.limit) }
    }
    message.error(apiMessage(e))
    emit('update:picked', []) // pilihan mungkin basi; biarkan peta menyegarkan status
  } finally {
    busy.value = false
  }
}

async function remind(): Promise<void> {
  if (!(await requireLogin('tickets.needLoginRemind'))) return
  busy.value = true
  try {
    if (reminded.value) {
      await removeReminder(props.event.slug)
      reminded.value = false
      message.success(t('tickets.reminderOff'))
    } else {
      await setReminder(props.event.slug)
      reminded.value = true
      message.success(t('tickets.reminderOn'))
    }
    writeReminded(reminded.value)
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}

async function waitlist(): Promise<void> {
  if (!(await requireLogin('tickets.needLoginWait')) || !tier.value) return
  busy.value = true
  try {
    await joinWaitlist(props.event.slug, tier.value.id, qty.value)
    waitlisted.value = true
    message.success(t('tickets.waitlistOk'))
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}

const closedKey = computed(() => {
  if (state.value === 'ended') return 'tickets.ended'
  if (state.value === 'cancelled') return 'tickets.cancelled'
  if (state.value === 'paused') return 'tickets.paused'
  return ''
})
const canBuy = computed(
  () =>
    !limitHit.value &&
    (seated.value ? props.picked.length > 0 : !!tier.value && buyable(tier.value.status)),
)
</script>

<template>
  <aside id="tiket" class="tp" :aria-label="t('tickets.title')">
    <header class="tp__head">
      <h2 class="a-serif tp__title">{{ t('tickets.title') }}</h2>
      <p v-if="event.queue_required && state === 'onsale'" class="tp__queue">
        {{ t('tickets.queueNote') }}
      </p>
    </header>

    <div v-if="state === 'upcoming' && opensAt" class="tp__soon">
      <p class="a-caps">{{ t('tickets.opensIn') }}</p>
      <Countdown :to="opensAt" />
    </div>
    <p v-if="closedKey" class="tp__closed" role="status">{{ t(closedKey) }}</p>

    <!-- kategori (acara berdiri: dipilih di sini atau dengan klik zona di denah) -->
    <fieldset v-if="tiers.length && !seated" class="tp__tiers" :disabled="!!closedKey">
      <legend class="a-sr">{{ t('tickets.pickTier') }}</legend>
      <label
        v-for="x in tiers"
        :key="x.id"
        class="tier"
        :class="{ 'is-on': tierId === x.id, 'is-off': !buyable(x.status) && state === 'onsale' }"
      >
        <input v-model="tierId" type="radio" name="tier" :value="x.id" class="a-sr" />
        <span class="tier__top">
          <span class="tier__name"
            ><NIcon :component="tierIcon(x.name)" :size="18" aria-hidden="true" />{{ x.name }}</span
          >
          <span class="tier__price">{{ rp(x.final_price) }}</span>
        </span>
        <span class="tier__bar" aria-hidden="true"><i :style="{ width: meter(x) + '%' }" /></span>
        <span class="tier__sub">
          <span :class="`st st--${x.status}`">
            <template v-if="x.status === 'almost_gone'">{{
              t('tickets.left', { n: x.available })
            }}</template>
            <template v-else>{{ t(`tickets.status.${x.status}`) }}</template>
          </span>
          <small>{{ t('tickets.feeIncluded', { fee: rp(x.fee) }) }}</small>
        </span>
      </label>
    </fieldset>

    <!-- acara bernomor: ringkasan kursi dari denah -->
    <div
      v-if="seated && !closedKey && state === 'onsale'"
      class="tp__seats"
      data-test="panel-seats"
    >
      <p v-if="!picked.length" class="tp__empty">
        <NIcon :component="Armchair" :size="20" aria-hidden="true" /> {{ t('seats.panelEmpty') }}
      </p>
      <ul v-else>
        <li v-for="p in picked" :key="p.id">
          <span>{{ p.label }}</span><small class="a-muted">{{ p.tierName }}</small
          ><b>{{ rp(p.price) }}</b>
        </li>
      </ul>
      <a v-if="!picked.length" class="a-pill" href="#denah">{{ t('seats.goMap') }}</a>
    </div>

    <div
      v-if="!seated && !closedKey && tiers.length && (state === 'onsale' || soldOut)"
      class="tp__qty"
    >
      <span id="qty-l">{{ t('tickets.qty') }}</span>
      <div class="step" role="group" aria-labelledby="qty-l">
        <button type="button" :aria-label="t('tickets.less')" :disabled="qty <= 1" @click="qty--">
          <NIcon :component="Minus" :size="18" aria-hidden="true" />
        </button>
        <output aria-live="polite" data-test="qty">{{ qty }}</output>
        <button
          type="button"
          :aria-label="t('tickets.more')"
          :disabled="qty >= maxQty"
          @click="qty++"
        >
          <NIcon :component="Plus" :size="18" aria-hidden="true" />
        </button>
      </div>
      <small class="a-muted">{{ t('tickets.maxPer', { n: event.max_per_order }) }}</small>
    </div>

    <div v-if="state === 'onsale' && (tier || picked.length)" class="tp__sum" aria-live="polite">
      <span
        >{{ t('tickets.estimate') }} <small class="a-muted">({{ count }})</small></span
      >
      <strong data-test="total">{{ rp(total) }}</strong>
    </div>

    <PresaleBox v-if="!closedKey" :event="event" />

    <div class="tp__cta">
      <button
        v-if="state === 'onsale'"
        type="button"
        class="a-pill a-pill--solid tp__btn"
        data-test="buy"
        :disabled="!canBuy || busy"
        @click="buy"
      >
        {{
          limitHit
            ? t('tickets.limitReached', { limit: limitHit.limit })
            : event.queue_required
              ? t('tickets.joinQueue')
              : seated
                ? t('tickets.holdSeats', { n: picked.length })
                : t('tickets.buy')
        }}
      </button>
      <p v-if="limitHit && state === 'onsale'" class="tp__limit" data-test="limit-hit">
        {{ t('tickets.limitNote', { already: limitHit.already, limit: limitHit.limit }) }}
      </p>
      <template v-else-if="state === 'upcoming'">
        <button
          type="button"
          class="a-pill a-pill--solid tp__btn"
          data-test="remind"
          :aria-pressed="reminded"
          :disabled="busy"
          @click="remind"
        >
          {{ reminded ? t('tickets.reminded') : t('tickets.remind') }}
        </button>
      </template>
      <template v-else-if="soldOut">
        <button
          v-if="!waitlisted"
          type="button"
          class="a-pill a-pill--solid tp__btn"
          data-test="waitlist"
          :disabled="busy"
          @click="waitlist"
        >
          {{ t('tickets.waitlist') }}
        </button>
        <p v-else class="tp__ok" role="status">{{ t('tickets.waitlistOk') }}</p>
      </template>
      <SquadStart
        v-if="state === 'onsale'"
        :event="event"
        :tier-id="tierId"
        :seat-ids="picked.map((p) => p.id)"
        :prepare="ensureReady"
        :disabled="!!limitHit"
      />
      <p class="tp__fine">{{ t('tickets.fine') }}</p>
    </div>

    <NModal
      v-model:show="queueInfo"
      preset="card"
      :title="t('tickets.queueTitle')"
      style="max-width: 460px"
      :bordered="false"
    >
      <p>{{ t('tickets.queueBody') }}</p>
      <template #footer
        ><button type="button" class="a-pill" @click="queueInfo = false">
          {{ t('common.close') }}
        </button></template
      >
    </NModal>
  </aside>
</template>

<style scoped>
.tp {
  display: grid;
  gap: 18px;
  padding: 24px;
  border: 1px solid var(--a-line-strong);
  border-radius: 24px;
  background: linear-gradient(180deg, var(--a-bg2), var(--a-bg));
  box-shadow: var(--a-shadow);
}
.tp__title {
  font-size: 34px;
  color: var(--a-cream);
}
.tp__queue {
  margin-top: 6px;
  font-size: 14px;
  color: var(--a-gold);
}
.tp__soon {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 16px;
  background: var(--a-bg3);
}
.tp__closed {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--a-danger);
  color: var(--a-danger);
}
/* Keterangan batas akun: tampil menetap setelah server menolak, bukan hanya kilas pesan. */
.tp__limit {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--a-muted);
}
.tp__tiers {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
}
.tier {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-bg3);
  cursor: pointer;
  transition:
    border-color 0.18s,
    background 0.18s;
}
.tier:hover {
  border-color: var(--a-line-strong);
}
.tier.is-on {
  border-color: var(--a-gold);
  box-shadow: 0 0 0 1px var(--a-gold) inset;
}
.tier:has(input:focus-visible) {
  outline: 2px solid var(--a-gold);
  outline-offset: 3px;
}
.tier.is-off {
  opacity: 0.55;
  cursor: not-allowed;
}
.tier__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}
.tier__name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: var(--a-cream);
}
.tier__price {
  font-family: var(--a-serif);
  font-size: 26px;
  color: var(--a-gold);
}
.tier__bar {
  height: 4px;
  border-radius: 4px;
  background: rgb(239 229 207 / 0.14);
  overflow: hidden;
}
.tier__bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--a-gold-d), var(--a-gold));
}
.tier__sub {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}
.tier__sub small {
  color: var(--a-muted);
}
.st--almost_gone {
  color: var(--a-danger);
  font-weight: 700;
}
.st--available {
  color: var(--a-ok);
}
.st--sold_out,
.st--full_booked,
.st--unavailable {
  color: var(--a-muted);
}
.tp__seats {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px dashed var(--a-line-strong);
  border-radius: 16px;
}
.tp__empty {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--a-muted);
  font-size: 14px;
}
.tp__seats ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tp__seats li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 10px;
  align-items: baseline;
  font-size: 14px;
}
.tp__seats li b {
  color: var(--a-gold);
}
.tp__qty {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 4px 12px;
}
.tp__qty small {
  grid-column: 1 / -1;
}
.step {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
}
.step button {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--a-gold);
  cursor: pointer;
}
.step button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.step output {
  min-width: 36px;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.tp__sum {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-top: 14px;
  border-top: 1px dashed var(--a-line-strong);
}
.tp__sum strong {
  font-family: var(--a-serif);
  font-size: 34px;
  color: var(--a-cream);
  font-weight: 400;
}
/* Tombol utama, sekunder (Beli bareng), dan catatan kaki tidak boleh menempel. */
.tp__cta {
  display: grid;
  gap: 12px;
}
.tp__btn {
  width: 100%;
  min-height: 54px;
}
.tp__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.tp__ok {
  color: var(--a-ok);
}
.tp__fine {
  margin-top: 10px;
  font-size: 12px;
  color: var(--a-muted);
}
</style>
