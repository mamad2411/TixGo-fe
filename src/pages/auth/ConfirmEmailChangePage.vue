<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { confirmEmailChange } from '@/api/auth'
import { useApiMessage } from '@/composables/useApiMessage'
import { useAuthStore } from '@/stores/auth'

// Tautan dari email "Konfirmasi email baru": /auth/confirm-email-change?token=
const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const apiMessage = useApiMessage()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')

onMounted(async () => {
  if (!token.value) {
    err.value = t('auth.emailChange.noToken')
    state.value = 'error'
    return
  }
  try {
    if (!auth.ready) await auth.restore()
    await confirmEmailChange(token.value)
    if (auth.isAuthed) await auth.reloadMe()
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
})
</script>

<template>
  <div>
    <h1 class="a-serif au-title">{{ t('auth.emailChange.title') }}</h1>
    <p v-if="state === 'loading'" class="a-muted au-lead" role="status">
      {{ t('auth.emailChange.checking') }}
    </p>
    <template v-else-if="state === 'ok'">
      <p class="au-lead" role="status" data-test="email-change-ok">
        {{ t('auth.emailChange.done') }}
      </p>
      <RouterLink :to="{ name: auth.isAuthed ? 'security' : 'login' }" class="a-pill a-pill--solid">
        {{ auth.isAuthed ? t('auth.emailChange.toSecurity') : t('nav.login') }}
      </RouterLink>
    </template>
    <template v-else>
      <p class="au-lead" role="alert" data-test="email-change-err">{{ err }}</p>
      <RouterLink :to="{ name: auth.isAuthed ? 'security' : 'login' }" class="a-pill">
        {{ t('auth.emailChange.back') }}
      </RouterLink>
    </template>
  </div>
</template>
