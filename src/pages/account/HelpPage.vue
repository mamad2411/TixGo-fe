<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import {
  createSupport,
  listSupport,
  SUPPORT_CATEGORIES,
  type SupportCategory,
  type SupportTicket,
} from '@/api/me'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import './accountStyle.css'

const { t, locale } = useI18n()
useHead({ title: computed(() => t('acct.nav_.help')) })
const route = useRoute()
const message = useMessage()
const apiMessage = useApiMessage()
const day = (iso: string) =>
  new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'id-ID', {
    dateStyle: 'medium',
  }).format(new Date(iso))

const rows = ref<SupportTicket[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = await listSupport()
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

// Bisa dibuka dari halaman pesanan: /bantuan?order=<id>&kategori=refund
const orderId = computed(() =>
  typeof route.query.order === 'string' ? route.query.order : undefined,
)
const category = ref<SupportCategory>(
  (SUPPORT_CATEGORIES as string[]).includes(String(route.query.kategori))
    ? (route.query.kategori as SupportCategory)
    : 'other',
)
const subject = ref('')
const body = ref('')
const tried = ref(false)
const busy = ref(false)
const errs = computed(() => ({
  subject: subject.value.trim().length < 5 ? t('hp.errSubject') : '',
  body: body.value.trim().length < 10 ? t('hp.errBody') : '',
}))
async function submit(): Promise<void> {
  tried.value = true
  if (errs.value.subject || errs.value.body) return
  busy.value = true
  try {
    const created = await createSupport({
      category: category.value,
      subject: subject.value.trim(),
      body: body.value.trim(),
      order_id: orderId.value?.length === 26 ? orderId.value : undefined,
    })
    message.success(t('hp.sent', { n: created.number }))
    subject.value = body.value = ''
    tried.value = false
    await load()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
const open = (s: string) => !['closed', 'resolved'].includes(s)
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('acct.nav_.help') }}</h1>

    <form class="ac__card" novalidate data-test="support-form" @submit.prevent="submit">
      <h2 class="a-serif">{{ t('hp.newTitle') }}</h2>
      <p class="a-muted">{{ t('hp.newBody') }}</p>
      <div class="ac__f">
        <label for="hp-cat">{{ t('hp.category') }}</label>
        <select id="hp-cat" v-model="category" data-test="support-category">
          <option v-for="c in SUPPORT_CATEGORIES" :key="c" :value="c">
            {{ t(`hp.cat.${c}`) }}
          </option>
        </select>
      </div>
      <div class="ac__f">
        <label for="hp-sub">{{ t('hp.subject') }}</label>
        <input
          id="hp-sub"
          v-model="subject"
          maxlength="150"
          data-test="support-subject"
          :aria-invalid="tried && !!errs.subject"
        />
        <small role="alert">{{ tried ? errs.subject : '' }}</small>
      </div>
      <div class="ac__f">
        <label for="hp-body">{{ t('hp.message') }}</label>
        <textarea
          id="hp-body"
          v-model="body"
          rows="5"
          maxlength="5000"
          class="hp__ta"
          data-test="support-body"
          :aria-invalid="tried && !!errs.body"
        />
        <small role="alert">{{ tried ? errs.body : '' }}</small>
      </div>
      <p v-if="orderId" class="a-muted">{{ t('hp.linkedOrder') }}</p>
      <div class="ac__act">
        <button
          type="submit"
          class="a-pill a-pill--solid"
          :disabled="busy"
          data-test="support-submit"
        >
          {{ busy ? t('common.loading') : t('hp.submit') }}
        </button>
      </div>
    </form>

    <section>
      <h2 class="a-serif">{{ t('hp.mine') }}</h2>
      <SkeletonPage v-if="state === 'loading'" :rows="3" />
      <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
      <EmptyState v-else-if="!rows.length" :title="t('hp.empty')" :body="t('hp.emptyBody')" />
      <ul v-else class="ac__list" data-test="support-list">
        <li v-for="s in rows" :key="s.id" class="ac__row" :class="{ 'is-hot': open(s.status) }">
          <span class="ac__main">
            <strong>#{{ s.number }} · {{ s.subject }}</strong>
            <small class="a-muted">{{ t(`hp.cat.${s.category}`) }} · {{ day(s.created_at) }}</small>
          </span>
          <span class="ac__badge" :class="open(s.status) ? 'is-pending' : 'is-paid'">{{
            t(`hp.st.${s.status}`, s.status)
          }}</span>
          <RouterLink class="a-pill" :to="{ name: 'support-thread', params: { id: s.id } }">{{
            t('hp.open')
          }}</RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.hp__ta {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--a-line);
  background: var(--a-bg);
  color: var(--a-ink);
  font: inherit;
  resize: vertical;
}
</style>
