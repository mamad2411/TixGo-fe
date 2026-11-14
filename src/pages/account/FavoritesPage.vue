<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { listFavorites, type EventCard as EventCardT } from '@/api/events'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import EventCard from '@/components/app/EventCard.vue'
import EventCardSkeleton from '@/components/app/EventCardSkeleton.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import './accountStyle.css'

const { t } = useI18n()
useHeaderTone(computed(() => 'light'))
useHead({ title: computed(() => t('acct.favorites')) })
const apiMessage = useApiMessage()

const rows = ref<EventCardT[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = await listFavorites()
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('acct.favorites') }}</h1>
    <div
      v-if="state === 'loading'"
      class="fv"
      role="status"
      :aria-label="t('common.loading')"
      data-state="loading"
    >
      <EventCardSkeleton v-for="n in 6" :key="n" />
    </div>
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <EmptyState v-else-if="!rows.length" :title="t('acct.favEmpty')" :body="t('acct.favEmptyBody')">
      <RouterLink class="a-pill a-pill--solid" :to="{ name: 'events' }">{{
        t('nav.events')
      }}</RouterLink>
    </EmptyState>
    <ul v-else class="fv" data-test="favorites">
      <li v-for="e in rows" :key="e.id">
        <EventCard :event="e" :to="{ name: 'event', params: { slug: e.slug } }" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.fv {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
}
</style>
