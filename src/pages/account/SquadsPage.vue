<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Friends } from '@vicons/tabler'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { mySquads, type Squad } from '@/api/squad'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import './accountStyle.css'

// Squad saya + masuk lewat kode (untuk teman yang menerima kode lewat chat, bukan tautan).
const { t } = useI18n()
useHead({ title: computed(() => t('sq.listTitle')) })
const router = useRouter()
const apiMessage = useApiMessage()
const rows = ref<Squad[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const code = ref('')
const codeErr = ref('')

async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = await mySquads()
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

function go(): void {
  const c = code.value.trim().toUpperCase()
  codeErr.value = /^[A-Z0-9]{8}$/.test(c) ? '' : t('sq.errCode')
  if (!codeErr.value) void router.push({ name: 'squad-join', params: { code: c } })
}
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('sq.listTitle') }}</h1>
    <p class="a-muted">{{ t('sq.listLead') }}</p>
    <form class="sql__join" novalidate @submit.prevent="go">
      <label for="sq-code" class="a-sr">{{ t('sq.codeLabel') }}</label>
      <input
        id="sq-code"
        v-model="code"
        maxlength="8"
        autocapitalize="characters"
        :placeholder="t('sq.codePh')"
        data-test="code-input"
      />
      <button type="submit" class="a-pill a-pill--solid" data-test="code-go">
        {{ t('sq.codeGo') }}
      </button>
      <small v-if="codeErr" class="sql__err" role="alert">{{ codeErr }}</small>
    </form>
    <SkeletonPage v-if="state === 'loading'" :rows="3" />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <EmptyState
      v-else-if="!rows.length"
      :icon="Friends"
      :title="t('sq.emptyTitle')"
      :body="t('sq.emptyBody')"
    />
    <ul v-else class="sql" data-test="squad-list">
      <li v-for="s in rows" :key="s.id">
        <RouterLink :to="{ name: 'squad', params: { id: s.id } }" class="sql__row">
          <span class="sql__what">
            <strong>{{ s.event_title || s.code }}</strong>
            <small class="a-muted"
              >{{ t(`sq.st.${s.status}`) }} ·
              {{ t('sq.progress', { paid: s.paid, size: s.size }) }}</small
            >
          </span>
          <code>{{ s.code }}</code>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sql__join {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.sql__join input {
  flex: 0 1 200px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: var(--a-panel);
  color: var(--a-ink);
  font: inherit;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.sql__join input:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 2px;
}
.sql__err {
  flex-basis: 100%;
  color: var(--a-danger, #b3261e);
}
.sql {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.sql__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
  color: var(--a-ink);
  text-decoration: none;
}
.sql__row:hover {
  border-color: var(--a-gold);
}
.sql__what {
  display: grid;
  gap: 2px;
  min-width: 0;
}
</style>
