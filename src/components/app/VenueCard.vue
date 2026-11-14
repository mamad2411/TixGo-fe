<script setup lang="ts">
import { Clock, Map2, Route, Users } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { VenueView } from '@/api/events'
import { mediaAt, mediaSrcset } from '@/utils/media'

const props = defineProps<{ venue: VenueView; hideName?: boolean }>()
const { t, locale } = useI18n()
const broken = ref(false)
watch(
  () => props.venue.image_url,
  () => (broken.value = false),
)
const initials = computed(() =>
  props.venue.name
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() ?? '')
    .join(''),
)
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))

const tzLabel = computed(() => {
  const p = new Intl.DateTimeFormat('id-ID', { timeZone: props.venue.tz, timeZoneName: 'short' })
    .formatToParts(new Date())
    .find((x) => x.type === 'timeZoneName')
  return p?.value ?? props.venue.tz
})
const q = computed(() =>
  props.venue.lat != null && props.venue.lng != null
    ? `${props.venue.lat},${props.venue.lng}`
    : `${props.venue.name} ${props.venue.city}`,
)
const mapHref = computed(
  () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.value)}`,
)
const routeHref = computed(
  () => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q.value)}`,
)
</script>

<template>
  <div class="vc">
    <figure class="vc__photo" data-test="venue-photo">
      <!-- Foto venue selebar kolom (~640 px). Dulu URL mentah (1600 px, ~400 kB) dipakai tanpa
           srcset, jadi foto ini jadi berkas terberat di halaman detail konser. -->
      <img
        v-if="venue.image_url && !broken"
        :src="mediaAt(venue.image_url, 800)"
        :srcset="mediaSrcset(venue.image_url)"
        sizes="(min-width: 900px) 640px, 100vw"
        :alt="venue.name"
        loading="lazy"
        decoding="async"
        @error="broken = true"
      />
      <span v-else class="vc__ph" aria-hidden="true">{{ initials }}</span>
      <figcaption
        v-if="venue.image_url && venue.image_credit"
        class="vc__credit"
        data-test="venue-credit"
      >
        <a
          v-if="venue.image_source"
          :href="venue.image_source"
          target="_blank"
          rel="noopener noreferrer"
          >{{ venue.image_credit }}</a
        >
        <template v-else>{{ venue.image_credit }}</template>
      </figcaption>
    </figure>
    <div class="vc__main">
      <div>
        <p v-if="!hideName" class="vc__name a-serif">{{ venue.name }}</p>
        <p class="a-muted">
          {{ venue.address }}<template v-if="venue.address">, </template>{{ venue.city }}
        </p>
      </div>
    </div>
    <ul class="vc__facts">
      <li v-if="venue.capacity">
        <NIcon :component="Users" :size="18" aria-hidden="true" />
        <span class="a-caps">{{ t('detail.capacityLabel') }}</span>
        <strong>{{ venue.capacity.toLocaleString(bcp) }}</strong>
      </li>
      <li>
        <NIcon :component="Clock" :size="18" aria-hidden="true" />
        <span class="a-caps">{{ t('detail.timezone') }}</span>
        <strong>{{ tzLabel }}</strong>
      </li>
      <li v-if="venue.lat != null && venue.lng != null">
        <NIcon :component="Map2" :size="18" aria-hidden="true" />
        <span class="a-caps">{{ t('detail.coords') }}</span>
        <strong class="vc__mono">{{ venue.lat.toFixed(4) }}, {{ venue.lng.toFixed(4) }}</strong>
      </li>
    </ul>
    <div class="vc__acts">
      <a class="a-pill" :href="mapHref" target="_blank" rel="noopener noreferrer">
        <NIcon :component="Map2" :size="16" aria-hidden="true" /> {{ t('detail.openMap') }}
      </a>
      <a class="a-pill a-pill--solid" :href="routeHref" target="_blank" rel="noopener noreferrer">
        <NIcon :component="Route" :size="16" aria-hidden="true" /> {{ t('detail.route') }}
      </a>
    </div>
  </div>
</template>

<style scoped>
.vc {
  display: grid;
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--a-line);
  border-radius: 22px;
  background: var(--a-bg2);
}
.vc__main {
  display: flex;
  gap: 16px;
  align-items: center;
}
.vc__credit {
  position: absolute;
  right: 8px;
  bottom: 8px;
  max-width: calc(100% - 16px);
  padding: 3px 9px;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.6);
  color: #fff;
  font-size: 11px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vc__credit a {
  color: inherit;
  text-decoration: underline;
}
.vc__photo {
  position: relative;
  margin: 0;
  aspect-ratio: 16 / 7;
  border-radius: 16px;
  overflow: hidden;
  background: rgb(217 185 121 / 0.14);
}
.vc__photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.vc__ph {
  display: grid;
  place-items: center;
  height: 100%;
  font-size: 40px;
  letter-spacing: 0.08em;
  color: var(--a-gold);
}
.vc__name {
  font-size: 28px;
  color: var(--a-cream);
}
.vc__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.vc__facts li {
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--a-bg);
  color: var(--a-gold);
}
.vc__facts strong {
  color: var(--a-cream);
  font-size: 17px;
}
.vc__mono {
  font-variant-numeric: tabular-nums;
  font-size: 14px !important;
}
.vc__acts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
