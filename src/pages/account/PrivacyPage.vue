<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import {
  deleteAccount,
  getConsents,
  listExports,
  listPrivacyRequests,
  requestExport,
  type Consent,
  type PendingDoc,
  type PrivacyExport,
  type PrivacyRequest,
} from '@/api/me'
import { getMfaStatus, sendStepUp, type MfaMethod, type MfaStatus, type OtpMethod } from '@/api/mfa'
import MfaCodeField from '@/components/app/MfaCodeField.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import './accountStyle.css'

const { t, locale } = useI18n()
useHead({ title: computed(() => t('acct.nav_.privacy')) })
const message = useMessage()
const apiMessage = useApiMessage()
const day = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'id-ID', {
        dateStyle: 'medium',
      }).format(new Date(iso))
    : '—'

const accepted = ref<Consent[]>([])
const pending = ref<PendingDoc[]>([])
const exports = ref<PrivacyExport[]>([])
const requests = ref<PrivacyRequest[]>([])
const err = ref('')
async function load(): Promise<void> {
  try {
    const [c, e, r] = await Promise.all([getConsents(), listExports(), listPrivacyRequests()])
    accepted.value = c.accepted
    pending.value = c.pending
    exports.value = e
    requests.value = r
    err.value = ''
  } catch (e) {
    err.value = apiMessage(e)
  }
}
onMounted(load)

const expBusy = ref(false)
async function askExport(): Promise<void> {
  expBusy.value = true
  try {
    await requestExport()
    message.success(t('pv.exportAsked'))
    await load()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    expBusy.value = false
  }
}

