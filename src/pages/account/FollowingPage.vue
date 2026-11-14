<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Check, MapPin, Plus } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { listArtists, listFollows, type Artist, type Follow } from '@/api/artists'
import { getFilters, listVenues, type Filters } from '@/api/discover'
import type { VenueView } from '@/api/events'
import ErrorState from '@/components/app/ErrorState.vue'
import EventThumb from '@/components/app/EventThumb.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useFollowsStore } from '@/stores/follows'
import './accountStyle.css'

// Semua yang diikuti di satu tempat: artis, venue, kota, genre. Berhenti mengikuti satu ketukan,
// dan kota/genre bisa ditambah dari sini (BE memakainya untuk rekomendasi dan kabar konser baru).
const { t } = useI18n()
useHead({ title: computed(() => t('fol.title')) })
const message = useMessage()
const apiMessage = useApiMessage()
const store = useFollowsStore()

const follows = ref<Follow[]>([])
const artists = ref<Artist[]>([])
const venues = ref<VenueView[]>([])
const filters = ref<Filters>({ cities: [], genres: [] })
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const busy = ref('')

async function load(): Promise<void> {
  state.value = 'loading'
  try {
    ;[follows.value, artists.value, venues.value, filters.value] = await Promise.all([
      listFollows(),
      listArtists(),
      listVenues({ per_page: 100 }).then((r) => r.data),
      getFilters(),
    ])
    await store.load()
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

const targets = (kind: Follow['kind']) =>
  new Set(follows.value.filter((f) => f.kind === kind).map((f) => f.target))
const myArtists = computed(() => {
  const s = targets('artist')
  return artists.value.filter((a) => s.has(a.slug) || s.has(a.id))
})
const myVenues = computed(() => {
  const s = targets('venue')
  return venues.value.filter((v) => s.has(v.id))
})
const myCities = computed(() => targets('city'))
const myGenres = computed(() => targets('genre'))
const total = computed(() => follows.value.length)

async function toggle(
  kind: Follow['kind'],
  target: string,
  name: string,
  alt?: string,
): Promise<void> {
  busy.value = `${kind}:${target}`
  try {
    const now = await store.toggle(kind, target, alt)
    message.success(t(now ? 'follow.on' : 'follow.off', { n: name }))
    follows.value = await listFollows()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('fol.title') }}</h1>
    <p class="a-muted fol__lead">{{ t('fol.lead') }}</p>
    <SkeletonPage v-if="state === 'loading'" :rows="4" />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <template v-else>
      <section class="fol__sec" data-test="fol-artists">
        <h2 class="a-serif">
          {{ t('fol.artists') }} <small>{{ myArtists.length }}</small>
        </h2>
        <EmptyState
          v-if="!myArtists.length"
          :title="t('fol.noArtists')"
          :body="t('fol.noArtistsBody')"
        >
          <RouterLink :to="{ name: 'artists' }" class="a-pill a-pill--solid">{{
            t('art.all')
          }}</RouterLink>
        </EmptyState>
        <ul v-else class="fol__grid">
          <li v-for="a in myArtists" :key="a.id" class="fol__card">
            <RouterLink :to="{ name: 'artist', params: { slug: a.slug } }" class="fol__link">
              <EventThumb :src="a.image_url" :title="a.name" :w="64" :h="64" class="fol__avatar" />
              <span class="fol__txt"
                ><strong>{{ a.name }}</strong
                ><small class="a-muted">{{ a.bio }}</small></span
              >
            </RouterLink>
            <button
              type="button"
              class="a-pill"
              :disabled="busy === `artist:${a.slug}`"
              data-test="unfollow"
              @click="toggle('artist', a.slug, a.name, a.id)"
            >
              {{ t('fol.unfollow') }}
            </button>
          </li>
        </ul>
      </section>

      <section class="fol__sec" data-test="fol-venues">
        <h2 class="a-serif">
          {{ t('fol.venues') }} <small>{{ myVenues.length }}</small>
        </h2>
        <EmptyState
          v-if="!myVenues.length"
          :title="t('fol.noVenues')"
          :body="t('fol.noVenuesBody')"
        >
          <RouterLink :to="{ name: 'venues' }" class="a-pill a-pill--solid">{{
            t('nav.venues')
          }}</RouterLink>
        </EmptyState>
        <ul v-else class="fol__grid">
          <li v-for="v in myVenues" :key="v.id" class="fol__card">
            <RouterLink :to="{ name: 'venue', params: { id: v.id } }" class="fol__link">
              <EventThumb :src="v.image_url" :title="v.name" :w="64" :h="64" class="fol__avatar" />
              <span class="fol__txt"
                ><strong>{{ v.name }}</strong
                ><small class="a-muted">{{ v.city }}</small></span
              >
            </RouterLink>
            <button
              type="button"
              class="a-pill"
              :disabled="busy === `venue:${v.id}`"
              @click="toggle('venue', v.id, v.name)"
            >
              {{ t('fol.unfollow') }}
            </button>
          </li>
        </ul>
      </section>

      <section class="fol__sec" data-test="fol-cities">
        <h2 class="a-serif">
          {{ t('fol.cities') }} <small>{{ myCities.size }}</small>
        </h2>
        <p class="a-muted">{{ t('fol.cityHint') }}</p>
        <ul class="fol__chips">
          <li v-for="c in filters.cities" :key="c">
            <button
              type="button"
              class="fol__chip"
              :class="{ 'is-on': myCities.has(c) }"
              :aria-pressed="myCities.has(c)"
              :disabled="busy === `city:${c}`"
              @click="toggle('city', c, c)"
            >
              <NIcon :component="myCities.has(c) ? Check : MapPin" :size="16" aria-hidden="true" />
              {{ c }}
            </button>
          </li>
        </ul>
      </section>

      <section class="fol__sec" data-test="fol-genres">
        <h2 class="a-serif">
          {{ t('fol.genres') }} <small>{{ myGenres.size }}</small>
        </h2>
        <p class="a-muted">{{ t('fol.genreHint') }}</p>
        <ul class="fol__chips">
          <li v-for="g in filters.genres" :key="g">
            <button
              type="button"
              class="fol__chip"
              :class="{ 'is-on': myGenres.has(g) }"
              :aria-pressed="myGenres.has(g)"
              :disabled="busy === `genre:${g}`"
              @click="toggle('genre', g, g)"
            >
              <NIcon :component="myGenres.has(g) ? Check : Plus" :size="16" aria-hidden="true" />
              {{ g }}
            </button>
          </li>
        </ul>
      </section>

      <p v-if="!total" class="a-muted">{{ t('fol.tip') }}</p>
    </template>
  </div>
</template>

<style scoped>
.fol__empty {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px 18px;
  border: 1px dashed var(--a-line-strong);
  border-radius: 16px;
}
.fol__card .a-pill {
  flex: none;
  white-space: nowrap;
}
.fol__lead {
  margin: -6px 0 8px;
  max-width: 60ch;
}
.fol__sec {
  display: grid;
  gap: 12px;
  margin-bottom: 28px;
}
.fol__sec h2 {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.fol__sec h2 small {
  font: 600 14px/1 var(--a-sans, sans-serif);
  color: var(--a-muted);
}
.fol__sec p {
  margin: 0;
}
.fol__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
}
.fol__card {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  border: 1px solid var(--a-line);
  border-radius: 18px;
  background: var(--a-panel);
}
.fol__link {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
  text-decoration: none;
  color: var(--a-ink);
}
.fol__avatar {
  border-radius: 50% !important;
  flex: none;
}
.fol__txt {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.fol__txt small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fol__chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.fol__chip {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--a-line-strong);
  background: transparent;
  color: var(--a-ink);
  font: inherit;
  cursor: pointer;
}
.fol__chip:hover,
.fol__chip:focus-visible {
  border-color: var(--a-gold);
}
.fol__chip.is-on {
  background: var(--a-gold);
  color: var(--a-on-gold);
  border-color: var(--a-gold);
}
</style>
