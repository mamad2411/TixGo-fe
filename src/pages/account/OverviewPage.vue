<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Check, Clock, Discount2, Lifebuoy, Receipt, ReceiptRefund, Ticket } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { listTickets, listVouchers, type TicketBrief } from '@/api/account'
import Countdown from '@/components/app/Countdown.vue'
import RecommendedRail from '@/components/app/RecommendedRail.vue'
import { useAuthStore } from '@/stores/auth'
import { usePendingStore } from '@/stores/pending'
import { formatEventDate } from '@/utils/format'
import './accountStyle.css'

// Beranda akun: selalu menjawab "apa langkah berikutnya?" — konser terdekat, hal yang perlu perhatian,
// dan kelengkapan akun. Bahasa sehari-hari, satu aksi utama per kartu.
const { t, locale } = useI18n()
useHead({ title: computed(() => t('ov.title')) })
const auth = useAuthStore()
const pending = usePendingStore()
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))

const tickets = ref<TicketBrief[]>([])
const vouchers = ref(0)
const loaded = ref(false)
onMounted(async () => {
  const [tk, vc] = await Promise.allSettled([listTickets(), listVouchers()])
  if (tk.status === 'fulfilled') tickets.value = tk.value.data
  if (vc.status === 'fulfilled')
    vouchers.value = vc.value.filter((v) => v.status === 'available').length
  loaded.value = true
  void pending.load()
})

const live = (k: TicketBrief) => k.status === 'valid' || k.status === 'active'
const upcoming = computed(() =>
  tickets.value
    .filter((k) => live(k) && new Date(k.starts_at).getTime() > Date.now() - 6 * 3_600_000)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
)
const next = computed(() => upcoming.value[0] ?? null)
const more = computed(() => Math.max(0, upcoming.value.length - 1))

const firstName = computed(() => (auth.user?.name ?? '').trim().split(/\s+/)[0] ?? '')
const when = computed(() => {
  if (!next.value) return ''
  const ms = new Date(next.value.starts_at).getTime() - Date.now()
  const days = Math.floor(ms / 86_400_000)
  if (ms <= 0) return t('ov.now')
  if (days === 0) return t('ov.today')
  if (days === 1) return t('ov.tomorrow')
  return t('ov.inDays', { n: days })
})

interface Step {
  key: string
  done: boolean
  to: Record<string, unknown>
  optional?: boolean
}
const steps = computed<Step[]>(() => [
  { key: 'email', done: !!auth.user?.email_verified, to: { name: 'verify-email' } },
  { key: 'phone', done: !!auth.user?.phone_verified, to: { name: 'verify-phone' } },
  { key: 'photo', done: !!auth.user?.avatar_key, to: { name: 'profile' }, optional: true },
  { key: 'mfa', done: !!auth.user?.mfa_enabled, to: { name: 'security' }, optional: true },
])
const doneCount = computed(() => steps.value.filter((s) => s.done).length)
const pct = computed(() => Math.round((doneCount.value / steps.value.length) * 100))
const nextStep = computed(() => steps.value.find((s) => !s.done))
const attention = computed(() => pending.active.length)

const tiles = [
  { name: 'vouchers', icon: Discount2 },
  { name: 'refunds', icon: ReceiptRefund },
  { name: 'orders', icon: Receipt },
  { name: 'help', icon: Lifebuoy },
] as const
</script>

