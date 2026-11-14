<script setup lang="ts">
import { Mail } from '@vicons/tabler'
import { NButton } from 'naive-ui'
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { forgotPassword } from '@/api/auth'
import IconInput from '@/components/app/IconInput.vue'
import AppField from '@/components/app/AppField.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useFormValidation } from '@/composables/useFormValidation'

import { forgotSchema } from './schemas'

const { t } = useI18n()
const apiMessage = useApiMessage()

const form = reactive({ email: '' })
const { errors, validate, validateField, clear } = useFormValidation(forgotSchema, form)
const busy = ref(false)
const sent = ref(false)
const formError = ref('')

async function submit(): Promise<void> {
  formError.value = ''
  if (!validate()) return
  busy.value = true
  try {
    await forgotPassword(form.email.trim())
    sent.value = true // BE selalu 202 agar email terdaftar tidak bisa ditebak
  } catch (e) {
    formError.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="a-serif au-title">{{ t('auth.forgot.title') }}</h1>

    <div v-if="sent" data-test="forgot-sent">
      <p class="au-ok" role="status">{{ t('auth.forgot.sent', { email: form.email.trim() }) }}</p>
      <p class="au-links">
        <RouterLink :to="{ name: 'login' }">{{ t('auth.back') }}</RouterLink>
      </p>
    </div>

    <template v-else>
      <p class="a-muted au-lead">{{ t('auth.forgot.lead') }}</p>
      <form class="au-form" novalidate @submit.prevent="submit">
        <p v-if="formError" class="au-err" role="alert" data-test="form-error">{{ formError }}</p>
        <AppField
          id="email"
          :label="t('auth.field.email')"
          :error="errors.email ? t(errors.email) : undefined"
          required
        >
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
        <NButton
          type="primary"
          size="large"
          attr-type="submit"
          block
          :loading="busy"
          :disabled="busy"
        >
          {{ t('auth.forgot.submit') }}
        </NButton>
      </form>
      <p class="au-links">
        <RouterLink :to="{ name: 'login' }">{{ t('auth.back') }}</RouterLink>
      </p>
    </template>
  </div>
</template>