const delOpen = ref(false)
const pw = ref('')
const reason = ref('')
const sure = ref(false)
const delErr = ref('')
// Hapus akun = tindakan paling sensitif: akun dengan verifikasi dua langkah wajib faktor keduanya.
const mfaStatus = ref<MfaStatus | null>(null)
const delSf = ref<{ method: MfaMethod; code: string }>({ method: 'totp', code: '' })
onMounted(async () => {
  try {
    mfaStatus.value = await getMfaStatus()
  } catch {
    mfaStatus.value = null
  }
})
const delBusy = ref(false)
const deletion = computed(() =>
  requests.value.find(
    (r) => r.kind === 'delete' && !['done', 'rejected', 'completed'].includes(r.status),
  ),
)
async function askDelete(): Promise<void> {
  delErr.value = ''
  if (!pw.value) return void (delErr.value = t('sec.errPw'))
  if (!sure.value) return void (delErr.value = t('pv.errSure'))
  delBusy.value = true
  try {
    const need = !!mfaStatus.value?.enabled
    if (need && !delSf.value.code.trim()) return void (delErr.value = t('auth.reset.needCode'))
    await deleteAccount(
      pw.value,
      reason.value.trim() || undefined,
      need ? { mfa_method: delSf.value.method, mfa_code: delSf.value.code.trim() } : {},
    )
    message.success(t('pv.delAsked'))
    delOpen.value = false
    pw.value = reason.value = ''
    sure.value = false
    await load()
  } catch (e) {
    delErr.value = apiMessage(e)
  } finally {
    delBusy.value = false
  }
}
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('acct.nav_.privacy') }}</h1>
    <p v-if="err" class="pv__err" role="alert">{{ err }}</p>

    <section class="ac__card" data-test="consents">
      <h2 class="a-serif">{{ t('pv.consentTitle') }}</h2>
      <ul v-if="pending.length" class="ac__list">
        <li v-for="p in pending" :key="p.id" class="ac__row is-hot">
          <span class="ac__main"
            ><strong>{{ p.title }}</strong
            ><small class="a-muted">{{ t('pv.pending', { v: p.version }) }}</small></span
          >
        </li>
      </ul>
      <ul class="ac__list">
        <li v-for="c in accepted" :key="c.id" class="ac__row">
          <span class="ac__main">
            <strong>{{ c.title }}</strong>
            <small class="a-muted">{{
              t('pv.acceptedAt', { v: c.version, d: day(c.accepted_at) })
            }}</small>
          </span>
        </li>
      </ul>
      <p v-if="!accepted.length && !pending.length" class="a-muted">{{ t('pv.noConsent') }}</p>
    </section>

    <section class="ac__card" data-test="export">
      <h2 class="a-serif">{{ t('pv.exportTitle') }}</h2>
      <p class="a-muted">{{ t('pv.exportBody') }}</p>
      <ul v-if="exports.length" class="ac__list">
        <li v-for="x in exports" :key="x.id" class="ac__row">
          <span class="ac__main">
            <strong>{{ t('pv.exportRow', { d: day(x.created_at) }) }}</strong>
            <small class="a-muted"
              >{{ t(`pv.st.${x.status}`, x.status)
              }}<template v-if="x.expires_at">
                · {{ t('pv.until', { d: day(x.expires_at) }) }}</template
              ></small
            >
          </span>
          <a v-if="x.url" class="a-pill a-pill--solid" :href="x.url" download>{{
            t('pv.download')
          }}</a>
        </li>
      </ul>
      <div class="ac__act">
        <button
          type="button"
          class="a-pill a-pill--solid"
          :disabled="expBusy"
          data-test="export-ask"
          @click="askExport"
        >
          {{ t('pv.exportCta') }}
        </button>
      </div>
    </section>

    <section class="ac__card" data-test="complaint">
      <h2 class="a-serif">{{ t('pv.complaintTitle') }}</h2>
      <p class="a-muted">{{ t('pv.complaintBody') }}</p>
      <RouterLink :to="{ name: 'privacy-complaint' }" class="a-pill" data-test="open-complaint">{{
        t('pv.complaintBtn')
      }}</RouterLink>
    </section>

    <section class="ac__card pv__danger" data-test="delete">
      <h2 class="a-serif">{{ t('pv.delTitle') }}</h2>
      <p class="a-muted">{{ t('pv.delBody') }}</p>
      <p v-if="deletion" class="ac__badge is-pending" role="status">
        {{ t('pv.delOpen', { d: day(deletion.due_at) }) }}
      </p>
      <template v-else>
        <div v-if="!delOpen" class="ac__act">
          <button type="button" class="a-pill" data-test="delete-open" @click="delOpen = true">
            {{ t('pv.delCta') }}
          </button>
        </div>
        <form v-else class="pv__form" novalidate @submit.prevent="askDelete">
          <div class="ac__f">
            <label for="del-pw">{{ t('acct.password') }}</label>
            <input
              id="del-pw"
              v-model="pw"
              type="password"
              autocomplete="current-password"
              data-test="delete-pw"
            />
          </div>
          <div class="ac__f">
            <label for="del-why">{{ t('pv.delWhy') }}</label>
            <input id="del-why" v-model="reason" maxlength="500" />
          </div>
          <MfaCodeField
            v-if="mfaStatus?.enabled"
            v-model="delSf"
            :methods="mfaStatus.methods"
            :email-masked="mfaStatus.email_masked"
            :phone-masked="mfaStatus.phone_masked"
            :send="(m: OtpMethod) => sendStepUp(m)"
          />
          <label class="pv__sure"
            ><input v-model="sure" type="checkbox" data-test="delete-sure" />
            <span>{{ t('pv.delSure') }}</span></label
          >
          <small class="pv__err" role="alert">{{ delErr }}</small>
          <div class="ac__act">
            <button
              type="submit"
              class="a-pill a-pill--solid"
              :disabled="delBusy"
              data-test="delete-submit"
            >
              {{ t('pv.delSubmit') }}
            </button>
            <button type="button" class="a-pill" @click="delOpen = false">
              {{ t('acct.cancel') }}
            </button>
          </div>
        </form>
      </template>
    </section>
  </div>
</template>

<style scoped>
.pv__form {
  display: grid;
  gap: 10px;
  max-width: 420px;
}
.pv__sure {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.pv__sure input {
  margin-top: 3px;
  width: 18px;
  height: 18px;
  accent-color: var(--a-gold);
}
.pv__err {
  color: var(--a-danger);
  font-size: 13px;
  min-height: 16px;
}
.pv__danger {
  border-color: var(--a-danger);
}
</style>