<template>
  <div class="ac ov">
    <header>
      <p class="a-caps">{{ t('ov.kicker') }}</p>
      <h1 class="a-serif ac__title">{{ t('ov.hello', { n: firstName }) }}</h1>
    </header>

    <section class="ov__next" data-test="ov-next" :aria-label="t('ov.nextTitle')">
      <template v-if="next">
        <div class="ov__nextTxt">
          <p class="a-caps">{{ t('ov.nextTitle') }}</p>
          <h2 class="a-serif">{{ next.event_title }}</h2>
          <p class="ov__when">
            <NIcon :component="Clock" :size="18" aria-hidden="true" />
            <strong>{{ when }}</strong> · {{ formatEventDate(next.starts_at, next.tz, bcp) }}
          </p>
          <p class="a-muted">{{ next.venue_name }} · {{ next.seat_label || next.tier_name }}</p>
          <div class="ac__act">
            <RouterLink
              class="a-pill a-pill--solid"
              :to="{ name: 'ticket', params: { id: next.id } }"
              data-test="ov-open"
            >
              <NIcon :component="Ticket" :size="18" aria-hidden="true" /> {{ t('ov.openTicket') }}
            </RouterLink>
            <RouterLink v-if="more" class="a-pill" :to="{ name: 'tickets' }">{{
              t('ov.moreTickets', { n: more })
            }}</RouterLink>
          </div>
        </div>
      </template>
      <div v-else class="ov__empty" data-test="ov-empty">
        <h2 class="a-serif">{{ loaded ? t('ov.emptyTitle') : t('common.loading') }}</h2>
        <p class="a-muted">{{ t('ov.emptyBody') }}</p>
        <RouterLink class="a-pill a-pill--solid" :to="{ name: 'events' }">{{
          t('ov.browse')
        }}</RouterLink>
      </div>
    </section>

    <section v-if="attention" class="ac__card ov__attn" data-test="ov-attn">
      <h2 class="a-serif">{{ t('ov.attnTitle') }}</h2>
      <ul class="ac__list">
        <li v-for="o in pending.active" :key="o.id" class="ac__row is-hot">
          <span class="ac__main">
            <strong>{{ t('ov.payWait', { e: o.event_title }) }}</strong>
            <small class="a-muted"
              >{{ t('order.payBefore') }} <Countdown :to="o.expires_at"
            /></small>
          </span>
          <RouterLink
            class="a-pill a-pill--solid"
            :to="{ name: 'order-pay', params: { id: o.id } }"
            >{{ t('acct.payNow') }}</RouterLink
          >
        </li>
      </ul>
    </section>

    <section class="ac__card" data-test="ov-steps">
      <div class="ov__stepsHead">
        <h2 class="a-serif">{{ t('ov.stepsTitle') }}</h2>
        <span class="ac__badge" :class="pct === 100 ? 'is-paid' : 'is-pending'"
          >{{ doneCount }}/{{ steps.length }}</span
        >
      </div>
      <div
        class="ov__bar"
        role="progressbar"
        :aria-valuenow="pct"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="t('ov.stepsTitle')"
      >
        <span :style="{ width: `${pct}%` }" />
      </div>
      <ol class="ov__steps">
        <li v-for="s in steps" :key="s.key" :class="{ done: s.done }">
          <span class="ov__dot" aria-hidden="true"
            ><NIcon v-if="s.done" :component="Check" :size="14"
          /></span>
          <span class="ov__stepTxt">
            <strong>{{ t(`ov.step.${s.key}`) }}</strong>
            <small class="a-muted">{{ t(`ov.stepWhy.${s.key}`) }}</small>
          </span>
          <span v-if="s.done" class="ac__badge is-paid">{{ t('ov.done') }}</span>
          <RouterLink
            v-else
            class="a-pill"
            :class="{ 'a-pill--solid': s === nextStep }"
            :to="s.to"
            >{{ s.optional ? t('ov.doIt') : t('ov.doItNow') }}</RouterLink
          >
        </li>
      </ol>
    </section>

    <RecommendedRail data-test="ov-recs" />

    <section>
      <h2 class="a-serif">{{ t('ov.quick') }}</h2>
      <div class="ov__tiles">
        <RouterLink v-for="x in tiles" :key="x.name" class="ov__tile" :to="{ name: x.name }">
          <span class="ov__tileIc"
            ><NIcon :component="x.icon" :size="24" aria-hidden="true"
          /></span>
          <strong>{{ t(`ov.tile.${x.name}`) }}</strong>
          <small class="a-muted">{{
            x.name === 'vouchers'
              ? t('ov.tileVouchers', { n: vouchers })
              : t(`ov.tileBody.${x.name}`)
          }}</small>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ov {
  gap: 24px;
}
.ov h2 {
  margin: 0;
}
.ov__next {
  padding: clamp(20px, 4vw, 32px);
  border-radius: 22px;
  border: 1px solid var(--a-line);
  background:
    radial-gradient(
      120% 140% at 100% 0%,
      color-mix(in srgb, var(--a-gold) 22%, transparent),
      transparent 60%
    ),
    var(--a-panel);
}
.ov__nextTxt {
  display: grid;
  gap: 10px;
}
.ov__nextTxt h2 {
  font-size: clamp(28px, 4.4vw, 44px);
  color: var(--a-cream);
  line-height: 1.08;
  overflow-wrap: anywhere;
}
.ov__nextTxt p {
  margin: 0;
}
.ov__when {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  flex-wrap: wrap;
}
.ov__when strong {
  color: var(--a-gold);
}
.ov__empty {
  display: grid;
  gap: 10px;
  justify-items: start;
}
.ov__empty p {
  margin: 0;
  max-width: 46ch;
}
.ov__stepsHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.ov__bar {
  height: 8px;
  border-radius: 4px;
  background: var(--a-line);
  overflow: hidden;
}
.ov__bar span {
  display: block;
  height: 100%;
  background: var(--a-gold);
  transition: width 0.4s ease;
}
@media (prefers-reduced-motion: reduce) {
  .ov__bar span {
    transition: none;
  }
}
.ov__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.ov__steps li {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.ov__dot {
  width: 26px;
  height: 26px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid var(--a-line-strong, var(--a-line));
}
.done .ov__dot {
  background: var(--a-gold);
  border-color: var(--a-gold);
  color: var(--a-on-gold, var(--a-bg));
}
.ov__stepTxt {
  flex: 1 1 200px;
  display: grid;
  gap: 2px;
  min-width: 0;
}
.ov__tiles {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  margin-top: 12px;
}
.ov__tile {
  display: grid;
  gap: 4px;
  align-content: start;
  padding: 16px;
  min-height: 124px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
  color: var(--a-ink);
  text-decoration: none;
  transition:
    transform 0.15s,
    border-color 0.15s;
}
.ov__tile:hover {
  border-color: var(--a-gold);
  transform: translateY(-2px);
}
@media (prefers-reduced-motion: reduce) {
  .ov__tile {
    transition: none;
  }
  .ov__tile:hover {
    transform: none;
  }
}
.ov__tileIc {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--a-bg2);
  color: var(--a-gold);
  margin-bottom: 6px;
}
.ov__tile small {
  line-height: 1.4;
}
</style>
