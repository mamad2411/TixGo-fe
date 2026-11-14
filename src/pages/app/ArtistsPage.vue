<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { listArtists, type Artist } from '@/api/artists'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import EventThumb from '@/components/app/EventThumb.vue'
import FollowButton from '@/components/app/FollowButton.vue'
import BackLink from '@/components/app/BackLink.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import { useFollowsStore } from '@/stores/follows'

const { t } = useI18n()
useHeaderTone(computed(() => 'light'))
useHead({ title: computed(() => t('art.title')) })
const apiMessage = useApiMessage()
const follows = useFollowsStore()
const rows = ref<Artist[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const q = ref('')
const onlyFollowed = ref(false)
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = await listArtists()
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)
const shown = computed(() => {
  const term = q.value.trim().toLowerCase()
  return rows.value.filter(
    (a) =>
      (!term || a.name.toLowerCase().includes(term)) &&
      (!onlyFollowed.value || follows.has('artist', a.id)),
  )
})
</script>

<template>
  <ToneLight class="tone-page">
    <div class="ar">
      <BackLink plain class="pg-back" />
      <header>
        <p class="a-caps">{{ t('art.kicker') }}</p>
        <h1 class="a-serif">{{ t('art.title') }}</h1>
        <p class="a-muted">{{ t('art.lead') }}</p>
      </header>
      <div class="ar__tools">
        <label class="sr-only" for="ar-q">{{ t('art.search') }}</label>
        <input
          id="ar-q"
          v-model="q"
          type="search"
          class="ar__q"
          :placeholder="t('art.search')"
          data-test="artist-search"
        />
        <button
          type="button"
          class="a-pill"
          :class="{ 'a-pill--solid': onlyFollowed }"
          :aria-pressed="onlyFollowed"
          @click="onlyFollowed = !onlyFollowed"
        >
          {{ t('art.followedOnly') }}
        </button>
      </div>
      <div
        v-if="state === 'loading'"
        class="a-sk"
        style="min-height: 240px; border-radius: 16px"
        role="status"
        :aria-label="t('common.loading')"
      />
      <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
      <EmptyState v-else-if="!shown.length" :title="t('art.empty')" :body="t('art.emptyBody')" />
      <ul v-else class="ar__grid" data-test="artists">
        <li v-for="a in shown" :key="a.id" class="ar__card">
          <RouterLink :to="{ name: 'artist', params: { slug: a.slug } }" class="ar__link">
            <EventThumb :src="a.image_url" :title="a.name" :w="96" :h="96" class="ar__img" />
            <span class="ar__txt">
              <strong>{{ a.name }}</strong>
              <small class="a-muted">{{ a.bio }}</small>
            </span>
          </RouterLink>
          <FollowButton :artist-id="a.id" :slug="a.slug" :name="a.name" />
        </li>
      </ul>
    </div>
  </ToneLight>
</template>

<style scoped>
.ar {
  max-width: 1120px;
  margin: 0 auto;
  padding: 32px var(--a-pad) 72px;
  display: grid;
  gap: 20px;
}
.ar h1 {
  margin: 0;
  font-size: clamp(34px, 5vw, 56px);
  color: var(--a-cream);
}
.ar header p {
  margin: 6px 0 0;
  max-width: 56ch;
}
.ar__tools {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.ar__q {
  flex: 1 1 260px;
  min-height: 48px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--a-line);
  background: var(--a-panel);
  color: var(--a-ink);
  font: inherit;
}
.ar__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}
.ar__card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--a-line);
  border-radius: 18px;
  background: var(--a-panel);
  align-content: space-between;
}
.ar__link {
  display: flex;
  gap: 14px;
  text-decoration: none;
  color: var(--a-ink);
}
.ar__img {
  border-radius: 50% !important;
}
.ar__txt {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.ar__txt strong {
  font-size: 18px;
}
.ar__txt small {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
