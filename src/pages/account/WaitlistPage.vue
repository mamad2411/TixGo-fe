<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Clock } from '@vicons/tabler'
import { useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { leaveWaitlist, listWaitlists, type WaitlistEntry } from '@/api/events'
import Countdown from '@/components/app/Countdown.vue'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import './accountStyle.css'

// Waitlist saya: antrean tiket habis. Status "offered" = hold 10 menit sudah dibuat untukmu di BE;
// tombol Beli membawa ke checkout hold itu. Keluar dari antrean melepas hold bila sedang ditawari.
const { t } = useI18n()
useHead({ title: computed(() => t('wl.title')) })
const message = useMessage()
const apiMessage = useApiMessage()

const rows = ref<WaitlistEntry[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const busy = ref('')

async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = await listWaitlists()
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

// Yang ditawari tampil lebih dulu: itu yang punya batas waktu.
const sorted = computed(() =>
  [...rows.value].sort((a, b) => Number(b.status === 'offered') - Number(a.status === 'offered')),
)

async function leave(w: WaitlistEntry): Promise<void> {
  busy.value = w.id
  try {
    await leaveWaitlist(w.event_slug, w.tier_id)
    rows.value = rows.value.filter((r) => r.id !== w.id)
    message.success(t('wl.leaveOk'))
  } catch (e) {
    message.error(apiMessage(e) || t('wl.leaveFail'))
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('wl.title') }}</h1>
    <p class="a-muted">{{ t('wl.lead') }}</p>
    <SkeletonPage v-if="state === 'loading'" :rows="3" />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <EmptyState
      v-else-if="!rows.length"
      :icon="Clock"
      :title="t('wl.emptyTitle')"
      :body="t('wl.emptyBody')"
    >
      <RouterLink :to="{ name: 'events' }" class="a-pill a-pill--solid">{{
        t('wl.browse')
      }}</RouterLink>
    </EmptyState>
    <ul v-else class="wl" data-test="waitlist-list">
      <li
        v-for="w in sorted"
        :key="w.id"
        class="wl__row"
        :class="{ 'wl__row--offer': w.status === 'offered' }"
        :data-status="w.status"
      >
        <div class="wl__info">
          <RouterLink :to="{ name: 'event', params: { slug: w.event_slug } }" class="wl__title">{{
            w.event_title
          }}</RouterLink>
          <span class="a-muted">{{ w.tier_name }} · {{ t('wl.qty', { n: w.qty }) }}</span>
          <template v-if="w.status === 'offered'">
            <strong class="wl__offer">{{ t('wl.offered') }}</strong>
            <Countdown v-if="w.offered_until" :to="w.offered_until" @done="load" />
          </template>
          <span v-else class="wl__wait">{{ t('wl.waiting') }}</span>
        </div>
        <div class="wl__act">
          <RouterLink
            v-if="w.status === 'offered' && w.hold_id"
            :to="{ name: 'checkout', params: { holdId: w.hold_id } }"
            class="a-pill a-pill--solid"
            data-test="wl-buy"
            >{{ t('wl.buy') }}</RouterLink
          >
          <button
            type="button"
            class="a-pill a-pill--ghost"
            :disabled="busy === w.id"
            data-test="wl-leave"
            @click="leave(w)"
          >
            {{ t('wl.leave') }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.wl {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.wl__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
}
.wl__row--offer {
  border-color: var(--a-gold);
  box-shadow: 0 0 0 1px var(--a-gold) inset;
}
.wl__info {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.wl__title {
  font-weight: 700;
  font-size: 17px;
  color: var(--a-cream);
  text-decoration: none;
  overflow-wrap: anywhere;
}
.wl__title:hover {
  color: var(--a-gold);
}
.wl__offer {
  color: var(--a-gold);
}
.wl__wait {
  font-size: 14px;
}
.wl__act {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
