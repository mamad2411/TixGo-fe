<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { changePassword, updateProfile } from '@/api/account'
import AvatarUploader from '@/components/app/AvatarUploader.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import { useAuthStore } from '@/stores/auth'
import './accountStyle.css'

const { t, locale } = useI18n()
useHeaderTone(computed(() => 'light'))
useHead({ title: computed(() => t('acct.profile')) })
const auth = useAuthStore()
const message = useMessage()
const apiMessage = useApiMessage()

const name = ref(auth.user?.name ?? '')
const lang = ref<'id' | 'en'>(auth.user?.locale ?? 'id')
const dirty = computed(
  () => name.value.trim() !== auth.user?.name || lang.value !== auth.user?.locale,
)
const nameErr = computed(() => (name.value.trim().length < 2 ? t('checkout.errName') : ''))
const saving = ref(false)
const tried = ref(false)

async function save(): Promise<void> {
  tried.value = true
  if (nameErr.value) return
  saving.value = true
  try {
    const u = await updateProfile({ name: name.value.trim(), locale: lang.value })
    if (auth.user) auth.user = u
    locale.value = u.locale
    message.success(t('acct.saved'))
    tried.value = false
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    saving.value = false
  }
}
function reset(): void {
  name.value = auth.user?.name ?? ''
  lang.value = auth.user?.locale ?? 'id'
  tried.value = false
}

const cur = ref('')
const next = ref('')
const again = ref('')
const pwTried = ref(false)
const pwBusy = ref(false)
const pwErr = computed(() => {
  if (!cur.value) return t('acct.errCur')
  if (next.value.length < 8) return t('acct.errNew')
  if (next.value !== again.value) return t('acct.errMatch')
  return ''
})
async function savePw(): Promise<void> {
  pwTried.value = true
  if (pwErr.value) return
  pwBusy.value = true
  try {
    await changePassword(cur.value, next.value)
    message.success(t('acct.pwDone'))
    cur.value = next.value = again.value = ''
    pwTried.value = false
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    pwBusy.value = false
  }
}
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('acct.profile') }}</h1>

    <section class="ac__card">
      <AvatarUploader />
    </section>

    <form class="ac__card" novalidate @submit.prevent="save">
      <h2 class="a-serif">{{ t('acct.about') }}</h2>
      <div class="ac__f">
        <label for="pf-name">{{ t('checkout.name') }}</label>
        <input
          id="pf-name"
          v-model="name"
          maxlength="100"
          autocomplete="name"
          :aria-invalid="tried && !!nameErr"
        />
        <small role="alert">{{ tried ? nameErr : '' }}</small>
      </div>
      <div class="ac__f">
        <label for="pf-mail">{{ t('checkout.email') }}</label>
        <input id="pf-mail" :value="auth.user?.email" disabled />
        <small class="a-muted">{{
          auth.emailVerified ? t('acct.verified') : t('acct.unverified')
        }}</small>
      </div>
      <div class="ac__f">
        <label for="pf-lang">{{ t('acct.language') }}</label>
        <select id="pf-lang" v-model="lang">
          <option value="id">Bahasa Indonesia</option>
          <option value="en">English</option>
        </select>
      </div>
      <div class="ac__act">
        <button
          type="submit"
          class="a-pill a-pill--solid"
          :disabled="!dirty || saving"
          data-test="profile-save"
        >
          {{ t('acct.save') }}
        </button>
        <button type="button" class="a-pill" :disabled="!dirty || saving" @click="reset">
          {{ t('acct.cancel') }}
        </button>
      </div>
    </form>

    <form class="ac__card" novalidate @submit.prevent="savePw">
      <h2 class="a-serif">{{ t('acct.password') }}</h2>
      <div class="ac__f">
        <label for="pw-cur">{{ t('acct.pwCur') }}</label>
        <input id="pw-cur" v-model="cur" type="password" autocomplete="current-password" />
      </div>
      <div class="ac__f">
        <label for="pw-new">{{ t('acct.pwNew') }}</label>
        <input id="pw-new" v-model="next" type="password" autocomplete="new-password" />
      </div>
      <div class="ac__f">
        <label for="pw-again">{{ t('acct.pwAgain') }}</label>
        <input id="pw-again" v-model="again" type="password" autocomplete="new-password" />
        <small role="alert">{{ pwTried ? pwErr : '' }}</small>
      </div>
      <div class="ac__act">
        <button type="submit" class="a-pill a-pill--solid" :disabled="pwBusy">
          {{ t('acct.pwSave') }}
        </button>
      </div>
    </form>
  </div>
</template>
