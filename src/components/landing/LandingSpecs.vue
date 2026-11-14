<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import planUrl from '@/assets/illustrations/landing/landing-venue-plan.svg?url'

const { t } = useI18n()
const specs = ['cat', 'ext', 'pay', 'tix'] as const
</script>

<template>
  <section id="tentang" class="l-cream l-specs" data-m="specs" aria-labelledby="specs-title">
    <div>
      <p class="l-caps l-specs__eyebrow" data-m="specs-text">{{ t('landing.specs.eyebrow') }}</p>
      <h2 id="specs-title" class="l-serif l-specs__title" data-m="specs-text">
        {{ t('landing.specs.title') }}
      </h2>
      <dl class="l-specs__grid" data-m="specs-text">
        <div v-for="s in specs" :key="s">
          <dt>{{ t(`landing.specs.${s}`) }}</dt>
          <dd>{{ t(`landing.specs.${s}V`) }}</dd>
        </div>
      </dl>
    </div>
    <div class="l-specs__plan">
      <img
        data-m="plan"
        :src="planUrl"
        :alt="t('landing.specs.planAlt')"
        width="1000"
        height="1000"
        loading="lazy"
        decoding="async"
      />
    </div>
    <div>
      <p class="l-specs__lead" data-m="specs-text">{{ t('landing.specs.lead') }}</p>
      <p class="l-specs__body" data-m="specs-text">{{ t('landing.specs.body') }}</p>
      <a class="l-pill" data-m="specs-text" href="/events">{{ t('landing.specs.cta') }}</a>
    </div>
  </section>
</template>
