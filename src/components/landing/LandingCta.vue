<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const lines = t('landing.cta.title').split('\n')
</script>

<template>
  <section id="mulai" class="l-cta" data-m="cta" aria-labelledby="cta-title">
    <div class="l-cta__grid">
      <h2 id="cta-title" class="l-serif l-cta__title" data-m="cta-in">
        {{ lines[0] }}<br /><span>{{ lines[1] }}</span>
      </h2>
      <div data-m="cta-in">
        <p class="l-cta__body">{{ t('landing.cta.body') }}</p>
        <a class="l-pill l-pill--solid" href="/events">{{ t('landing.cta.button') }}</a>
      </div>
    </div>
  </section>
</template>
