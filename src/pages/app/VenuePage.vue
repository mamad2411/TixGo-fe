<script setup lang="ts">
import { Bell, BellRinging } from '@vicons/tabler'
import { useHead } from '@unhead/vue'
import { NIcon, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { getVenue } from '@/api/discover'
import { listEvents, type EventCard as Card, type VenueView } from '@/api/events'
import BackLink from '@/components/app/BackLink.vue'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import EventCard from '@/components/app/EventCard.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import VenueCard from '@/components/app/VenueCard.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import { useRequireLogin } from '@/composables/useRequireLogin'
import { useFollowsStore } from '@/stores/follows'

const { t } = useI18n()
useHeaderTone(computed(() => 'light'))
const route = useRoute()
const apiMessage = useApiMessage()
const message = useMessage()
const requireLogin = useRequireLogin()
const follows = useFollowsStore()
const id = computed(() => String(route.params.id))
const venue = ref<VenueView | null>(null)
const events = ref<Card[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const busy = ref(false)
const on = computed(() => follows.has('venue', id.value))

async function load(): Promise<void> {
  state.value = 'loading'
  try {
    venue.value = await getVenue(id.value)
    // BE belum punya filter venue di /events: cari lewat nama lalu saring tepat di klien.
    const r = await listEvents({ q: venue.value.name, per_page: 50, sort: 'date' })
    const name = venue.value.name
    events.value = r.data.filter((e) => e.venue_name === name)
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
watch(id, load, { immediate: true })
useHead({ title: computed(() => venue.value?.name ?? t('ven.title')) })

async function toggle(): Promise<void> {
  if (!venue.value || !(await requireLogin('follow.needLogin'))) return
  busy.value = true
  try {
    const now = await follows.toggle('venue', id.value)
    message.success(t(now ? 'follow.on' : 'follow.off', { n: venue.value.name }))
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ToneLight class="tone-page">
    <div class="vp">
      <BackLink plain :fallback="{ name: 'venues' }" class="vp__back" />
      <div
        v-if="state === 'loading'"
        class="a-sk"
        style="min-height: 260px; border-radius: 20px"
        role="status"
        :aria-label="t('common.loading')"
      />
      <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
      <template v-else-if="venue">
        <header class="vp__head" data-test="venue">
          <h1 class="a-serif">{{ venue.name }}</h1>
          <button
            type="button"
            class="a-pill"
            :class="{ 'a-pill--solid': on }"
            :aria-pressed="on"
            :disabled="busy"
            data-test="venue-follow"
            @click="toggle"
          >
            <NIcon :component="on ? BellRinging : Bell" :size="16" aria-hidden="true" />
            {{ on ? t('follow.following') : t('follow.follow') }}
          </button>
        </header>
        <VenueCard :venue="venue" hide-name />
        <h2 class="a-serif">{{ t('ven.upcoming') }}</h2>
        <EmptyState
          v-if="!events.length"
          :title="t('ven.noEvents')"
          :body="t('ven.noEventsBody')"
        />
        <ul v-else class="vp__list" data-test="venue-events">
          <li v-for="e in events" :key="e.id"><EventCard :event="e" /></li>
        </ul>
      </template>
    </div>
  </ToneLight>
</template>

<style scoped>
.vp {
  max-width: 1120px;
  margin: 0 auto;
  padding: 32px var(--a-pad) 72px;
  display: grid;
  gap: 20px;
}
.vp__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.vp h1 {
  margin: 0;
  font-size: clamp(30px, 4.5vw, 48px);
  color: var(--a-cream);
}
.vp h2 {
  margin: 8px 0 0;
  font-size: 24px;
}
.vp__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}
.vp__back {
  justify-self: start;
}
</style>
