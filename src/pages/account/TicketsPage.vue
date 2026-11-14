<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { listTickets, type TicketBrief } from '@/api/account'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import TicketCard from '@/components/app/TicketCard.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import './accountStyle.css'

const { t } = useI18n()
useHeaderTone(computed(() => 'light'))
useHead({ title: computed(() => t('acct.tickets')) })
const apiMessage = useApiMessage()

const rows = ref<TicketBrief[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = (await listTickets()).data
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

// "Akan datang" = tiket berlaku untuk acara yang belum lewat; sisanya (lewat/terpakai/dibatalkan) masuk Riwayat.
const tab = ref<'soon' | 'past'>('soon')
const isSoon = (k: TicketBrief) =>
  ['valid', 'active'].includes(k.status) &&
  new Date(k.starts_at).getTime() > Date.now() - 6 * 3_600_000
const ordered = computed(() => {
  const soon = rows.value
    .filter(isSoon)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
  const past = rows.value
    .filter((k) => !isSoon(k))
    .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at))
  return { soon, past }
})
const counts = computed(() => ({
  soon: ordered.value.soon.length,
  past: ordered.value.past.length,
}))
const shown = computed(() => ordered.value[tab.value])
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('acct.tickets') }}</h1>
    <SkeletonPage v-if="state === 'loading'" :rows="5" />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <EmptyState
      v-else-if="!rows.length"
      :title="t('acct.ticketsEmpty')"
      :body="t('acct.ticketsEmptyBody')"
    >
      <RouterLink class="a-pill a-pill--solid" :to="{ name: 'events' }">{{
        t('nav.events')
      }}</RouterLink>
    </EmptyState>
    <template v-else>
      <div class="ac__tabs" role="group" :aria-label="t('acct.filter')">
        <button
          v-for="k in ['soon', 'past'] as const"
          :key="k"
          type="button"
          class="a-pill"
          :class="{ 'a-pill--solid': tab === k }"
          :aria-pressed="tab === k"
          @click="tab = k"
        >
          {{ t(`acct.tk.${k}`) }} ({{ counts[k] }})
        </button>
      </div>
      <p v-if="!shown.length" class="a-muted" data-test="tickets-none">
        {{ t(tab === 'soon' ? 'acct.tk.noneSoon' : 'acct.tk.nonePast') }}
      </p>
      <ul v-else class="tcl" data-test="tickets">
        <li v-for="k in shown" :key="k.id"><TicketCard :ticket="k" /></li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.tcl {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
}
</style>
