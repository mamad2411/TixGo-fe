<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Gift } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { acceptClaim, previewClaim, type ClaimPreview } from '@/api/account'
import { ApiError, toApiError } from '@/api/errors'
import BackLink from '@/components/app/BackLink.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import '@/pages/account/accountStyle.css'

// Penerima tiket kiriman: pratinjau (dari siapa, event, kursi, batas waktu) lalu terima.
const { t, locale } = useI18n()
useHeaderTone(computed(() => 'light'))
useHead({ title: computed(() => t('claim.title')) })
const route = useRoute()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const token = computed(() => String(route.params.token))
const when = (iso: string) =>
  new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(iso))

// Aturan bisnis (tautan terpakai/kedaluwarsa, email tidak cocok) harus terbaca spesifik oleh penerima.
const RULE = ['INVALID_STATE', 'NOT_ALLOWED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'GONE']
function text(e: unknown): string {
  const ae = toApiError(e)
  return ae instanceof ApiError && RULE.includes(ae.code) && ae.message ? ae.message : apiMessage(e)
}

const p = ref<ClaimPreview | null>(null)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    p.value = await previewClaim(token.value)
    state.value = 'ok'
  } catch (e) {
    err.value = text(e)
    state.value = 'error'
  }
}
onMounted(load)

const busy = ref(false)
const accErr = ref('')
async function accept(): Promise<void> {
  busy.value = true
  accErr.value = ''
  try {
    const tk = await acceptClaim(token.value)
    message.success(t('claim.done'))
    await router.replace({ name: 'ticket', params: { id: tk.id } })
  } catch (e) {
    accErr.value = text(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ToneLight class="tone-page">
    <div class="cl">
      <BackLink plain :fallback="{ name: 'events' }" />
      <div
        v-if="state === 'loading'"
        class="a-sk"
        style="min-height: 240px; border-radius: 18px"
        role="status"
        :aria-label="t('common.loading')"
      />
      <template v-else-if="state === 'error'">
        <ErrorState :message="err" @retry="load" />
        <RouterLink class="a-pill" :to="{ name: 'events' }">{{ t('claim.browse') }}</RouterLink>
      </template>
      <section v-else-if="p" class="ac__card cl__card" data-test="claim">
        <span class="cl__ic"><NIcon :component="Gift" :size="30" aria-hidden="true" /></span>
        <p class="a-caps">{{ t('claim.kicker', { n: p.from_name }) }}</p>
        <h1 class="a-serif ac__title">{{ p.event_title }}</h1>
        <p>{{ when(p.starts_at) }}</p>
        <p v-if="p.seat_label" class="a-muted">{{ t('claim.seat', { s: p.seat_label }) }}</p>
        <p class="a-muted">{{ t('claim.expires', { d: when(p.expires_at) }) }}</p>
        <p v-if="p.targeted" class="a-muted">{{ t('claim.targeted') }}</p>
        <p class="a-muted">{{ t('claim.note') }}</p>
        <small class="cl__err" role="alert">{{ accErr }}</small>
        <div class="ac__act">
          <button
            type="button"
            class="a-pill a-pill--solid"
            :disabled="busy"
            data-test="claim-accept"
            @click="accept"
          >
            {{ busy ? t('common.loading') : t('claim.accept') }}
          </button>
          <RouterLink class="a-pill" :to="{ name: 'events' }">{{ t('claim.decline') }}</RouterLink>
        </div>
      </section>
    </div>
  </ToneLight>
</template>

<style scoped>
.cl {
  max-width: 560px;
  margin: 0 auto;
  padding: 40px var(--a-pad) 64px;
  display: grid;
  gap: 18px;
}
.cl__card {
  gap: 10px;
}
.cl__card p {
  margin: 0;
}
.cl__ic {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: var(--a-gold);
  color: var(--a-on-gold, var(--a-bg));
}
.cl__err {
  min-height: 16px;
  color: var(--a-danger);
  font-size: 13px;
}
</style>
