<script setup lang="ts">
import { Mail, MessageCircle } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import {
  confirmOtpEnroll,
  disableMfaMethod,
  sendStepUp,
  startOtpEnroll,
  type MfaMethod,
  type MfaStatus,
  type OtpMethod,
} from '@/api/mfa'
import MfaCodeField from '@/components/app/MfaCodeField.vue'
import { useApiMessage } from '@/composables/useApiMessage'

// Faktor kedua lewat email dan SMS. Mengaktifkan butuh bukti bahwa tujuannya benar milik pengguna (kode dikirim
// ke sana); mematikan butuh sandi + kode dari faktor yang sedang aktif. Server yang menegakkan, bukan UI ini.
const props = defineProps<{ status: MfaStatus }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const message = useMessage()
const apiMessage = useApiMessage()

type Mode = 'idle' | 'enroll' | 'disable'
const row = ref<OtpMethod | ''>('')
const mode = ref<Mode>('idle')
const code = ref('')
const sentTo = ref('')
const pw = ref('')
const sf = ref<{ method: MfaMethod; code: string }>({ method: 'totp', code: '' })
const err = ref('')
const busy = ref(false)
const codes = ref<string[]>([])

const rows = computed(() => [
  {
    m: 'email' as OtpMethod,
    icon: Mail,
    on: props.status.methods.includes('email'),
    dest: props.status.email_masked,
    ready: props.status.email_verified,
  },
  {
    m: 'sms' as OtpMethod,
    icon: MessageCircle,
    on: props.status.methods.includes('sms'),
    dest: props.status.phone_masked ?? '',
    ready: props.status.phone_verified,
  },
])

function reset(): void {
  row.value = ''
  mode.value = 'idle'
  code.value = pw.value = err.value = sentTo.value = ''
  sf.value = { method: 'totp', code: '' }
}

