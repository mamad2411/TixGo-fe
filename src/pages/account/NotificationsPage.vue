<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { Checks } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { useRouter } from 'vue-router'

import {
  getPrefs,
  listNotices,
  PREF_CATEGORIES,
  PREF_CHANNELS,
  setPref,
  type Notice,
  type Prefs,
} from '@/api/me'
import EmptyState from '@/components/app/EmptyState.vue'
import PushCard from '@/components/app/PushCard.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useNoticesStore } from '@/stores/notices'
import { noticeMeta, timeAgo } from '@/utils/notice'
import './accountStyle.css'

const { t, locale } = useI18n()
useHead({ title: computed(() => t('acct.nav_.notifications')) })
const message = useMessage()
const router = useRouter()
const store = useNoticesStore()
const filter = ref<'all' | 'unread'>('all')
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const apiMessage = useApiMessage()
const day = (iso: string) =>
  new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))

const notices = ref<Notice[]>([])
const prefs = ref<Prefs>({})
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    ;[notices.value, prefs.value] = await Promise.all([listNotices(locale.value, 50), getPrefs()])
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

const shown = computed(() =>
  filter.value === 'unread' ? notices.value.filter((n) => !n.read) : notices.value,
)
const unreadCount = computed(() => notices.value.filter((n) => !n.read).length)
const heading = (n: Notice) => n.title || t(`nt.tpl.${n.template}`, t('nt.generic'))
async function open(n: Notice): Promise<void> {
  try {
    if (!n.read) {
      await store.read([n.id], locale.value)
      n.read = true
    }
  } catch (e) {
    message.error(apiMessage(e))
    return
  }
  await router.push({ name: noticeMeta(n.template).route })
}
async function readAll(): Promise<void> {
  try {
    await store.read([], locale.value)
    notices.value = notices.value.map((n) => ({ ...n, read: true }))
  } catch (e) {
    message.error(apiMessage(e))
  }
}

async function toggle(cat: string, ch: string, on: boolean): Promise<void> {
  const before = prefs.value[cat]?.[ch] ?? false
  prefs.value = { ...prefs.value, [cat]: { ...prefs.value[cat], [ch]: on } }
  try {
    await setPref(cat, ch, on)
  } catch (e) {
    prefs.value = { ...prefs.value, [cat]: { ...prefs.value[cat], [ch]: before } }
    message.error(apiMessage(e))
  }
}
</script>

