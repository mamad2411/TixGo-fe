<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import TicketArt from './TicketArt.vue'

const { t } = useI18n()
</script>

<template>
  <section id="konser" class="l-cream l-flagship" data-m="flagship" aria-labelledby="flag-title">
    <h2
      id="flag-title"
      class="l-flagship__h"
      :aria-label="`${t('landing.flagship.a')} ${t('landing.flagship.b')}`"
    >
      <span class="l-serif l-flagship__a" data-m="fa" data-reveal aria-hidden="true">{{
        t('landing.flagship.a')
      }}</span>
      <span class="l-flagship__ticket" data-m="ft" aria-hidden="true"><TicketArt /></span>
      <span class="l-serif l-flagship__b" data-m="fb" data-reveal aria-hidden="true">{{
        t('landing.flagship.b')
      }}</span>
    </h2>
  </section>
</template>
