<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import frameUrl from '@/assets/illustrations/landing/landing-portal-frame.svg?url'
import hazeUrl from '@/assets/illustrations/landing/landing-haze.svg?url'
import sceneBgUrl from '@/assets/photos/front-row-bg.webp?url'
import sceneFgUrl from '@/assets/photos/front-row-fg.webp?url'
import sceneBgSmall from '@/assets/photos/front-row-bg-1600.webp?url'
import sceneFgSmall from '@/assets/photos/front-row-fg-1600.webp?url'

const { t } = useI18n()
const lines = (k: string) => t(k).split('\n')
const words = computed(() => t('landing.manifesto').split(' '))
const cols = ['queue', 'price', 'ticket', 'resale'] as const
// Debu/bokeh: posisi & kecepatan paralaks tetap (deterministik) supaya SSR/CSR identik dan tes stabil.
const dust = Array.from({ length: 12 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  y: (i * 53 + 7) % 100,
  s: 2 + ((i * 7) % 5),
  d: 0.4 + ((i * 13) % 10) / 10,
}))
</script>

<template>
  <section class="l-hero" data-m="hero" aria-labelledby="hero-title">
    <div class="l-hero__stage" data-m="stage">
      <div class="l-hero__clip" data-m="clip" aria-hidden="true">
        <div class="l-hero__scene" data-m="scene">
          <img
            class="l-hero__plate"
            data-m="plate-bg"
            :src="sceneBgUrl"
            :srcset="`${sceneBgSmall} 1600w, ${sceneBgUrl} 3200w`"
            sizes="100vw"
            alt=""
            width="3200"
            height="2133"
            decoding="async"
            fetchpriority="high"
          />
          <div class="l-hero__glow" data-m="glow" />
          <img
            class="l-hero__plate l-hero__plate--fg"
            data-m="plate-fg"
            :src="sceneFgUrl"
            :srcset="`${sceneFgSmall} 1600w, ${sceneFgUrl} 3200w`"
            sizes="100vw"
            alt=""
            width="3200"
            height="2133"
            decoding="async"
            fetchpriority="low"
          />
        </div>
        <div class="l-hero__dust" aria-hidden="true">
          <i
            v-for="(p, i) in dust"
            :key="i"
            data-m="dust"
            :data-d="p.d"
            :style="{ left: p.x + '%', top: p.y + '%', width: p.s + 'px', height: p.s + 'px' }"
          />
        </div>
      </div>
      <div class="l-hero__veil" data-m="veil" aria-hidden="true" />

      <h1 id="hero-title" class="l-serif l-hero__t1" data-m="t1">
        <span v-for="(ln, i) in lines('landing.hero.title')" :key="i">{{ ln }}</span>
      </h1>
      <p class="l-serif l-hero__t2" data-m="t2">
        <span v-for="(ln, i) in lines('landing.hero.title2')" :key="i" style="display: block">{{
          ln
        }}</span>
      </p>

      <div
        class="l-hero__portal"
        data-m="portal"
        role="img"
        :aria-label="t('landing.hero.sceneAlt')"
      >
        <div class="l-hero__window" aria-hidden="true">
          <img
            :src="sceneBgUrl"
            :srcset="`${sceneBgSmall} 1600w, ${sceneBgUrl} 3200w`"
            sizes="100vw"
            alt=""
            width="3200"
            height="2133"
            decoding="async"
          />
          <img
            class="l-hero__window-fg"
            :src="sceneFgUrl"
            :srcset="`${sceneFgSmall} 1600w, ${sceneFgUrl} 3200w`"
            sizes="100vw"
            alt=""
            width="3200"
            height="2133"
            decoding="async"
          />
        </div>
        <img
          class="l-hero__frame"
          data-m="frame"
          :src="frameUrl"
          alt=""
          aria-hidden="true"
          width="600"
          height="900"
        />
      </div>

      <div class="l-hero__sub" data-m="sub">
        <p class="l-hero__sub-title">{{ t('landing.hero.subTitle') }}</p>
        <span class="l-hero__sub-rule" aria-hidden="true" />
        <p class="l-hero__sub-body">{{ t('landing.hero.subBody') }}</p>
      </div>
      <div class="l-hero__hint l-caps" data-m="hint" aria-hidden="true">
        <span>{{ t('landing.hero.scroll') }}</span>
        <span>{{ t('landing.hero.begin') }}</span>
      </div>

      <p class="l-hero__mark" data-m="mark" aria-hidden="true">{{ t('landing.hero.mark') }}</p>
      <p class="l-hero__manifesto" data-m="manifesto">
        <span v-for="(w, i) in words" :key="i" class="w">{{ w }}</span>
      </p>
      <p class="l-hero__lockup l-caps" data-m="lockup" aria-hidden="true">
        <b>TIXGO</b><span>{{ t('landing.brand.tag') }}</span>
      </p>
      <div class="l-hero__cols">
        <article v-for="c in cols" :key="c" class="l-hero__col" data-m="col">
          <h3>{{ t(`landing.cols.${c}.title`) }}</h3>
          <p>{{ t(`landing.cols.${c}.body`) }}</p>
        </article>
      </div>

      <img
        class="l-hero__haze"
        data-m="haze"
        :src="hazeUrl"
        alt=""
        aria-hidden="true"
        width="1600"
        height="900"
      />
      <div class="l-hero__cream" data-m="cream" aria-hidden="true" />
    </div>
  </section>
</template>
