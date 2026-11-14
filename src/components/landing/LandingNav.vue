<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

const { t } = useI18n()

const links = [
  { key: 'about', hash: '#tentang' },
  { key: 'shows', hash: '#konser' },
  { key: 'perks', hash: '#keunggulan' },
  { key: 'cities', hash: '#kota' },
] as const
</script>

<template>
  <header class="l-nav" data-m="nav">
    <nav :aria-label="t('landing.nav.aria')">
      <ul class="l-nav__links l-caps">
        <li v-for="l in links" :key="l.key">
          <a :href="l.hash">{{ t(`landing.nav.${l.key}`) }}</a>
        </li>
      </ul>
    </nav>
    <a class="l-nav__mark" href="#top" data-m="navmark" aria-label="TixGo">TIXGO</a>
    <RouterLink class="l-pill l-nav__cta" :to="{ name: 'events' }">
      {{ t('landing.nav.cta') }}
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
      >
        <path d="M2 8 8 2M3 2h5v5" />
      </svg>
    </RouterLink>
  </header>
</template>
