<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ballUrl from '@/assets/photos/disco-ball.webp?url'
import ballSmall from '@/assets/photos/disco-ball-1200.webp?url'

const { t } = useI18n()
const cities = ['c1', 'c2', 'c3'] as const
</script>

<template>
  <section id="kota" class="l-cities" data-m="cities" aria-labelledby="cities-title">
    <h2 id="cities-title" class="l-cities__word" data-m="cword">{{ t('landing.cities.title') }}</h2>
    <img
      class="l-cities__ball"
      data-m="ball"
      :src="ballUrl"
      :srcset="`${ballSmall} 1200w, ${ballUrl} 2400w`"
      sizes="(min-width: 900px) 42vw, 80vw"
      :alt="t('landing.cities.ballAlt')"
      width="800"
      height="800"
      loading="lazy"
      decoding="async"
    />
    <div class="l-cities__right">
      <div class="l-cities__copy" data-reveal>
        <p class="l-cities__route">
          <span>{{ t('landing.cities.from') }}</span>
          <span class="l-cities__swap" data-m="swap">
            <span v-for="c in cities" :key="c">{{ t(`landing.cities.${c}`) }}</span>
          </span>
        </p>
        <p class="l-serif" style="font-size: clamp(24px, 2.6vw, 36px); font-weight: 400">
          {{ t('landing.cities.lead') }}
        </p>
        <p class="l-cities__body">{{ t('landing.cities.body') }}</p>
      </div>
      <aside class="l-cities__card" data-m="card" :aria-label="t('landing.cities.card.note')">
        <p class="l-caps" style="letter-spacing: 0.3em">{{ t('landing.cities.card.brand') }}</p>
        <dl>
          <div>
            <dt>{{ t('landing.cities.card.from') }}</dt>
            <dd>{{ t('landing.cities.card.you') }}</dd>
          </div>
          <div>
            <dt>{{ t('landing.cities.card.to') }}</dt>
            <dd>{{ t('landing.cities.card.stage') }}</dd>
          </div>
          <div>
            <dt>{{ t('landing.cities.card.who') }}</dt>
            <dd>{{ t('landing.cities.card.whoV') }}</dd>
          </div>
          <div>
            <dt>{{ t('landing.cities.card.time') }}</dt>
            <dd>{{ t('landing.cities.card.timeV') }}</dd>
          </div>
          <div>
            <dt>{{ t('landing.cities.card.seat') }}</dt>
            <dd>{{ t('landing.cities.card.seatV') }}</dd>
          </div>
        </dl>
        <div class="l-cities__bars" aria-hidden="true" />
        <p class="l-cities__note">{{ t('landing.cities.card.note') }}</p>
      </aside>
    </div>
  </section>
</template>
