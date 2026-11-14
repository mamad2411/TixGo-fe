<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MfaMethod, OtpMethod } from '@/api/mfa'
import { useApiMessage } from '@/composables/useApiMessage'
import { useCooldown } from '@/composables/useCooldown'

// Pemilih + isian faktor kedua yang dipakai di login, reset sandi, dan aksi sensitif. Komponen ini hanya tahu
// CARA meminta kode (prop `send`); keputusan boleh/tidaknya tetap di server.
const props = defineProps<{
  methods: MfaMethod[]
  emailMasked?: string
  phoneMasked?: string
  /** Mengirim OTP untuk metode email/sms (login, reset, atau step-up). Melempar galat BE bila gagal. */
  send: (m: OtpMethod) => Promise<unknown>
}>()
const model = defineModel<{ method: MfaMethod; code: string }>({ required: true })
const { t } = useI18n()
const apiMessage = useApiMessage()
const { left, start } = useCooldown()

const usable = computed<MfaMethod[]>(() => (props.methods.length ? props.methods : ['totp']))
const sentTo = ref('')
const busy = ref(false)
const err = ref('')

// Metode awal = yang pertama tersedia; bila daftar berubah dan pilihan lama hilang, pilih ulang.
watch(
  usable,
  (list) => {
    if (!list.includes(model.value.method)) model.value = { method: list[0]!, code: '' }
  },
  { immediate: true },
)

function pick(m: MfaMethod): void {
  model.value = { method: m, code: '' }
  sentTo.value = ''
  err.value = ''
}
const isOtp = computed(() => model.value.method === 'email' || model.value.method === 'sms')
const target = computed(() =>
  model.value.method === 'sms' ? (props.phoneMasked ?? '') : (props.emailMasked ?? ''),
)

async function sendCode(): Promise<void> {
  if (!isOtp.value || left.value > 0) return
  busy.value = true
  err.value = ''
  try {
    await props.send(model.value.method as OtpMethod)
    sentTo.value = target.value
    start(30)
  } catch (e) {
    err.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mf" data-test="mfa-field">
    <div v-if="usable.length > 1" class="mf__tabs" role="radiogroup" :aria-label="t('mf.choose')">
      <button
        v-for="m in usable"
        :key="m"
        type="button"
        role="radio"
        class="mf__tab"
        :aria-checked="model.method === m"
        :data-test="`mf-${m}`"
        @click="pick(m)"
      >
        {{ t(`mf.m.${m}`) }}
      </button>
    </div>
    <p v-else class="mf__one">{{ t(`mf.m.${usable[0]}`) }}</p>

    <div v-if="isOtp" class="mf__send">
      <button
        type="button"
        class="a-pill a-pill--sm"
        :aria-busy="busy"
        :disabled="busy || left > 0"
        data-test="mf-send"
        @click="sendCode"
      >
        {{
          left > 0
            ? t('mf.resend', { n: left })
            : sentTo
              ? t('mf.sendAgain')
              : t('mf.send', { to: target })
        }}
      </button>
      <small v-if="sentTo" class="mf__ok" role="status" data-test="mf-sent">{{
        t('mf.sent', { to: sentTo })
      }}</small>
    </div>

    <label class="mf__lab" :for="`mf-code-${model.method}`">
      {{ model.method === 'totp' ? t('mf.hintTotp') : t('mf.hintOtp') }}
    </label>
    <input
      :id="`mf-code-${model.method}`"
      class="mf__in"
      :value="model.code"
      autocomplete="one-time-code"
      :inputmode="model.method === 'totp' ? 'text' : 'numeric'"
      maxlength="32"
      data-test="mf-code"
      @input="model = { method: model.method, code: ($event.target as HTMLInputElement).value }"
    />
    <small v-if="err" class="mf__err" role="alert" data-test="mf-err">{{ err }}</small>
  </div>
</template>

<style scoped>
.mf {
  display: grid;
  gap: 10px;
}
.mf__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.mf__tab {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--a-ink);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.mf__tab[aria-checked='true'] {
  background: var(--a-gold);
  border-color: var(--a-gold);
  color: var(--a-on-gold, var(--a-bg));
  font-weight: 600;
}
.mf__tab:focus-visible,
.mf__in:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 2px;
}
.mf__one {
  margin: 0;
  font-weight: 600;
}
.mf__send {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.mf__ok {
  color: var(--a-gold);
}
.mf__lab {
  font-size: 14px;
  font-weight: 600;
}
.mf__in {
  min-height: 48px;
  padding: 0 16px;
  border: 1px solid var(--a-line-strong);
  border-radius: 12px;
  background: var(--a-panel);
  color: var(--a-ink);
  font: inherit;
  letter-spacing: 0.12em;
}
.mf__err {
  color: var(--a-danger, #b3261e);
}
</style>
