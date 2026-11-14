<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { getArtist, type ArtistDetail } from '@/api/artists'
import BackLink from '@/components/app/BackLink.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import EventCard from '@/components/app/EventCard.vue'
import EventThumb from '@/components/app/EventThumb.vue'
import FollowButton from '@/components/app/FollowButton.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'

const { t } = useI18n()
useHeaderTone(computed(() => 'light'))
const route = useRoute()
const apiMessage = useApiMessage()
const slug = computed(() => String(route.params.slug))
const d = ref<ArtistDetail | null>(null)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    d.value = await getArtist(slug.value)
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)
watch(slug, load)
useHead({ title: computed(() => d.value?.artist.name ?? t('art.title')) })
const socials = computed(() => Object.entries(d.value?.artist.socials ?? {}).filter(([, v]) => !!v))
</script>

<template>
  <ToneLight class="tone-page">
    <div class="ap">
      <BackLink plain :fallback="{ name: 'artists' }" />
      <div
        v-if="state === 'loading'"
        class="a-sk"
        style="min-height: 260px; border-radius: 20px"
        role="status"
        :aria-label="t('common.loading')"
      />
      <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
      <template v-else-if="d">
        <header class="ap__head" data-test="artist">
          <EventThumb
            :src="d.artist.image_url"
            :title="d.artist.name"
            :w="132"
            :h="132"
            class="ap__img"
          />
          <div class="ap__txt">
            <p class="a-caps">{{ t('art.kicker') }}</p>
            <h1 class="a-serif">{{ d.artist.name }}</h1>
            <p class="ap__bio">{{ d.artist.bio }}</p>
            <div class="ap__act">
              <FollowButton :artist-id="d.artist.id" :slug="d.artist.slug" :name="d.artist.name" />
              <a
                v-for="[k, v] in socials"
                :key="k"
                class="a-pill"
                :href="v"
                target="_blank"
                rel="noopener noreferrer"
                >{{ k }}</a
              >
            </div>
          </div>
        </header>
        <section>
          <h2 class="a-serif">{{ t('art.upcoming') }}</h2>
          <p v-if="!d.events.length" class="a-muted" data-test="artist-none">
            {{ t('art.noEvents') }}
          </p>
          <ul v-else class="ap__events" data-test="artist-events">
            <li v-for="e in d.events" :key="e.id">
              <EventCard :event="e" :to="{ name: 'event', params: { slug: e.slug } }" />
            </li>
          </ul>
        </section>
        <RouterLink class="a-pill" :to="{ name: 'artists' }">{{ t('art.all') }}</RouterLink>
      </template>
    </div>
  </ToneLight>
</template>

<style scoped>
.ap {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px var(--a-pad) 72px;
  display: grid;
  gap: 24px;
  justify-items: start;
}
.ap > section,
.ap__head {
  width: 100%;
}
.ap__head {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  align-items: center;
  padding: clamp(18px, 3vw, 28px);
  border: 1px solid var(--a-line);
  border-radius: 24px;
  background:
    radial-gradient(
      120% 140% at 100% 0%,
      color-mix(in srgb, var(--a-gold) 18%, transparent),
      transparent 60%
    ),
    var(--a-panel);
}
.ap__img {
  border-radius: 50% !important;
}
.ap__txt {
  display: grid;
  gap: 10px;
  flex: 1 1 320px;
  min-width: 0;
}
.ap__txt h1 {
  margin: 0;
  font-size: clamp(32px, 5vw, 52px);
  color: var(--a-cream);
  line-height: 1.05;
}
.ap__bio {
  margin: 0;
  max-width: 62ch;
  line-height: 1.6;
}
.ap__act {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.ap__events {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
</style>
