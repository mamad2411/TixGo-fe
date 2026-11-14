<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
defineEmits<{ top: [] }>()
</script>

<template>
  <footer class="l-cta" style="padding-top: 0">
    <div class="l-foot">
      <div>
        <p class="l-foot__mark">TIXGO</p>
        <p style="margin-top: 8px; max-width: 36ch">{{ t('landing.footer.tag') }}</p>
      </div>
      <nav :aria-label="t('landing.footer.nav')">
        <ul class="l-caps">
          <li>
            <a href="#tentang">{{ t('landing.nav.about') }}</a>
          </li>
          <li>
            <a href="#konser">{{ t('landing.nav.shows') }}</a>
          </li>
          <li>
            <a href="#keunggulan">{{ t('landing.nav.perks') }}</a>
          </li>
          <li>
            <a href="#kota">{{ t('landing.nav.cities') }}</a>
          </li>
        </ul>
      </nav>
      <button class="l-foot__top l-caps" type="button" @click="$emit('top')">
        {{ t('landing.footer.top') }}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
        >
          <path d="M7 12V2M3 6l4-4 4 4" />
        </svg>
      </button>
    </div>
    <p class="l-caps" style="margin-top: 24px; color: var(--l-muted); font-size: 11px">
      {{ t('landing.footer.legal') }}
    </p>
  </footer>
</template>
