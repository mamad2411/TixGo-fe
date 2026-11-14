<script setup lang="ts">
import { Bell, BellRinging } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useApiMessage } from '@/composables/useApiMessage'
import { useRequireLogin } from '@/composables/useRequireLogin'
import { useFollowsStore } from '@/stores/follows'

// Ikuti artis: kabar konser baru lewat notifikasi. Artis diikuti memakai id (BE menyimpan id), slug diterima saat mengikuti.
const props = defineProps<{ artistId: string; slug: string; name: string }>()
const { t } = useI18n()
const follows = useFollowsStore()
const message = useMessage()
const apiMessage = useApiMessage()
const requireLogin = useRequireLogin()
const busy = ref(false)
const on = computed(
  () => follows.has('artist', props.artistId) || follows.has('artist', props.slug),
)

async function toggle(): Promise<void> {
  if (!(await requireLogin('follow.needLogin'))) return
  busy.value = true
  try {
    const now = await follows.toggle('artist', props.slug, props.artistId)
    message.success(t(now ? 'follow.on' : 'follow.off', { n: props.name }))
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    type="button"
    class="a-pill fb"
    :class="{ 'a-pill--solid': !on }"
    :aria-pressed="on"
    :disabled="busy"
    data-test="follow"
    @click="toggle"
  >
    <NIcon :component="on ? BellRinging : Bell" :size="18" aria-hidden="true" />
    {{ on ? t('follow.following') : t('follow.follow') }}
  </button>
</template>

<style scoped>
.fb {
  min-height: 44px;
}
</style>
