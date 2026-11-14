<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import BackLink from '@/components/app/BackLink.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useHeaderTone } from '@/composables/useHeaderTone'

const { t } = useI18n()
useHeaderTone(computed(() => 'light'))
useHead({ title: computed(() => t('nf.title')), meta: [{ name: 'robots', content: 'noindex' }] })
</script>

<template>
  <ToneLight class="tone-page">
    <div class="nf" data-test="not-found">
      <BackLink plain :fallback="{ name: 'events' }" />
      <p class="a-caps">404</p>
      <h1 class="a-serif">{{ t('nf.title') }}</h1>
      <p class="a-muted">{{ t('nf.body') }}</p>
      <div class="nf__act">
        <RouterLink class="a-pill a-pill--solid" :to="{ name: 'events' }">{{
          t('nf.browse')
        }}</RouterLink>
        <RouterLink class="a-pill" :to="{ name: 'help' }">{{ t('nf.help') }}</RouterLink>
      </div>
    </div>
  </ToneLight>
</template>

<style scoped>
.nf {
  max-width: 560px;
  margin: 0 auto;
  padding: 96px var(--a-pad) 120px;
  display: grid;
  gap: 14px;
  justify-items: start;
}
.nf h1 {
  margin: 0;
  font-size: clamp(34px, 6vw, 56px);
  color: var(--a-cream);
}
.nf p {
  margin: 0;
}
.nf__act {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
