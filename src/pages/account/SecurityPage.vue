<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { DeviceDesktop, ShieldCheck } from '@vicons/tabler'
import { NIcon, useDialog, useMessage } from 'naive-ui'
import QRCode from 'qrcode'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { getMfaStatus, sendStepUp, type MfaMethod, type MfaStatus, type OtpMethod } from '@/api/mfa'
import {
  listDevices,
  logoutAll,
  mfaConfirm,
  mfaDisable,
  mfaRecovery,
  mfaSetup,
  requestEmailChange,
  revokeDevice,
  type Device,
  type MfaSetup,
} from '@/api/me'
import ChangePasswordCard from '@/components/app/ChangePasswordCard.vue'
import MfaCodeField from '@/components/app/MfaCodeField.vue'
import OtpMethods from '@/components/app/OtpMethods.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useAuthStore } from '@/stores/auth'
import './accountStyle.css'

const { t, locale } = useI18n()
useHead({ title: computed(() => t('acct.nav_.security')) })
const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const apiMessage = useApiMessage()
const when = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso))
    : '—'

// ---- perangkat ----
const devices = ref<Device[]>([])
const devErr = ref('')
async function loadDevices(): Promise<void> {
  try {
    devices.value = await listDevices()
    devErr.value = ''
  } catch (e) {
    devErr.value = apiMessage(e)
  }
}
onMounted(loadDevices)
async function revoke(d: Device): Promise<void> {
  try {
    await revokeDevice(d.session_id)
    devices.value = devices.value.filter((x) => x.session_id !== d.session_id)
    message.success(t('sec.revoked'))
  } catch (e) {
    message.error(apiMessage(e))
  }
}
function askLogoutAll(): void {
  dialog.warning({
    title: t('sec.allTitle'),
    content: t('sec.allBody'),
    positiveText: t('sec.allYes'),
    negativeText: t('acct.cancel'),
    onPositiveClick: async () => {
      try {
        await logoutAll()
        location.assign('/masuk')
      } catch (e) {
        message.error(apiMessage(e))
      }
    },
  })
}

// ---- status verifikasi berlapis (sumber kebenaran: server) ----
const mfaStatus = ref<MfaStatus | null>(null)
async function loadStatus(): Promise<void> {
  try {
    mfaStatus.value = await getMfaStatus()
  } catch {
    mfaStatus.value = null
  }
}
async function statusChanged(): Promise<void> {
  await Promise.all([loadStatus(), auth.reloadMe()])
}
onMounted(loadStatus)
const totpOn = computed(() => !!mfaStatus.value?.methods.includes('totp'))
const anyOn = computed(() => !!mfaStatus.value?.enabled)

