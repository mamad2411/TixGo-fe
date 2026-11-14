<script setup lang="ts">
import { DeviceMobile, Key } from '@vicons/tabler'
import { NButton } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { sendPhoneOtp, verifyPhoneOtp } from '@/api/auth'
import { toApiError } from '@/api/errors'
import AuthSteps from '@/components/app/AuthSteps.vue'
import IconInput from '@/components/app/IconInput.vue'
import AppField from '@/components/app/AppField.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useCooldown } from '@/composables/useCooldown'
import { useFormValidation } from '@/composables/useFormValidation'
import { safeNext } from '@/router/next'
import { useAuthStore } from '@/stores/auth'

import { otpSchema, phoneSchema } from './schemas'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const apiMessage = useApiMessage()
const cooldown = useCooldown()

const step = ref<'phone' | 'code'>('phone')
const phoneForm = reactive({ phone: '' })
const codeForm = reactive({ code: '' })
const pv = useFormValidation(phoneSchema, phoneForm)
const cv = useFormValidation(otpSchema, codeForm)
const busy = ref(false)
const formError = ref('')
const expiresIn = ref(300)

const next = computed(() => safeNext(route.query.next))

onMounted(async () => {
  if (auth.phoneVerified) await router.replace(next.value)
})

async function sendCode(): Promise<void> {
  formError.value = ''
  if (!pv.validate()) return
  busy.value = true
  try {
    const r = await sendPhoneOtp(phoneForm.phone.trim())
    expiresIn.value = r.expires_in
    step.value = 'code'
    cooldown.start(60)
  } catch (e) {
    const err = toApiError(e)
    formError.value = apiMessage(err)
    if (err.retryAfter) cooldown.start(err.retryAfter)
  } finally {
    busy.value = false
  }
}

async function confirm(): Promise<void> {
  formError.value = ''
  if (!cv.validate()) return
  busy.value = true
  try {
    await verifyPhoneOtp(codeForm.code)
    await auth.reloadMe()
    await router.replace(next.value)
  } catch (e) {
    formError.value = apiMessage(e)
    codeForm.code = ''
  } finally {
    busy.value = false
  }
}

function changeNumber(): void {
  step.value = 'phone'
  formError.value = ''
  codeForm.code = ''
}
</script>

<template>
  <div>
    <AuthSteps :current="3" />
    <h1 class="a-serif au-title">{{ t('auth.phone.title') }}</h1>

    <form v-if="step === 'phone'" class="au-form" novalidate @submit.prevent="sendCode">
      <p class="a-muted au-lead">{{ t('auth.phone.lead') }}</p>
      <p v-if="formError" class="au-err" role="alert" data-test="form-error">{{ formError }}</p>
      <AppField
        id="phone"
        :label="t('auth.field.phone')"
        :hint="t('auth.field.phoneHint')"
        :error="pv.errors.value.phone ? t(pv.errors.value.phone) : undefined"
        required
      >
        <template #default="{ inputProps, invalid }">
          <IconInput
            v-model:value="phoneForm.phone"
            :icon="DeviceMobile"
            placeholder=""
            size="large"
            :status="invalid ? 'error' : undefined"
            :input-props="{ ...inputProps, type: 'tel', autocomplete: 'tel', inputmode: 'tel' }"
            @blur="pv.validateField('phone')"
            @input="pv.clear('phone')"
          />
        </template>
      </AppField>
      <NButton
        type="primary"
        size="large"
        attr-type="submit"
        block
        :loading="busy"
        :disabled="busy || cooldown.left.value > 0"
      >
        {{
          cooldown.left.value > 0
            ? t('auth.phone.waitIn', { s: cooldown.left.value })
            : t('auth.phone.send')
        }}
      </NButton>
    </form>

    <form v-else class="au-form" novalidate data-test="otp-step" @submit.prevent="confirm">
      <p class="a-muted au-lead">
        {{
          t('auth.phone.sentTo', { phone: phoneForm.phone.trim(), m: Math.round(expiresIn / 60) })
        }}
      </p>
      <p v-if="formError" class="au-err" role="alert" data-test="form-error">{{ formError }}</p>
      <AppField
        id="code"
        :label="t('auth.field.code')"
        :error="cv.errors.value.code ? t(cv.errors.value.code) : undefined"
        required
      >
        <template #default="{ inputProps, invalid }">
          <IconInput
            v-model:value="codeForm.code"
            :icon="Key"
            placeholder=""
            size="large"
            :maxlength="6"
            :status="invalid ? 'error' : undefined"
            :input-props="{
              ...inputProps,
              autocomplete: 'one-time-code',
              inputmode: 'numeric',
              pattern: '[0-9]*',
            }"
            @blur="cv.validateField('code')"
            @input="cv.clear('code')"
          />
        </template>
      </AppField>
      <NButton
        type="primary"
        size="large"
        attr-type="submit"
        block
        :loading="busy"
        :disabled="busy"
      >
        {{ t('auth.phone.verify') }}
      </NButton>
      <div class="vp__row">
        <NButton quaternary :disabled="busy || cooldown.left.value > 0" @click="sendCode">
          {{
            cooldown.left.value > 0
              ? t('auth.phone.resendIn', { s: cooldown.left.value })
              : t('auth.phone.resend')
          }}
        </NButton>
        <NButton quaternary @click="changeNumber">{{ t('auth.phone.change') }}</NButton>
      </div>
    </form>

    <p class="au-links a-muted">
      <RouterLink :to="{ name: 'events' }">{{ t('auth.email.later') }}</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.vp__row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
</style>
