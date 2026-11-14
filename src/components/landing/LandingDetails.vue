<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import blueBg from '@/assets/photos/blue-flare.webp?url'
import blueBgS from '@/assets/photos/blue-flare-1200.webp?url'
import frontBg from '@/assets/photos/front-row-bg.webp?url'
import frontBgS from '@/assets/photos/front-row-bg-1600.webp?url'
import frontFg from '@/assets/photos/front-row-fg.webp?url'
import frontFgS from '@/assets/photos/front-row-fg-1600.webp?url'
import redBg from '@/assets/photos/hands-red-bg.webp?url'
import redBgS from '@/assets/photos/hands-red-bg-1200.webp?url'
import redFg from '@/assets/photos/hands-red-fg.webp?url'
import redFgS from '@/assets/photos/hands-red-fg-1200.webp?url'
import silBg from '@/assets/photos/hands-silhouette-bg.webp?url'
import silBgS from '@/assets/photos/hands-silhouette-bg-1200.webp?url'
import silFg from '@/assets/photos/hands-silhouette-fg.webp?url'
import silFgS from '@/assets/photos/hands-silhouette-fg-1200.webp?url'
import phoneBg from '@/assets/photos/phone-light-bg.webp?url'
import phoneBgS from '@/assets/photos/phone-light-bg-1200.webp?url'
import phoneFg from '@/assets/photos/phone-light-fg.webp?url'
import phoneFgS from '@/assets/photos/phone-light-fg-1200.webp?url'

const { t } = useI18n()
const items = ['queue', 'squad', 'resale', 'refund', 'gate'] as const
type Key = (typeof items)[number]
// Varian kecil (1200/1600 px) dipakai lewat srcset supaya layar 1x tidak mengunduh foto 2400 px.
const SET = (small: string, smallW: number, big: string, bigW = 2400) =>
  `${small} ${smallW}w, ${big} ${bigW}w`
// Satu foto per butir; posisi crop menjaga subjek tetap terlihat di bingkai potret.
const photos: Record<Key, { bg: string; bgSet: string; fg?: string; fgSet?: string; pos: string }> =
  {
    queue: {
      bg: silBg,
      bgSet: SET(silBgS, 1200, silBg),
      fg: silFg,
      fgSet: SET(silFgS, 1200, silFg),
      pos: '58% 40%',
    },
    squad: { bg: blueBg, bgSet: SET(blueBgS, 1200, blueBg), pos: '52% 50%' },
    resale: {
      bg: redBg,
      bgSet: SET(redBgS, 1200, redBg),
      fg: redFg,
      fgSet: SET(redFgS, 1200, redFg),
      pos: '46% 55%',
    },
    refund: {
      bg: phoneBg,
      bgSet: SET(phoneBgS, 1200, phoneBg),
      fg: phoneFg,
      fgSet: SET(phoneFgS, 1200, phoneFg),
      pos: '44% 50%',
    },
    gate: {
      bg: frontBg,
      bgSet: SET(frontBgS, 1600, frontBg, 3200),
      fg: frontFg,
      fgSet: SET(frontFgS, 1600, frontFg, 3200),
      pos: '30% 45%',
    },
  }
const open = ref<Key>('queue')
const tag = computed(() => t(`landing.details.items.${open.value}.tag`))
const root = ref<HTMLElement | null>(null)

// Satu panel selalu terbuka (pola akordeon Aerive); klik panel terbuka tidak menutupnya.
const toggle = (k: Key) => {
  open.value = k
}
// Mode sinematik: scroll memajukan butir (composable mengirim 'landing-step' dengan indeks).
const onStep = (e: Event) => {
  const i = (e as CustomEvent<number>).detail
  open.value = items[Math.min(items.length - 1, Math.max(0, i))] as Key
}
onMounted(() => root.value?.addEventListener('landing-step', onStep))
onBeforeUnmount(() => root.value?.removeEventListener('landing-step', onStep))
</script>

<template>
  <section
    id="keunggulan"
    ref="root"
    class="l-cream l-details"
    data-m="details"
    aria-labelledby="details-title"
  >
    <div class="l-details__text">
      <h2 id="details-title" class="l-serif l-details__title" data-m="details-head">
        {{ t('landing.details.title') }}
      </h2>
      <p class="l-details__lead" data-m="details-head">{{ t('landing.details.lead') }}</p>
      <ul class="l-acc" data-m="details-head">
        <li v-for="k in items" :key="k" class="l-acc__item">
          <h3>
            <button
              :id="`acc-btn-${k}`"
              class="l-acc__btn"
              type="button"
              :aria-expanded="open === k"
              :aria-controls="`acc-panel-${k}`"
              @click="toggle(k)"
            >
              <span>{{ t(`landing.details.items.${k}.title`) }}</span>
              <span class="l-acc__icon" aria-hidden="true" />
            </button>
          </h3>
          <div
            :id="`acc-panel-${k}`"
            class="l-acc__panel"
            role="region"
            :aria-labelledby="`acc-btn-${k}`"
            :data-open="open === k"
          >
            <div>
              <p>{{ t(`landing.details.items.${k}.body`) }}</p>
            </div>
          </div>
        </li>
      </ul>
    </div>
    <figure class="l-details__photo" data-m="photo" style="margin: 0">
      <div v-for="k in items" :key="k" class="l-details__img" :data-active="open === k">
        <img
          class="l-details__bg"
          :src="photos[k].bg"
          :srcset="photos[k].bgSet"
          sizes="(min-width: 900px) 46vw, 92vw"
          :style="{ objectPosition: photos[k].pos }"
          :alt="open === k ? t('landing.details.photoAlt') : ''"
          :aria-hidden="open === k ? undefined : 'true'"
          width="1700"
          height="1130"
          loading="lazy"
          decoding="async"
        />
        <img
          v-if="photos[k].fg"
          class="l-details__fgimg"
          :src="photos[k].fg"
          :srcset="photos[k].fgSet"
          sizes="(min-width: 900px) 46vw, 92vw"
          :style="{ objectPosition: photos[k].pos }"
          alt=""
          aria-hidden="true"
          width="1700"
          height="1130"
          loading="lazy"
          decoding="async"
        />
      </div>
      <figcaption class="l-details__tag l-caps" aria-live="polite">{{ tag }}</figcaption>
    </figure>
  </section>
</template>
