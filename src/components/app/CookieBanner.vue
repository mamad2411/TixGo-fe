<script setup lang="ts">
import { Cookie, X } from '@vicons/tabler'
import { NIcon, NSwitch } from 'naive-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useCookieConsent } from '@/composables/useCookieConsent'

const { t } = useI18n()
const apiMessage = useApiMessage()
const { stored, open, save, dismiss } = useCookieConsent()
const detail = ref(false)
const analytics = ref(false)
const marketing = ref(false)
const busy = ref(false)
const err = ref('')

watch(
  open,
  (v) => {
    if (!v) return
    analytics.value = stored.value?.analytics ?? false
    marketing.value = stored.value?.marketing ?? false
    detail.value = stored.value !== null
    err.value = ''
  },
  { immediate: true },
)

async function choose(a: boolean, m: boolean): Promise<void> {
  busy.value = true
  err.value = ''
  try {
    await save({ analytics: a, marketing: m })
  } catch (e) {
    err.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ToneLight v-if="open" class="ck-tone">
    <section class="ck" role="region" :aria-label="t('ck.title')" data-test="cookie-banner">
      <header class="ck__top">
        <span class="ck__ic" aria-hidden="true"><NIcon :component="Cookie" :size="20" /></span>
        <h2 class="ck__h">{{ t('ck.title') }}</h2>
        <button
          v-if="stored"
          type="button"
          class="ck__x"
          :aria-label="t('common.close')"
          @click="dismiss"
        >
          <NIcon :component="X" :size="18" />
        </button>
      </header>
      <p class="ck__p">
        {{ t('ck.body') }}
        <RouterLink :to="{ name: 'legal', params: { kind: 'privacy' } }">{{
          t('ck.policy')
        }}</RouterLink>
      </p>

      <ul v-if="detail" class="ck__opts">
        <li class="ck__row">
          <span class="ck__lbl"
            ><strong>{{ t('ck.essential') }}</strong
            ><small>{{ t('ck.essentialBody') }}</small></span
          >
          <NSwitch :value="true" disabled :aria-label="t('ck.essential')" />
        </li>
        <li class="ck__row">
          <span class="ck__lbl"
            ><strong>{{ t('ck.analytics') }}</strong
            ><small>{{ t('ck.analyticsBody') }}</small></span
          >
          <NSwitch
            v-model:value="analytics"
            :aria-label="t('ck.analytics')"
            data-test="ck-analytics"
          />
        </li>
        <li class="ck__row">
          <span class="ck__lbl"
            ><strong>{{ t('ck.marketing') }}</strong
            ><small>{{ t('ck.marketingBody') }}</small></span
          >
          <NSwitch
            v-model:value="marketing"
            :aria-label="t('ck.marketing')"
            data-test="ck-marketing"
          />
        </li>
      </ul>
      <p v-if="err" class="ck__err" role="alert">{{ err }}</p>

      <div class="ck__act">
        <button
          type="button"
          class="a-pill a-pill--solid ck__main"
          :disabled="busy"
          data-test="ck-all"
          @click="choose(true, true)"
        >
          {{ t('ck.all') }}
        </button>
        <button
          type="button"
          class="a-pill a-pill--sm"
          :disabled="busy"
          data-test="ck-essential"
          @click="choose(false, false)"
        >
          {{ t('ck.onlyEssential') }}
        </button>
        <button v-if="!detail" type="button" class="a-pill a-pill--sm" @click="detail = true">
          {{ t('ck.manage') }}
        </button>
        <button
          v-else
          type="button"
          class="a-pill a-pill--sm"
          :disabled="busy"
          data-test="ck-save"
          @click="choose(analytics, marketing)"
        >
          {{ t('ck.save') }}
        </button>
      </div>
    </section>
  </ToneLight>
</template>

<style scoped>
.ck-tone {
  display: contents; /* hanya pembawa token tema; tidak ikut menggambar latar */
}
.ck {
  position: fixed;
  inset: auto 12px 12px 12px;
  z-index: 60;
  display: grid;
  gap: 12px;
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  padding: 18px;
  border-radius: 20px;
  border: 1px solid var(--a-line);
  background: var(--a-bg2);
  color: var(--a-ink);
  box-shadow: var(--a-shadow);
  animation: ck-in 0.28s ease-out;
}
@keyframes ck-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ck {
    animation: none;
  }
}
.ck__top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ck__ic {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgb(224 178 94 / 0.14);
  color: var(--a-gold);
}
.ck__h {
  margin: 0;
  flex: 1;
  font-size: 17px;
  font-weight: 700;
}
.ck__x {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--a-muted);
  cursor: pointer;
}
.ck__x:hover,
.ck__x:focus-visible {
  background: var(--a-bg3);
  color: var(--a-ink);
}
.ck__p {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--a-muted);
}
.ck__p a {
  color: var(--a-gold);
  text-underline-offset: 3px;
  white-space: nowrap;
}
.ck__opts {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border-radius: 14px;
  background: var(--a-bg3);
}
.ck__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 14px;
}
.ck__row + .ck__row {
  border-top: 1px solid var(--a-line);
}
.ck__lbl {
  display: grid;
  gap: 2px;
  min-width: 0;
  font-size: 14px;
}
.ck__lbl small {
  color: var(--a-muted);
  font-size: 12.5px;
  line-height: 1.4;
}
.ck__err {
  margin: 0;
  color: var(--a-danger);
  font-size: 13px;
}
.ck__act {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.ck__main {
  grid-column: 1 / -1;
}
.ck__act .a-pill--sm {
  min-height: 40px;
}
@media (max-width: 719px) {
  .ck {
    gap: 10px;
    padding: 14px;
    border-radius: 18px;
  }
  .ck__p {
    font-size: 13px;
    line-height: 1.45;
  }
  .ck__main {
    min-height: 42px;
  }
}
@media (min-width: 720px) {
  .ck {
    inset: auto auto 20px 20px;
    width: 420px;
  }
}
</style>
