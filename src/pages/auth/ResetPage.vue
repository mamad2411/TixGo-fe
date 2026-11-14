<script setup lang="ts">
import { NButton } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { resetPassword } from '@/api/auth'
import {
  getResetInfo,
  sendResetOtp,
  type MfaMethod,
  type OtpMethod,
  type ResetInfo,
} from '@/api/mfa'
import AppField from '@/components/app/AppField.vue'
import MfaCodeField from '@/components/app/MfaCodeField.vue'
import PasswordInput from '@/components/app/PasswordInput.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useFormValidation } from '@/composables/useFormValidation'

import { resetSchema } from './schemas'

const { t } = useI18n()
const route = useRoute()
const apiMessage = useApiMessage()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const form = reactive({ password: '' })
const { errors, validate, validateField } = useFormValidation(resetSchema, form)
const busy = ref(false)
const done = ref(false)
const formError = ref('')

// Faktor kedua yang dibutuhkan akun ini. Tautan email saja tidak cukup bila akun punya verifikasi dua langkah
// atau nomor HP terverifikasi; server yang memutuskan, halaman ini hanya menanyakannya.
const info = ref<ResetInfo | null>(null)
const infoState = ref<'loading' | 'ok' | 'error'>('loading')
const sf = ref<{ method: MfaMethod; code: string }>({ method: 'totp', code: '' })
const sendOtp = (m: OtpMethod) => sendResetOtp(token.value, m)
const needSf = computed(() => !!info.value && info.value.second_factor !== 'none')
onMounted(async () => {
  if (!token.value) return
  try {
    info.value = await getResetInfo(token.value)
    infoState.value = 'ok'
  } catch (e) {
    formError.value = apiMessage(e)
    infoState.value = 'error'
  }
})

async function submit(): Promise<void> {
  formError.value = ''
  if (!validate()) return
  if (needSf.value && !sf.value.code.trim()) {
    formError.value = t('auth.reset.needCode')
    return
  }
  busy.value = true
  try {
    await resetPassword(
      token.value,
      form.password,
      needSf.value ? { mfa_method: sf.value.method, mfa_code: sf.value.code.trim() } : {},
    )
    done.value = true
  } catch (e) {
    formError.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="a-serif au-title">{{ t('auth.reset.title') }}</h1>

    <div v-if="!token" data-test="reset-notoken">
      <p class="au-err" role="alert">{{ t('auth.reset.noToken') }}</p>
      <p class="au-links">
        <RouterLink :to="{ name: 'forgot' }">{{ t('auth.reset.requestNew') }}</RouterLink>
      </p>
    </div>

    <div v-else-if="done" data-test="reset-done">
      <p class="au-ok" role="status">{{ t('auth.reset.done') }}</p>
      <p class="au-links">
        <RouterLink class="a-pill a-pill--solid" :to="{ name: 'login' }">{{
          t('auth.login.submit')
        }}</RouterLink>
      </p>
    </div>

    <template v-else>
      <p class="a-muted au-lead">{{ t('auth.reset.lead') }}</p>
      <form class="au-form" novalidate @submit.prevent="submit">
        <p v-if="formError" class="au-err" role="alert" data-test="form-error">{{ formError }}</p>
        <AppField
          id="password"
          :label="t('auth.reset.newPassword')"
          :hint="t('auth.field.passwordHint')"
          :error="errors.password ? t(errors.password) : undefined"
          required
        >
          <template #default="{ inputProps, invalid }">
            <PasswordInput
              v-model="form.password"
              autocomplete="new-password"
              :input-props="inputProps"
              :invalid="invalid"
              @blur="validateField('password')"
            />
          </template>
        </AppField>
        <fieldset v-if="needSf && info" class="au-mfa" data-test="reset-mfa">
          <legend>{{ t('auth.reset.factorTitle') }}</legend>
          <p class="a-muted au-factor">
            {{
              t(info.second_factor === 'phone' ? 'auth.reset.factorPhone' : 'auth.reset.factorMfa')
            }}
          </p>
          <MfaCodeField
            v-model="sf"
            :methods="info.methods"
            :email-masked="info.email_masked"
            :phone-masked="info.phone_masked"
            :send="sendOtp"
          />
        </fieldset>
        <NButton
          type="primary"
          size="large"
          attr-type="submit"
          block
          :loading="busy"
          :disabled="busy || infoState === 'loading'"
        >
          {{ t('auth.reset.submit') }}
        </NButton>
      </form>
      <p v-if="formError" class="au-links">
        <RouterLink :to="{ name: 'forgot' }">{{ t('auth.reset.requestNew') }}</RouterLink>
      </p>
    </template>
  </div>
</template>
