<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { useApiMessage } from '@/composables/useApiMessage'
import { usePush } from '@/composables/usePush'

// Notifikasi di perangkat ini (Web Push). Setiap keadaan dijelaskan terus terang supaya pengguna tahu
// kenapa tombolnya tidak ada atau tidak bisa dipakai, bukan dibiarkan menebak.
const { t } = useI18n()
const message = useMessage()
const apiMessage = useApiMessage()
const { state, busy, refresh, enable, disable } = usePush()
onMounted(refresh)

async function toggle(): Promise<void> {
  try {
    if (state.value === 'on') {
      await disable()
      message.success(t('push.offOk'))
    } else {
      if (await enable()) message.success(t('push.onOk'))
    }
  } catch (e) {
    message.error(apiMessage(e) || t('push.fail'))
  }
}
</script>

<template>
  <section v-if="state !== 'loading'" class="ac__card" data-test="push-card" :data-state="state">
    <h2 class="a-serif">{{ t('push.title') }}</h2>
    <p class="a-muted">{{ t(`push.body.${state}`) }}</p>
    <button
      v-if="state === 'off' || state === 'on'"
      type="button"
      class="a-pill"
      :class="{ 'a-pill--solid': state === 'off' }"
      :aria-busy="busy"
      :disabled="busy"
      data-test="push-toggle"
      @click="toggle"
    >
      {{ state === 'on' ? t('push.disable') : t('push.enable') }}
    </button>
  </section>
</template>
