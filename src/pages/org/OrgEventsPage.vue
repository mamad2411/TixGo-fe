<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { listOrgEvents, type OrgEvent } from '@/api/organizer'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import EventThumb from '@/components/app/EventThumb.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { formatEventDate } from '@/utils/format'
import './org.css'

const { t, locale } = useI18n()
useHead({ title: computed(() => t('org.nav_.org-events')) })
const apiMessage = useApiMessage()
const rows = ref<OrgEvent[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = (await listOrgEvents()).data
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)
</script>

<template>
  <div class="org">
    <div class="org__bar">
      <h1 class="a-serif ac__title">{{ t('org.nav_.org-events') }}</h1>
      <RouterLink
        :to="{ name: 'org-event-new' }"
        class="a-pill a-pill--solid"
        data-test="new-event"
        >{{ t('org.event.new') }}</RouterLink
      >
    </div>
    <div
      v-if="state === 'loading'"
      class="a-sk"
      style="min-height: 200px; border-radius: 16px"
      role="status"
      :aria-label="t('common.loading')"
    />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <EmptyState
      v-else-if="!rows.length"
      :title="t('org.event.empty')"
      :body="t('org.event.emptyBody')"
    />
    <ul v-else class="org__list" data-test="event-list">
      <li v-for="e in rows" :key="e.id">
        <RouterLink
          :to="{ name: 'org-event', params: { id: e.id } }"
          class="org__row"
          data-test="event-row"
        >
          <span class="org__main">
            <EventThumb :src="e.poster_url" :title="e.title" :w="54" :h="68" />
            <span>
              <strong>{{ e.title }}</strong>
              <small class="a-muted"
                >{{ e.venue?.name }} ·
                {{ e.venue ? formatEventDate(e.starts_at, e.venue.tz, bcp) : '' }}</small
              >
            </span>
          </span>
          <span class="org__chip" :class="`is-${e.status}`">{{
            t(`org.status.${e.status}`, e.status)
          }}</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
