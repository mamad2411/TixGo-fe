<script setup lang="ts">
import { Mail } from '@vicons/tabler'
import { NButton, useMessage } from 'naive-ui'
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { toApiError } from '@/api/errors'
import { sendLoginOtp, type MfaMethod, type OtpMethod } from '@/api/mfa'
import AppField from '@/components/app/AppField.vue'
import IconInput from '@/components/app/IconInput.vue'
import MfaCodeField from '@/components/app/MfaCodeField.vue'
import PasswordInput from '@/components/app/PasswordInput.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useFormValidation } from '@/composables/useFormValidation'
import { safeNext } from '@/router/next'
import { homeFor } from '@/utils/roles'
import { useAuthStore } from '@/stores/auth'

import { loginSchema } from './schemas'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
const apiMessage = useApiMessage()

const form = reactive({ email: '', password: '' })
const { errors, validate, validateField, clear } = useFormValidation(loginSchema, form)
const busy = ref(false)
const formError = ref('')
const needMfa = ref(false)
// Faktor kedua adalah sifat akun: daftar metode datang dari server (tidak ditebak di klien).
const mfa = reactive<{ methods: MfaMethod[]; emailMasked: string; phoneMasked: string }>({
  methods: [],
  emailMasked: '',
  phoneMasked: '',
})
const sf = ref<{ method: MfaMethod; code: string }>({ method: 'totp', code: '' })
const sendOtp = (m: OtpMethod) => sendLoginOtp(form.email.trim(), form.password, m)

const tr = (k?: string) => (k ? t(k) : undefined)

// Sesi yang putus di tengah jalan dialihkan ke sini oleh SessionGuard. Toast-nya ditampilkan di
// halaman ini, bukan di layout sebelumnya, karena layout itu sudah dilepas saat pengalihan.
onMounted(() => {
  if (!auth.sessionLost) return
  auth.ackSessionLost()
  message.warning(t('auth.sessionExpired'))
})
const withNext = (name: string) => ({
  name,
  query: route.query.next ? { next: route.query.next } : {},
})

async function submit(): Promise<void> {
  formError.value = ''
  if (!validate()) return
  busy.value = true
  try {
    await auth.login({
      email: form.email.trim(),
      password: form.password,
      ...(needMfa.value && sf.value.code.trim()
        ? { mfa_code: sf.value.code.trim(), mfa_method: sf.value.method }
        : {}),
    })
    message.success(t('auth.login.welcome', { name: auth.user?.name ?? '' }))
    await router.replace(safeNext(route.query.next, homeFor(auth.user?.role)))
  } catch (e) {
    const err = toApiError(e)
    if (err.code === 'MFA_REQUIRED') {
      needMfa.value = true
      const d = err.details as {
        methods?: MfaMethod[]
        email_masked?: string
        phone_masked?: string
      }
      mfa.methods = d.methods ?? []
      mfa.emailMasked = d.email_masked ?? ''
      mfa.phoneMasked = d.phone_masked ?? ''
      formError.value = sf.value.code ? apiMessage(err) : t('auth.login.mfaPrompt')
    } else {
      formError.value = apiMessage(err)
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="a-serif au-title">{{ t('auth.login.title') }}</h1>
    <p class="a-muted au-lead">{{ t('auth.login.lead') }}</p>

    <form class="au-form" novalidate @submit.prevent="submit">
      <p v-if="formError" class="au-err" role="alert" data-test="form-error">{{ formError }}</p>

      <AppField id="email" :label="t('auth.field.email')" :error="tr(errors.email)" required>
        <template #default="{ inputProps, invalid }">
          <IconInput
            v-model:value="form.email"
            :icon="Mail"
            placeholder=""
            size="large"
            :status="invalid ? 'error' : undefined"
            :input-props="{
              ...inputProps,
              type: 'email',
              autocomplete: 'email',
              inputmode: 'email',
            }"
            @blur="validateField('email')"
            @input="clear('email')"
          />
        </template>
      </AppField>

      <AppField
        id="password"
        :label="t('auth.field.password')"
        :error="tr(errors.password)"
        required
      >
        <template #default="{ inputProps, invalid }">
          <PasswordInput
            v-model="form.password"
            autocomplete="current-password"
            :input-props="inputProps"
            :invalid="invalid"
            @blur="validateField('password')"
          />
        </template>
      </AppField>

      <fieldset v-if="needMfa" class="au-mfa" data-test="login-mfa">
        <legend>{{ t('auth.field.mfa') }}</legend>
        <MfaCodeField
          v-model="sf"
          :methods="mfa.methods"
          :email-masked="mfa.emailMasked"
          :phone-masked="mfa.phoneMasked"
          :send="sendOtp"
        />
      </fieldset>

      <NButton
        type="primary"
        size="large"
        attr-type="submit"
        block
        :loading="busy"
        :disabled="busy"
      >
        {{ t('auth.login.submit') }}
      </NButton>
    </form>

    <p class="au-links">
      <RouterLink :to="withNext('forgot')">{{ t('auth.login.forgot') }}</RouterLink>
    </p>
    <p class="au-links a-muted">
      {{ t('auth.login.noAccount') }}
      <RouterLink :to="withNext('register')">{{ t('auth.login.toRegister') }}</RouterLink>
    </p>
  </div>
</template>
