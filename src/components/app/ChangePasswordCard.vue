<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { changePassword } from '@/api/account'
import { sendStepUp, type MfaMethod, type MfaStatus, type OtpMethod } from '@/api/mfa'
import MfaCodeField from '@/components/app/MfaCodeField.vue'
import { useApiMessage } from '@/composables/useApiMessage'

// Ganti kata sandi dari dalam akun. Selain sandi lama, akun dengan verifikasi dua langkah wajib memasukkan
// faktor keduanya (server menolak tanpa itu). Perangkat lain otomatis dikeluarkan oleh server.
const props = defineProps<{ status: MfaStatus | null }>()
const { t } = useI18n()
const message = useMessage()
const apiMessage = useApiMessage()

const current = ref('')
const next = ref('')
const again = ref('')
const sf = ref<{ method: MfaMethod; code: string }>({ method: 'totp', code: '' })
const err = ref('')
const busy = ref(false)

async function submit(): Promise<void> {
  err.value = ''
  if (!current.value || !next.value) {
    err.value = t('cpw.errBoth')
    return
  }
  if (next.value !== again.value) {
    err.value = t('cpw.errMatch')
    return
  }
  const need = !!props.status?.enabled
  if (need && !sf.value.code.trim()) {
    err.value = t('auth.reset.needCode')
    return
  }
  busy.value = true
  try {
    await changePassword(
      current.value,
      next.value,
      need ? { mfa_method: sf.value.method, mfa_code: sf.value.code.trim() } : {},
    )
    message.success(t('cpw.done'))
    current.value = next.value = again.value = ''
    sf.value = { method: sf.value.method, code: '' }
  } catch (e) {
    err.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="ac__card" novalidate data-test="change-password" @submit.prevent="submit">
    <h2 class="a-serif">{{ t('cpw.title') }}</h2>
    <p class="a-muted">{{ t('cpw.lead') }}</p>
    <div class="ac__f">
      <label for="cpw-cur">{{ t('cpw.current') }}</label>
      <input
        id="cpw-cur"
        v-model="current"
        type="password"
        autocomplete="current-password"
        data-test="cpw-current"
      />
    </div>
    <div class="ac__f">
      <label for="cpw-new">{{ t('cpw.new') }}</label>
      <input
        id="cpw-new"
        v-model="next"
        type="password"
        autocomplete="new-password"
        data-test="cpw-new"
      />
      <small class="a-muted">{{ t('auth.field.passwordHint') }}</small>
    </div>
    <div class="ac__f">
      <label for="cpw-again">{{ t('cpw.again') }}</label>
      <input
        id="cpw-again"
        v-model="again"
        type="password"
        autocomplete="new-password"
        data-test="cpw-again"
      />
    </div>
    <fieldset v-if="status?.enabled" class="cpw__mfa">
      <legend>{{ t('auth.reset.factorTitle') }}</legend>
      <MfaCodeField
        v-model="sf"
        :methods="status.methods"
        :email-masked="status.email_masked"
        :phone-masked="status.phone_masked"
        :send="(m: OtpMethod) => sendStepUp(m)"
      />
    </fieldset>
    <small v-if="err" class="cpw__err" role="alert" data-test="cpw-err">{{ err }}</small>
    <div class="ac__act">
      <button
        type="submit"
        class="a-pill a-pill--solid"
        :aria-busy="busy"
        :disabled="busy"
        data-test="cpw-submit"
      >
        {{ t('cpw.submit') }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.cpw__mfa {
  margin: 0;
  padding: 12px 16px 16px;
  border: 1px solid var(--a-line-strong);
  border-radius: 14px;
}
.cpw__mfa legend {
  padding: 0 6px;
  font-size: 13px;
  font-weight: 600;
}
.cpw__err {
  color: var(--a-danger, #b3261e);
}
</style>
