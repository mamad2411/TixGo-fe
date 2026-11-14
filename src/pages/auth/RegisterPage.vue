<script setup lang="ts">
import { Mail, User } from '@vicons/tabler'
import { NButton, NCheckbox, useMessage } from 'naive-ui'
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import AppField from '@/components/app/AppField.vue'
import AuthSteps from '@/components/app/AuthSteps.vue'
import IconInput from '@/components/app/IconInput.vue'
import PasswordInput from '@/components/app/PasswordInput.vue'
import PasswordMeter from '@/components/app/PasswordMeter.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useFormValidation } from '@/composables/useFormValidation'
import { useAuthStore } from '@/stores/auth'

import { registerSchema } from './schemas'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
const apiMessage = useApiMessage()

const form = reactive({ name: '', email: '', password: '', accept_terms: false })
const { errors, validate, validateField, clear } = useFormValidation(registerSchema, form)
const busy = ref(false)
const formError = ref('')
const tr = (k?: string) => (k ? t(k) : undefined)

async function submit(): Promise<void> {
  formError.value = ''
  if (!validate()) return
  busy.value = true
  try {
    await auth.register({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      accept_terms: true,
      locale: locale.value === 'en' ? 'en' : 'id',
    })
    message.success(t('auth.register.created'))
    // Langkah berikutnya: verifikasi email (tautan dikirim BE saat registrasi).
    await router.replace({
      name: 'verify-email',
      query: route.query.next ? { next: route.query.next } : {},
    })
  } catch (e) {
    formError.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <AuthSteps :current="1" />
    <h1 class="a-serif au-title">{{ t('auth.register.title') }}</h1>
    <p class="a-muted au-lead">{{ t('auth.register.lead') }}</p>

    <form class="au-form" novalidate @submit.prevent="submit">
      <p v-if="formError" class="au-err" role="alert" data-test="form-error">{{ formError }}</p>

      <AppField id="name" :label="t('auth.field.name')" :error="tr(errors.name)" required>
        <template #default="{ inputProps, invalid }">
          <IconInput
            v-model:value="form.name"
            :icon="User"
            placeholder=""
            size="large"
            :status="invalid ? 'error' : undefined"
            :input-props="{ ...inputProps, autocomplete: 'name', maxlength: 100 }"
            @blur="validateField('name')"
            @input="clear('name')"
          />
        </template>
      </AppField>

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
        :hint="t('auth.field.passwordHint')"
        :error="tr(errors.password)"
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
          <PasswordMeter :password="form.password" />
        </template>
      </AppField>

      <div class="terms">
        <NCheckbox
          v-model:checked="form.accept_terms"
          :input-props="{
            id: 'terms',
            'aria-describedby': errors.accept_terms ? 'terms-err' : undefined,
          }"
          @update:checked="clear('accept_terms')"
        >
          {{ t('auth.register.terms') }}
        </NCheckbox>
        <p v-if="errors.accept_terms" id="terms-err" class="terms__err" aria-live="polite">
          {{ t(errors.accept_terms) }}
        </p>
      </div>

      <NButton
        type="primary"
        size="large"
        attr-type="submit"
        block
        :loading="busy"
        :disabled="busy"
      >
        {{ t('auth.register.submit') }}
      </NButton>
    </form>

    <p class="au-links a-muted">
      {{ t('auth.register.haveAccount') }}
      <RouterLink
        :to="{ name: 'login', query: route.query.next ? { next: route.query.next } : {} }"
      >
        {{ t('auth.register.toLogin') }}
      </RouterLink>
    </p>
  </div>
</template>

<style scoped>
.terms__err {
  margin-top: 6px;
  font-size: 13px;
  color: var(--a-danger);
}
</style>
