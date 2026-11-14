<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { listOrders, type OrderBrief } from '@/api/account'
import Countdown from '@/components/app/Countdown.vue'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import EventThumb from '@/components/app/EventThumb.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import { usePendingStore } from '@/stores/pending'
import { formatRupiah } from '@/utils/format'
import './accountStyle.css'

const { t, locale } = useI18n()
useHeaderTone(computed(() => 'light'))
useHead({ title: computed(() => t('acct.orders')) })
const apiMessage = useApiMessage()
const pending = usePendingStore()
const rp = (n: number) => formatRupiah(n, locale.value === 'en' ? 'en-GB' : 'id-ID')
const fmt = (iso: string) =>
  new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'id-ID', {
    dateStyle: 'medium',
  }).format(new Date(iso))

const rows = ref<OrderBrief[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const filter = ref<'all' | 'pending' | 'paid' | 'closed'>('all')
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = (await listOrders()).data
    pending.set(rows.value) // header memakai daftar yang sama; tidak perlu permintaan kedua
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)
const group = (s: string) =>
  s === 'pending'
    ? 'pending'
    : ['paid', 'refunding', 'partially_refunded', 'refunded'].includes(s)
      ? 'paid'
      : 'closed'
const live = (o: OrderBrief) => o.status === 'pending' && new Date(o.expires_at) > new Date()
const shown = computed(() =>
  rows.value.filter((o) => filter.value === 'all' || group(o.status) === filter.value),
)
const badge = (o: OrderBrief) => (o.status === 'pending' && !live(o) ? 'expired' : o.status)
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('acct.orders') }}</h1>
    <div class="ac__tabs" role="group" :aria-label="t('acct.filter')">
      <button
        v-for="f in ['all', 'pending', 'paid', 'closed'] as const"
        :key="f"
        type="button"
        class="a-pill"
        :aria-pressed="filter === f"
        :class="{ 'a-pill--solid': filter === f }"
        @click="filter = f"
      >
        {{ t(`acct.f.${f}`) }}
      </button>
    </div>
    <SkeletonPage v-if="state === 'loading'" :rows="5" />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <EmptyState
      v-else-if="!shown.length"
      :title="t('acct.ordersEmpty')"
      :body="t('acct.ordersEmptyBody')"
    >
      <RouterLink class="a-pill a-pill--solid" :to="{ name: 'events' }">{{
        t('nav.events')
      }}</RouterLink>
    </EmptyState>
    <ul v-else class="ac__list" data-test="orders">
      <li v-for="o in shown" :key="o.id" class="ac__row" :class="{ 'is-hot': live(o) }">
        <EventThumb :src="o.poster_url" :title="o.event_title" :w="56" :h="70" />
        <span class="ac__main">
          <strong>{{ o.event_title }}</strong>
          <small class="a-muted">{{ fmt(o.created_at) }} · {{ rp(o.total) }}</small>
          <small v-if="live(o)" class="a-muted"
            >{{ t('order.payBefore') }} <Countdown :to="o.expires_at"
          /></small>
        </span>
        <span
          class="ac__badge"
          :class="`is-${group(o.status) === 'closed' ? 'bad' : group(o.status)}`"
          >{{ t(`acct.s.${badge(o)}`) }}</span
        >
        <RouterLink
          class="a-pill"
          :class="{ 'a-pill--solid': live(o) }"
          :to="{ name: 'order', params: { id: o.id } }"
        >
          {{ live(o) ? t('acct.payNow') : t('acct.detail') }}
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