<template>
  <div class="ac">
    <h1 class="a-serif ac__title">{{ t('acct.nav_.notifications') }}</h1>
    <SkeletonPage v-if="state === 'loading'" :rows="5" />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <template v-else>
      <section data-test="inbox">
        <div class="nt__bar">
          <h2 class="a-serif">{{ t('nt.inbox') }}</h2>
          <div class="nt__tools">
            <button
              type="button"
              class="a-pill"
              :class="{ 'a-pill--solid': filter === 'all' }"
              :aria-pressed="filter === 'all'"
              @click="filter = 'all'"
            >
              {{ t('nt.fAll') }}
            </button>
            <button
              type="button"
              class="a-pill"
              :class="{ 'a-pill--solid': filter === 'unread' }"
              :aria-pressed="filter === 'unread'"
              data-test="nt-unread"
              @click="filter = 'unread'"
            >
              {{ t('nt.fUnread') }}<template v-if="unreadCount"> ({{ unreadCount }})</template>
            </button>
            <button
              v-if="unreadCount"
              type="button"
              class="a-pill"
              data-test="nt-readall"
              @click="readAll"
            >
              <NIcon :component="Checks" :size="16" aria-hidden="true" /> {{ t('nt.readAll') }}
            </button>
          </div>
        </div>
        <EmptyState
          v-if="!shown.length"
          :title="filter === 'unread' ? t('nt.allRead') : t('nt.empty')"
          :body="filter === 'unread' ? t('nt.allReadBody') : t('nt.emptyBody')"
        />
        <ul v-else class="nt__list" data-test="notices">
          <li v-for="n in shown" :key="n.id">
            <button
              type="button"
              class="nt__item"
              :class="{ 'is-unread': !n.read }"
              data-test="notice"
              @click="open(n)"
            >
              <span class="nt__ic" :class="`is-${noticeMeta(n.template).tone}`">
                <NIcon :component="noticeMeta(n.template).icon" :size="22" aria-hidden="true" />
              </span>
              <span class="nt__txt">
                <strong>{{ heading(n) }}</strong>
                <span v-if="n.body" class="nt__body">{{ n.body }}</span>
                <small class="a-muted">
                  <time :datetime="n.created_at" :title="day(n.created_at)">{{
                    timeAgo(n.created_at, bcp)
                  }}</time>
                  · {{ t(`nt.ch.${n.channel}`, n.channel) }}
                  <template v-if="n.status === 'failed'"> · {{ t('nt.st.failed') }}</template>
                </small>
              </span>
              <i v-if="!n.read" class="nt__dot" :aria-label="t('nt.unread')" />
            </button>
          </li>
        </ul>
      </section>

      <PushCard />

      <section class="ac__card" data-test="prefs">
        <h2 class="a-serif">{{ t('nt.prefsTitle') }}</h2>
        <p class="a-muted">{{ t('nt.prefsBody') }}</p>
        <table class="nt__tbl">
          <thead>
            <tr>
              <th scope="col">{{ t('nt.category') }}</th>
              <th v-for="ch in PREF_CHANNELS" :key="ch" scope="col">{{ t(`nt.ch.${ch}`) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in PREF_CATEGORIES" :key="c">
              <th scope="row">
                <strong>{{ t(`nt.cat.${c}`) }}</strong>
                <small class="a-muted">{{ t(`nt.catBody.${c}`) }}</small>
              </th>
              <td v-for="ch in PREF_CHANNELS" :key="ch">
                <label class="nt__sw">
                  <input
                    type="checkbox"
                    role="switch"
                    :checked="prefs[c]?.[ch] ?? false"
                    :aria-label="`${t(`nt.cat.${c}`)} — ${t(`nt.ch.${ch}`)}`"
                    :data-test="`pref-${c}-${ch}`"
                    @change="toggle(c, ch, ($event.target as HTMLInputElement).checked)"
                  />
                </label>
              </td>
            </tr>
          </tbody>
        </table>
        <small class="a-muted">{{ t('nt.txNote') }}</small>
      </section>
    </template>
  </div>
</template>

<style scoped>
.nt__tbl {
  width: 100%;
  border-collapse: collapse;
}
.nt__tbl th,
.nt__tbl td {
  padding: 12px 8px;
  border-top: 1px solid var(--a-line);
  text-align: center;
  vertical-align: middle;
}
.nt__tbl thead th {
  border-top: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--a-muted);
}
.nt__tbl tbody th {
  text-align: left;
  display: table-cell;
  font-weight: 400;
}
.nt__tbl tbody th strong,
.nt__tbl tbody th small {
  display: block;
}
.nt__sw input {
  width: 44px;
  height: 24px;
  accent-color: var(--a-gold);
  cursor: pointer;
  margin: 0;
}
.nt__sw {
  display: inline-grid;
  place-items: center;
  min-width: 44px;
  min-height: 44px;
}

.nt__bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.nt__bar h2 {
  margin: 0;
}
.nt__tools {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.nt__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.nt__item {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 14px;
  align-items: start;
  text-align: left;
  padding: 16px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.nt__item:hover,
.nt__item:focus-visible {
  border-color: var(--a-gold);
}
.nt__item.is-unread {
  border-color: var(--a-line-strong);
  background: linear-gradient(90deg, rgb(217 185 121 / 0.12), transparent 60%), var(--a-panel);
}
.nt__ic {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: rgb(217 185 121 / 0.16);
  color: var(--a-gold-d, var(--a-gold));
}
.nt__ic.is-good {
  background: rgb(46 160 90 / 0.16);
  color: var(--a-ok, #2a9d5c);
}
.nt__ic.is-warn {
  background: rgb(230 150 30 / 0.18);
  color: #b26a00;
}
.nt__ic.is-bad {
  background: rgb(211 51 51 / 0.14);
  color: var(--a-danger, #d33);
}
.nt__txt {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.nt__txt strong {
  font-size: 16px;
}
.nt__body {
  color: var(--a-muted);
  line-height: 1.45;
}
.nt__dot {
  width: 10px;
  height: 10px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--a-gold);
}
</style>
