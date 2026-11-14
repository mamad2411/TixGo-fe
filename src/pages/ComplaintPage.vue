<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { sendPrivacyComplaint } from '@/api/account'
import BackLink from '@/components/app/BackLink.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useAuthStore } from '@/stores/auth'

// Pengaduan privasi: terbuka untuk siapa pun (bukan hanya pengguna masuk), karena orang yang datanya
// terlanjur ada di sistem belum tentu punya akun. Balasan lewat email dalam 14 hari.
const { t } = useI18n()
const apiMessage = useApiMessage()
const auth = useAuthStore()
useHead({ title: computed(() => t('pc.title')) })

const form = reactive({
  name: auth.user?.name ?? '',
  email: auth.user?.email ?? '',
  subject: '',
  body: '',
})
const errs = reactive({ email: '', subject: '', body: '' })
const busy = ref(false)
const err = ref('')
const done = ref(false)

function validate(): boolean {
  errs.email = /^\S+@\S+\.\S+$/.test(form.email.trim()) ? '' : t('pc.errEmail')
  errs.subject = form.subject.trim().length >= 3 ? '' : t('pc.errSubject')
  errs.body = form.body.trim().length >= 10 ? '' : t('pc.errBody')
  return !errs.email && !errs.subject && !errs.body
}

async function send(): Promise<void> {
  err.value = ''
  if (!validate()) return
  busy.value = true
  try {
    await sendPrivacyComplaint({
      name: form.name.trim() || undefined,
      email: form.email.trim(),
      subject: form.subject.trim(),
      body: form.body.trim(),
    })
    done.value = true
  } catch (e) {
    err.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ToneLight class="tone-page">
    <div class="pc">
      <BackLink plain class="pg-back" :fallback="{ name: 'legal', params: { kind: 'privacy' } }" />
      <p class="a-caps">{{ t('pc.kicker') }}</p>
      <h1 class="a-serif">{{ t('pc.title') }}</h1>
      <p class="a-muted">{{ t('pc.lead') }}</p>

      <div v-if="done" class="pc__done" role="status" data-test="complaint-done">
        <h2 class="a-serif">{{ t('pc.doneTitle') }}</h2>
        <p>{{ t('pc.doneBody', { e: form.email }) }}</p>
        <RouterLink :to="{ name: 'events' }" class="a-pill a-pill--solid">{{
          t('pc.home')
        }}</RouterLink>
      </div>

      <form v-else class="pc__form" novalidate @submit.prevent="send">
        <label>
          <span
            >{{ t('pc.name') }} <small class="a-muted">({{ t('pc.optional') }})</small></span
          >
          <input v-model="form.name" autocomplete="name" maxlength="100" data-test="pc-name" />
        </label>
        <label>
          {{ t('pc.email') }}
          <input
            v-model="form.email"
            type="email"
            autocomplete="email"
            inputmode="email"
            maxlength="254"
            :aria-invalid="!!errs.email"
            data-test="pc-email"
          />
          <small v-if="errs.email" class="pc__err" role="alert">{{ errs.email }}</small>
        </label>
        <label>
          {{ t('pc.subject') }}
          <input
            v-model="form.subject"
            maxlength="150"
            :aria-invalid="!!errs.subject"
            data-test="pc-subject"
          />
          <small v-if="errs.subject" class="pc__err" role="alert">{{ errs.subject }}</small>
        </label>
        <label>
          {{ t('pc.body') }}
          <textarea
            v-model="form.body"
            rows="6"
            maxlength="5000"
            :aria-invalid="!!errs.body"
            data-test="pc-body"
          />
          <small v-if="errs.body" class="pc__err" role="alert">{{ errs.body }}</small>
        </label>
        <p v-if="err" class="pc__err" role="alert" data-test="pc-err">{{ err }}</p>
        <button
          type="submit"
          class="a-pill a-pill--solid"
          :aria-busy="busy"
          :disabled="busy"
          data-test="pc-send"
        >
          {{ t('pc.send') }}
        </button>
      </form>
    </div>
  </ToneLight>
</template>

<style scoped>
.pc {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px var(--a-pad) 80px;
  display: grid;
  gap: 12px;
}
.pc h1 {
  font-size: clamp(30px, 5vw, 44px);
  color: var(--a-cream);
  margin: 0;
}
.pc__form {
  display: grid;
  gap: 16px;
  justify-items: start;
  margin-top: 8px;
}
.pc__form label {
  display: grid;
  gap: 6px;
  width: 100%;
  font-size: 14px;
  font-weight: 600;
}
.pc__form input,
.pc__form textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--a-line-strong);
  border-radius: 14px;
  background: var(--a-panel);
  color: var(--a-ink);
  font: inherit;
  font-weight: 400;
}
.pc__form input {
  min-height: 44px;
  padding-block: 0;
}
.pc__form input:focus-visible,
.pc__form textarea:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 2px;
}
.pc__err {
  margin: 0;
  color: var(--a-danger, #b3261e);
  font-weight: 400;
}
.pc__done {
  display: grid;
  gap: 10px;
  justify-items: start;
  padding: 24px;
  border: 1px solid var(--a-gold);
  border-radius: 18px;
  background: var(--a-panel);
}
.pc__done h2 {
  margin: 0;
}
</style>