// ---- 2FA (TOTP) ----
type Step = 'idle' | 'scan' | 'codes' | 'disable' | 'regen'
const step = ref<Step>('idle')
const setup = ref<MfaSetup | null>(null)
const qr = ref('')
const code = ref('')
const pw = ref('')
const codes = ref<string[]>([])
const mfaErr = ref('')
const busy = ref(false)
function reset(s: Step = 'idle'): void {
  step.value = s
  code.value = pw.value = mfaErr.value = ''
}
async function startSetup(): Promise<void> {
  busy.value = true
  try {
    setup.value = await mfaSetup()
    qr.value = await QRCode.toDataURL(setup.value.provisioning_uri, { margin: 1, width: 220 })
    reset('scan')
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
async function confirm(): Promise<void> {
  mfaErr.value = ''
  if (!/^\d{6}$/.test(code.value.trim())) return void (mfaErr.value = t('sec.errCode'))
  busy.value = true
  try {
    codes.value = await mfaConfirm(code.value.trim())
    await statusChanged()
    reset('codes')
    message.success(t('sec.mfaOn'))
  } catch (e) {
    mfaErr.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
async function disable(): Promise<void> {
  mfaErr.value = ''
  if (!pw.value || !code.value.trim()) return void (mfaErr.value = t('sec.errBoth'))
  busy.value = true
  try {
    await mfaDisable(pw.value, code.value.trim())
    await statusChanged()
    reset()
    message.success(t('sec.mfaOff'))
  } catch (e) {
    mfaErr.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
async function regen(): Promise<void> {
  mfaErr.value = ''
  if (!pw.value) return void (mfaErr.value = t('sec.errPw'))
  busy.value = true
  try {
    codes.value = await mfaRecovery(pw.value)
    reset('codes')
  } catch (e) {
    mfaErr.value = apiMessage(e)
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

// ---- ganti email ----
const newMail = ref('')
const mailPw = ref('')
const mailErr = ref('')
const mailBusy = ref(false)
const mailSf = ref<{ method: MfaMethod; code: string }>({ method: 'totp', code: '' })
async function changeEmail(): Promise<void> {
  mailErr.value = ''
  if (!/^\S+@\S+\.\S+$/.test(newMail.value.trim())) return void (mailErr.value = t('tk.errEmail'))
  if (!mailPw.value) return void (mailErr.value = t('sec.errPw'))
  mailBusy.value = true
  try {
    const need = anyOn.value
    if (need && !mailSf.value.code.trim()) return void (mailErr.value = t('auth.reset.needCode'))
    await requestEmailChange(
      newMail.value.trim(),
      mailPw.value,
      need ? { mfa_method: mailSf.value.method, mfa_code: mailSf.value.code.trim() } : {},
    )
    message.success(t('sec.mailSent', { e: newMail.value.trim() }))
    newMail.value = mailPw.value = ''
  } catch (e) {
    mailErr.value = apiMessage(e)
  } finally {
    mailBusy.value = false
  }
}
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('acct.nav_.security') }}</h1>

    <section class="ac__card" data-test="mfa">
      <h2 class="a-serif">
        <NIcon :component="ShieldCheck" :size="22" aria-hidden="true" /> {{ t('sec.mfaTitle') }}
      </h2>
      <p class="a-muted">{{ t('sec.mfaBody') }}</p>
      <p>
        <span class="ac__badge" :class="totpOn ? 'is-paid' : 'is-pending'">
          {{ totpOn ? t('sec.on') : t('sec.off') }}
        </span>
      </p>

      <div v-if="step === 'idle'" class="ac__act">
        <button
          v-if="!totpOn"
          type="button"
          class="a-pill a-pill--solid"
          :disabled="busy"
          data-test="mfa-start"
          @click="startSetup"
        >
          {{ t('sec.enable') }}
        </button>
        <template v-else>
          <button
            type="button"
            class="a-pill"
            data-test="mfa-disable-open"
            @click="reset('disable')"
          >
            {{ t('sec.disable') }}
          </button>
        </template>
        <button
          v-if="anyOn"
          type="button"
          class="a-pill"
          data-test="mfa-regen-open"
          @click="reset('regen')"
        >
          {{ t('sec.regen') }}
        </button>
      </div>

      <div v-else-if="step === 'scan' && setup" class="sec__scan">
        <img :src="qr" :alt="t('sec.qrAlt')" width="220" height="220" />
        <div class="sec__scanTxt">
          <p>{{ t('sec.scan1') }}</p>
          <p class="a-muted">
            {{ t('sec.manual') }} <code data-test="mfa-secret">{{ setup.secret }}</code>
          </p>
          <div class="ac__f">
            <label for="mfa-code">{{ t('sec.code6') }}</label>
            <input
              id="mfa-code"
              v-model="code"
              inputmode="numeric"
              maxlength="6"
              autocomplete="one-time-code"
              data-test="mfa-code"
            />
            <small role="alert">{{ mfaErr }}</small>
          </div>
          <div class="ac__act">
            <button
              type="button"
              class="a-pill a-pill--solid"
              :disabled="busy"
              data-test="mfa-confirm"
              @click="confirm"
            >
              {{ t('sec.confirm') }}
            </button>
            <button type="button" class="a-pill" @click="reset()">{{ t('acct.cancel') }}</button>
          </div>
        </div>
      </div>

      <div v-else-if="step === 'codes'" data-test="recovery">
        <p>
          <strong>{{ t('sec.codesTitle') }}</strong> {{ t('sec.codesBody') }}
        </p>
        <ul class="sec__codes">
          <li v-for="c in codes" :key="c">
            <code>{{ c }}</code>
          </li>
        </ul>
        <div class="ac__act">
          <button type="button" class="a-pill a-pill--solid" @click="copyCodes">
            {{ t('sec.copyCodes') }}
          </button>
          <button type="button" class="a-pill" @click="reset()">{{ t('sec.saved') }}</button>
        </div>
      </div>

      <div v-else-if="step === 'disable' || step === 'regen'" class="sec__form">
        <div class="ac__f">
          <label for="mfa-pw">{{ t('acct.password') }}</label>
          <input id="mfa-pw" v-model="pw" type="password" autocomplete="current-password" />
        </div>
        <div v-if="step === 'disable'" class="ac__f">
          <label for="mfa-code2">{{ t('sec.codeAny') }}</label>
          <input id="mfa-code2" v-model="code" autocomplete="one-time-code" />
        </div>
        <small class="sec__err" role="alert">{{ mfaErr }}</small>
        <div class="ac__act">
          <button
            type="button"
            class="a-pill a-pill--solid"
            :disabled="busy"
            @click="step === 'disable' ? disable() : regen()"
          >
            {{ step === 'disable' ? t('sec.disable') : t('sec.regen') }}
          </button>
          <button type="button" class="a-pill" @click="reset()">{{ t('acct.cancel') }}</button>
        </div>
      </div>
    </section>

    <OtpMethods v-if="mfaStatus" :status="mfaStatus" @changed="statusChanged" />

    <ChangePasswordCard :status="mfaStatus" />

    <section class="ac__card" data-test="devices">
      <h2 class="a-serif">
        <NIcon :component="DeviceDesktop" :size="22" aria-hidden="true" /> {{ t('sec.devTitle') }}
      </h2>
      <p v-if="devErr" class="sec__err" role="alert">{{ devErr }}</p>
      <ul class="ac__list">
        <li v-for="d in devices" :key="d.session_id" class="ac__row">
          <span class="ac__main">
            <strong>{{ d.label || t('sec.unknownDevice') }}</strong>
            <small class="a-muted"
              >{{ d.ip }} ·
              {{ t('sec.lastSeen', { d: when(d.last_seen_at ?? d.created_at) }) }}</small
            >
          </span>
          <span v-if="d.current" class="ac__badge is-paid">{{ t('sec.thisDevice') }}</span>
          <button
            v-else
            type="button"
            class="a-pill"
            :aria-label="t('sec.revokeFor', { n: d.label })"
            @click="revoke(d)"
          >
            {{ t('sec.revoke') }}
          </button>
        </li>
      </ul>
      <div class="ac__act">
        <button type="button" class="a-pill" data-test="logout-all" @click="askLogoutAll">
          {{ t('sec.allCta') }}
        </button>
      </div>
    </section>

    <form class="ac__card" novalidate @submit.prevent="changeEmail">
      <h2 class="a-serif">{{ t('sec.mailTitle') }}</h2>
      <p class="a-muted">{{ t('sec.mailBody', { e: auth.user?.email }) }}</p>
      <div class="ac__f">
        <label for="mail-new">{{ t('sec.mailNew') }}</label>
        <input
          id="mail-new"
          v-model="newMail"
          type="email"
          autocomplete="email"
          data-test="mail-new"
        />
      </div>
      <div class="ac__f">
        <label for="mail-pw">{{ t('acct.password') }}</label>
        <input id="mail-pw" v-model="mailPw" type="password" autocomplete="current-password" />
        <small role="alert">{{ mailErr }}</small>
      </div>
      <MfaCodeField
        v-if="mfaStatus?.enabled"
        v-model="mailSf"
        :methods="mfaStatus.methods"
        :email-masked="mfaStatus.email_masked"
        :phone-masked="mfaStatus.phone_masked"
        :send="(m: OtpMethod) => sendStepUp(m)"
      />
      <div class="ac__act">
        <button
          type="submit"
          class="a-pill a-pill--solid"
          :disabled="mailBusy"
          data-test="mail-submit"
        >
          {{ t('sec.mailCta') }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.sec__scan {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}
@media (min-width: 640px) {
  .sec__scan {
    grid-template-columns: 220px minmax(0, 1fr);
  }
}
.sec__scan img {
  background: #fff;
  padding: 8px;
  border-radius: 12px;
}
.sec__scanTxt {
  display: grid;
  gap: 10px;
}
.sec__scanTxt p {
  margin: 0;
}
.sec__scanTxt code {
  overflow-wrap: anywhere;
  letter-spacing: 0.06em;
}
.sec__codes {
  list-style: none;
  margin: 10px 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.sec__codes code {
  display: block;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--a-bg3);
  letter-spacing: 0.08em;
  text-align: center;
}
.sec__form {
  display: grid;
  gap: 10px;
  max-width: 360px;
}
.sec__err {
  color: var(--a-danger);
  font-size: 13px;
  min-height: 16px;
}
h2 :deep(svg) {
  vertical-align: -3px;
  margin-right: 6px;
}
</style>
