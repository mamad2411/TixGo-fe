<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { listVenues } from '@/api/discover'
import type { VenueView } from '@/api/events'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import EventThumb from '@/components/app/EventThumb.vue'
import BackLink from '@/components/app/BackLink.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'

const { t, locale } = useI18n()
useHeaderTone(computed(() => 'light'))
useHead({ title: computed(() => t('ven.title')) })
const apiMessage = useApiMessage()
const rows = ref<VenueView[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const q = ref('')
const city = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

async function load(): Promise<void> {
  state.value = 'loading'
  try {
    const r = await listVenues({
      q: q.value.trim() || undefined,
      city: city.value || undefined,
      per_page: 60,
    })
    rows.value = r.data
    if (!city.value && !cities.value.length)
      cities.value = [...new Set(r.data.map((v) => v.city))].sort()
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
const cities = ref<string[]>([])
onMounted(load)
watch([q, city], () => {
  clearTimeout(timer)
  timer = setTimeout(load, 250)
})
const fmt = (n: number) => n.toLocaleString(locale.value === 'en' ? 'en-GB' : 'id-ID')
</script>

<template>
  <ToneLight class="tone-page">
    <div class="vn">
      <BackLink plain class="pg-back" />
      <header>
        <p class="a-caps">{{ t('ven.kicker') }}</p>
        <h1 class="a-serif">{{ t('ven.title') }}</h1>
        <p class="a-muted">{{ t('ven.lead') }}</p>
      </header>
      <div class="vn__tools">
        <label class="sr-only" for="vn-q">{{ t('ven.search') }}</label>
        <input
          id="vn-q"
          v-model="q"
          type="search"
          class="vn__q"
          :placeholder="t('ven.search')"
          data-test="venue-search"
        />
        <label class="sr-only" for="vn-c">{{ t('ven.city') }}</label>
        <select id="vn-c" v-model="city" class="vn__sel a-select" data-test="venue-city">
          <option value="">{{ t('ven.allCities') }}</option>
          <option v-for="c in cities" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <div
        v-if="state === 'loading'"
        class="a-sk"
        style="min-height: 240px; border-radius: 16px"
        role="status"
        :aria-label="t('common.loading')"
      />
      <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
      <EmptyState v-else-if="!rows.length" :title="t('ven.empty')" :body="t('ven.emptyBody')" />
      <ul v-else class="vn__grid" data-test="venues">
        <li v-for="v in rows" :key="v.id">
          <RouterLink :to="{ name: 'venue', params: { id: v.id } }" class="vn__card">
            <EventThumb :src="v.image_url" :title="v.name" :w="320" :h="180" class="vn__img" />
            <span class="vn__txt">
              <strong>{{ v.name }}</strong>
              <small class="a-muted">{{ v.city }}</small>
              <small v-if="v.capacity" class="a-muted">{{
                t('ven.capacity', { n: fmt(v.capacity) })
              }}</small>
            </span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </ToneLight>
</template>

<style scoped>
.vn {
  max-width: 1120px;
  margin: 0 auto;
  padding: 32px var(--a-pad) 72px;
  display: grid;
  gap: 20px;
}
.vn h1 {
  margin: 0;
  font-size: clamp(34px, 5vw, 56px);
  color: var(--a-cream);
}
.vn header p {
  margin: 6px 0 0;
  max-width: 56ch;
}
.vn__tools {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.vn__q {
  flex: 1 1 260px;
  min-height: 48px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--a-line);
  background: var(--a-panel);
  color: var(--a-ink);
  font: inherit;
}
.vn__sel {
  flex: 0 1 220px;
  min-height: 48px;
}
.vn__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}
.vn__card {
  display: grid;
  gap: 12px;
  padding: 12px 12px 16px;
  border: 1px solid var(--a-line);
  border-radius: 18px;
  background: var(--a-panel);
  color: var(--a-ink);
  text-decoration: none;
}
.vn__card:hover,
.vn__card:focus-visible {
  border-color: var(--a-gold);
}
.vn__img {
  width: 100% !important;
  height: auto !important;
  aspect-ratio: 16 / 9;
  border-radius: 12px !important;
}
.vn__txt {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.vn__txt strong {
  font-size: 17px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
