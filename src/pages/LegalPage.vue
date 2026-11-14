<script setup lang="ts">
import { useHead } from '@unhead/vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { getLegal, getLegalVersions, type LegalDoc, type LegalVersion } from '@/api/account'
import BackLink from '@/components/app/BackLink.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'

// Dokumen legal berversi dari BE (markdown). Disanitasi DOMPurify sebelum v-html (aturan FE).
const KINDS = ['terms', 'privacy', 'refund', 'how_to_buy', 'faq', 'about', 'contact'] as const
const { t, locale } = useI18n()
useHeaderTone(computed(() => 'light'))
const route = useRoute()
const apiMessage = useApiMessage()
const kind = computed(() => String(route.params.kind))
const doc = ref<LegalDoc | null>(null)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const versions = ref<LegalVersion[]>([])
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    doc.value = await getLegal(kind.value, locale.value)
    state.value = 'ok'
    // Riwayat bersifat pelengkap: gagal memuatnya tidak boleh menyembunyikan dokumen yang sudah terbaca.
    versions.value = (await getLegalVersions(kind.value, locale.value).catch(() => [])).filter(
      (v) => v.published_at,
    )
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
watch([kind, locale], load, { immediate: true })
useHead({ title: computed(() => doc.value?.title ?? t('legal.title')) })
const html = computed(() =>
  doc.value ? DOMPurify.sanitize(marked.parse(doc.value.body, { async: false }) as string) : '',
)
</script>

<template>
  <ToneLight class="tone-page">
    <div class="lg">
      <BackLink plain :fallback="{ name: 'events' }" />
      <nav class="lg__tabs" :aria-label="t('legal.nav')">
        <RouterLink
          v-for="k in KINDS"
          :key="k"
          :to="{ name: 'legal', params: { kind: k } }"
          class="a-pill"
          >{{ t(`legal.k.${k}`) }}</RouterLink
        >
      </nav>
      <div
        v-if="state === 'loading'"
        class="a-sk"
        style="min-height: 280px; border-radius: 16px"
        role="status"
        :aria-label="t('common.loading')"
      />
      <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
      <article v-else-if="doc" class="lg__doc" data-test="legal-doc">
        <p class="a-caps">{{ t('legal.version', { v: doc.version }) }}</p>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="lg__body" v-html="html" />
      </article>
      <details v-if="versions.length > 1" class="lg__hist" data-test="legal-versions">
        <summary>{{ t('legal.history') }}</summary>
        <ul>
          <li v-for="v in versions" :key="v.id" :data-active="v.version === doc?.version">
            <strong>{{ t('legal.version', { v: v.version }) }}</strong>
            <span class="a-muted">{{ fmtDate(v.published_at!) }}</span>
            <small v-if="v.version === doc?.version" class="a-muted">{{
              t('legal.current')
            }}</small>
          </li>
        </ul>
      </details>
      <p class="a-muted lg__help">
        {{ t('legal.helpLead') }}
        <RouterLink :to="{ name: 'privacy-complaint' }" data-test="to-complaint">{{
          t('legal.helpLink')
        }}</RouterLink>
      </p>
    </div>
  </ToneLight>
</template>

<style scoped>
.lg {
  max-width: 780px;
  margin: 0 auto;
  padding: 24px var(--a-pad) 64px;
  display: grid;
  gap: 18px;
}
.lg__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.lg__tabs a.router-link-active {
  background: var(--a-gold);
  color: var(--a-on-gold, var(--a-bg));
  border-color: var(--a-gold);
}
.lg__hist {
  padding: 14px 18px;
  border: 1px solid var(--a-line);
  border-radius: 14px;
  background: var(--a-panel);
}
.lg__hist summary {
  cursor: pointer;
  font-weight: 600;
  min-height: 24px;
}
.lg__hist ul {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.lg__hist li {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: baseline;
}
.lg__help a {
  color: var(--a-gold);
}
.lg__doc {
  padding: 24px;
  border: 1px solid var(--a-line);
  border-radius: 18px;
  background: var(--a-panel);
}
.lg__body :deep(h1) {
  font-family: var(--a-serif, serif);
  font-size: clamp(28px, 4vw, 40px);
  margin: 0 0 16px;
  color: var(--a-cream);
}
.lg__body :deep(h2) {
  margin: 28px 0 8px;
  font-size: 22px;
}
.lg__body :deep(p),
.lg__body :deep(li) {
  line-height: 1.7;
}
.lg__body :deep(a) {
  color: var(--a-gold);
}
</style>