async function startEnroll(m: OtpMethod): Promise<void> {
  reset()
  busy.value = true
  try {
    const r = await startOtpEnroll(m)
    row.value = m
    mode.value = 'enroll'
    sentTo.value = r.to
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
async function confirm(): Promise<void> {
  err.value = ''
  if (!/^\d{6}$/.test(code.value.trim())) {
    err.value = t('sec.errCode')
    return
  }
  busy.value = true
  try {
    codes.value = await confirmOtpEnroll(row.value as OtpMethod, code.value.trim())
    message.success(t('otp.on'))
    reset()
    emit('changed')
  } catch (e) {
    err.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
function openDisable(m: OtpMethod): void {
  reset()
  row.value = m
  mode.value = 'disable'
}
async function disable(): Promise<void> {
  err.value = ''
  if (!pw.value || !sf.value.code.trim()) {
    err.value = t('sec.errBoth')
    return
  }
  busy.value = true
  try {
    await disableMfaMethod(row.value as OtpMethod, pw.value, sf.value.code.trim(), sf.value.method)
    message.success(t('otp.off'))
    reset()
    emit('changed')
  } catch (e) {
    err.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
async function copyCodes(): Promise<void> {
  try {
    await navigator.clipboard.writeText(codes.value.join('\n'))
    message.success(t('sec.copied'))
  } catch {
    message.error(t('tk.copyFail'))
  }
}
</script>

<template>
  <section class="ac__card" data-test="otp-methods">
    <h2 class="a-serif">{{ t('otp.title') }}</h2>
    <p class="a-muted">{{ t('otp.lead') }}</p>

    <ul class="otp__list">
      <li v-for="r in rows" :key="r.m" :data-method="r.m" :data-on="r.on">
        <div class="otp__row">
          <NIcon :component="r.icon" :size="22" aria-hidden="true" />
          <span class="otp__txt">
            <strong>{{ t(`mf.m.${r.m}`) }}</strong>
            <small class="a-muted">{{ r.dest || (r.m === 'sms' ? t('otp.noPhone') : '') }}</small>
          </span>
          <span class="ac__badge" :class="r.on ? 'is-paid' : 'is-pending'">{{
            r.on ? t('sec.on') : t('sec.off')
          }}</span>
          <button
            v-if="!r.on && r.ready"
            type="button"
            class="a-pill a-pill--sm a-pill--solid"
            :disabled="busy"
            :data-test="`otp-enable-${r.m}`"
            @click="startEnroll(r.m)"
          >
            {{ t('otp.enable') }}
          </button>
          <RouterLink
            v-else-if="!r.on && r.m === 'sms'"
            :to="{ name: 'verify-phone' }"
            class="a-pill a-pill--sm"
            >{{ t('otp.verifyPhone') }}</RouterLink
          >
          <small v-else-if="!r.on" class="a-muted">{{ t('otp.verifyEmail') }}</small>
          <button
            v-if="r.on"
            type="button"
            class="a-pill a-pill--sm"
            :data-test="`otp-disable-${r.m}`"
            @click="openDisable(r.m)"
          >
            {{ t('sec.disable') }}
          </button>
        </div>

        <div v-if="row === r.m && mode === 'enroll'" class="otp__form" data-test="otp-enroll">
          <p class="a-muted" role="status">{{ t('mf.sent', { to: sentTo }) }}</p>
          <label :for="`otp-code-${r.m}`">{{ t('mf.hintOtp') }}</label>
          <input
            :id="`otp-code-${r.m}`"
            v-model="code"
            inputmode="numeric"
            maxlength="6"
            autocomplete="one-time-code"
            data-test="otp-code"
          />
          <small v-if="err" class="otp__err" role="alert">{{ err }}</small>
          <div class="ac__act">
            <button
              type="button"
              class="a-pill a-pill--solid"
              :aria-busy="busy"
              :disabled="busy"
              data-test="otp-confirm"
              @click="confirm"
            >
              {{ t('sec.confirm') }}
            </button>
            <button type="button" class="a-pill a-pill--ghost" @click="reset">
              {{ t('acct.cancel') }}
            </button>
          </div>
        </div>

        <div v-if="row === r.m && mode === 'disable'" class="otp__form" data-test="otp-disable">
          <label :for="`otp-pw-${r.m}`">{{ t('acct.password') }}</label>
          <input
            :id="`otp-pw-${r.m}`"
            v-model="pw"
            type="password"
            autocomplete="current-password"
            data-test="otp-pw"
          />
          <MfaCodeField
            v-model="sf"
            :methods="status.methods"
            :email-masked="status.email_masked"
            :phone-masked="status.phone_masked"
            :send="(m: OtpMethod) => sendStepUp(m)"
          />
          <small v-if="err" class="otp__err" role="alert">{{ err }}</small>
          <div class="ac__act">
            <button
              type="button"
              class="a-pill a-pill--solid"
              :aria-busy="busy"
              :disabled="busy"
              data-test="otp-disable-go"
              @click="disable"
            >
              {{ t('sec.disable') }}
            </button>
            <button type="button" class="a-pill a-pill--ghost" @click="reset">
              {{ t('acct.cancel') }}
            </button>
          </div>
        </div>
      </li>
    </ul>

    <div v-if="codes.length" class="otp__codes" data-test="otp-recovery">
      <p>
        <strong>{{ t('sec.codesTitle') }}</strong> {{ t('sec.codesBody') }}
      </p>
      <ul>
        <li v-for="c in codes" :key="c">
          <code>{{ c }}</code>
        </li>
      </ul>
      <div class="ac__act">
        <button type="button" class="a-pill a-pill--solid" @click="copyCodes">
          {{ t('sec.copyCodes') }}
        </button>
        <button type="button" class="a-pill" @click="codes = []">{{ t('sec.saved') }}</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.otp__list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.otp__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.otp__txt {
  display: grid;
  gap: 2px;
  margin-right: auto;
  min-width: 0;
}
.otp__form {
  display: grid;
  gap: 10px;
  max-width: 380px;
  margin-top: 12px;
  padding: 14px 16px;
  border: 1px solid var(--a-line);
  border-radius: 14px;
}
.otp__form label {
  font-size: 14px;
  font-weight: 600;
}
.otp__form input {
  min-height: 48px;
  padding: 0 16px;
  border: 1px solid var(--a-line-strong);
  border-radius: 12px;
  background: var(--a-panel);
  color: var(--a-ink);
  font: inherit;
  letter-spacing: 0.12em;
}
.otp__form input:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 2px;
}
.otp__err {
  color: var(--a-danger, #b3261e);
}
.otp__codes {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--a-line-strong);
}
.otp__codes ul {
  list-style: none;
  margin: 10px 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.otp__codes code {
  display: block;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--a-bg3);
  letter-spacing: 0.08em;
  text-align: center;
}
</style>
