<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { closeSupport, getSupport, replySupport, type SupportThread } from '@/api/me'
import BackLink from '@/components/app/BackLink.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import './accountStyle.css'

const { t, locale } = useI18n()
const route = useRoute()
const message = useMessage()
const apiMessage = useApiMessage()
useHead({ title: computed(() => t('hp.thread')) })
const id = computed(() => String(route.params.id))
const when = (iso: string) =>
  new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))

const th = ref<SupportThread | null>(null)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
async function load(): Promise<void> {
  try {
    th.value = await getSupport(id.value)
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)
const isOpen = computed(
  () => !!th.value && !['closed', 'resolved'].includes(th.value.ticket.status),
)

const reply = ref('')
const busy = ref(false)
async function send(): Promise<void> {
  const b = reply.value.trim()
  if (!b) return
  busy.value = true
  try {
    await replySupport(id.value, b)
    reply.value = ''
    await load()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
async function close(): Promise<void> {
  try {
    await closeSupport(id.value)
    message.success(t('hp.closed'))
    await load()
  } catch (e) {
    message.error(apiMessage(e))
  }
}
</script>

<template>
  <div class="ac">
    <BackLink plain :fallback="{ name: 'help' }" :label="t('acct.nav_.help')" />
    <SkeletonPage v-if="state === 'loading'" :rows="4" />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <template v-else-if="th">
      <h1 class="a-serif ac__title">#{{ th.ticket.number }} · {{ th.ticket.subject }}</h1>
      <ol class="th" data-test="thread">
        <li v-for="m in th.messages" :key="m.id" class="th__m" :class="{ staff: m.from_staff }">
          <small class="a-muted"
            >{{ m.from_staff ? t('hp.staff') : t('hp.you') }} · {{ when(m.created_at) }}</small
          >
          <p>{{ m.body }}</p>
        </li>
      </ol>
      <form v-if="isOpen" class="ac__card" @submit.prevent="send">
        <label for="th-reply" class="sr-only">{{ t('hp.replyLabel') }}</label>
        <textarea
          id="th-reply"
          v-model="reply"
          rows="4"
          maxlength="5000"
          class="th__ta"
          :placeholder="t('hp.replyLabel')"
          data-test="reply-body"
        />
        <div class="ac__act">
          <button
            type="submit"
            class="a-pill a-pill--solid"
            :disabled="busy || !reply.trim()"
            data-test="reply-send"
          >
            {{ t('hp.send') }}
          </button>
          <button type="button" class="a-pill" data-test="support-close" @click="close">
            {{ t('hp.close') }}
          </button>
        </div>
      </form>
      <p v-else class="a-muted">{{ t('hp.isClosed') }}</p>
    </template>
  </div>
</template>

<style scoped>
.th {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.th__m {
  padding: 14px 16px;
  border: 1px solid var(--a-line);
  border-radius: 14px;
  background: var(--a-panel);
  max-width: 86%;
}
.th__m.staff {
  justify-self: end;
  border-color: var(--a-gold);
}
.th__m p {
  margin: 6px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.th__ta {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--a-line);
  background: var(--a-bg);
  color: var(--a-ink);
  font: inherit;
  resize: vertical;
  width: 100%;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
