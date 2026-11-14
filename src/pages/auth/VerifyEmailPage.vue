<script setup lang="ts">
import { NButton } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { resendVerifyEmail, verifyEmail } from '@/api/auth'
import AuthSteps from '@/components/app/AuthSteps.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useCooldown } from '@/composables/useCooldown'
import { safeNext } from '@/router/next'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const apiMessage = useApiMessage()
const cooldown = useCooldown()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const state = ref<'idle' | 'verifying' | 'ok' | 'error'>(token.value ? 'verifying' : 'idle')
const errorText = ref('')
const info = ref('')
const busy = ref(false)

// Tautan email membuka halaman ini dengan ?token=. Sesi mungkin belum dipulihkan -> tunggu dulu.
onMounted(async () => {
  if (!auth.ready) await auth.restore()
  if (token.value) {
    try {
      await verifyEmail(token.value)
      if (auth.isAuthed) await auth.reloadMe()
      state.value = 'ok'
    } catch (e) {
      errorText.value = apiMessage(e)
      state.value = 'error'
    }
  } else if (auth.emailVerified) {
    state.value = 'ok'
  }
})

async function resend(): Promise<void> {
  info.value = ''
  errorText.value = ''
  busy.value = true
  try {
    await resendVerifyEmail()
    info.value = t('auth.email.resent')
    cooldown.start(60)
  } catch (e) {
    errorText.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}

async function recheck(): Promise<void> {
  info.value = ''
  errorText.value = ''
  busy.value = true
  try {
    await auth.reloadMe()
    if (auth.emailVerified) state.value = 'ok'
    else info.value = t('auth.email.notYet')
  } catch (e) {
    errorText.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}

const next = computed(() => safeNext(route.query.next))
async function proceed(): Promise<void> {
  // Pembelian butuh HP terverifikasi juga; arahkan ke sana bila belum.
  if (auth.isAuthed && !auth.phoneVerified) {
    await router.push({ name: 'verify-phone', query: route.query.next ? { next: next.value } : {} })
  } else {
    await router.push(next.value)
  }
}
</script>

<template>
  <div>
    <AuthSteps :current="2" />
    <h1 class="a-serif au-title">{{ t('auth.email.title') }}</h1>

    <p v-if="state === 'verifying'" class="a-muted au-lead" role="status">
      {{ t('auth.email.verifying') }}
    </p>

    <div v-else-if="state === 'ok'" data-test="email-ok">
      <p class="au-ok" role="status">{{ t('auth.email.ok') }}</p>
      <p class="au-links">
        <NButton v-if="auth.isAuthed" type="primary" size="large" @click="proceed">
          {{ auth.phoneVerified ? t('auth.email.continue') : t('auth.email.toPhone') }}
        </NButton>
        <RouterLink v-else class="a-pill a-pill--solid" :to="{ name: 'login' }">
          {{ t('auth.login.submit') }}
        </RouterLink>
      </p>
    </div>

    <div v-else-if="state === 'error'" data-test="email-error">
      <p class="au-err" role="alert">{{ errorText }}</p>
      <p v-if="auth.isAuthed" class="au-links">
        <NButton
          size="large"
          :loading="busy"
          :disabled="busy || cooldown.left.value > 0"
          @click="resend"
        >
          {{
            cooldown.left.value > 0
              ? t('auth.email.resendIn', { s: cooldown.left.value })
              : t('auth.email.resend')
          }}
        </NButton>
      </p>
      <p v-else class="au-links">
        <RouterLink :to="{ name: 'login' }">{{ t('auth.email.loginToResend') }}</RouterLink>
      </p>
    </div>

    <div v-else data-test="email-wait">
      <template v-if="auth.isAuthed">
        <p class="a-muted au-lead">
          {{ t('auth.email.sentTo', { email: auth.user?.email ?? '' }) }}
        </p>
        <p v-if="info" class="au-ok" role="status">{{ info }}</p>
        <p v-if="errorText" class="au-err" role="alert">{{ errorText }}</p>
        <div class="au-form">
          <NButton
            type="primary"
            size="large"
            block
            :loading="busy"
            :disabled="busy"
            @click="recheck"
          >
            {{ t('auth.email.recheck') }}
          </NButton>
          <NButton size="large" block :disabled="busy || cooldown.left.value > 0" @click="resend">
            {{
              cooldown.left.value > 0
                ? t('auth.email.resendIn', { s: cooldown.left.value })
                : t('auth.email.resend')
            }}
          </NButton>
        </div>
        <p class="au-links a-muted">
          <RouterLink :to="{ name: 'events' }">{{ t('auth.email.later') }}</RouterLink>
        </p>
      </template>
      <template v-else>
        <p class="a-muted au-lead">{{ t('auth.email.needLogin') }}</p>
        <p class="au-links">
          <RouterLink class="a-pill a-pill--solid" :to="{ name: 'login' }">{{
            t('auth.login.submit')
          }}</RouterLink>
        </p>
      </template>
    </div>
  </div>
</template>
