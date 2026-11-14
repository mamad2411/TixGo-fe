<script setup lang="ts">
import { Bell, Checks } from '@vicons/tabler'
import { NIcon, NPopover, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import type { Notice } from '@/api/me'
import { useApiMessage } from '@/composables/useApiMessage'
import { useNoticesStore } from '@/stores/notices'
import { noticeMeta, timeAgo } from '@/utils/notice'

const { t, locale } = useI18n()
const store = useNoticesStore()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const open = ref(false)
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))

// Segarkan saat pindah halaman (dibatasi 20 dtk di store) dan setiap kali panel dibuka.
watch(
  () => route.fullPath,
  () => void store.refresh(locale.value),
  { immediate: true },
)
watch(open, (v) => v && void store.refresh(locale.value, true))

const badge = computed(() => (store.unread > 9 ? '9+' : String(store.unread)))
const title = (n: Notice) => n.title || t(`nt.tpl.${n.template}`, t('nt.generic'))

async function go(n: Notice): Promise<void> {
  open.value = false
  try {
    if (!n.read) await store.read([n.id], locale.value)
  } catch (e) {
    message.error(apiMessage(e))
  }
  await router.push({ name: noticeMeta(n.template).route })
}
async function readAll(): Promise<void> {
  try {
    await store.read([], locale.value)
  } catch (e) {
    message.error(apiMessage(e))
  }
}
</script>

<template>
  <NPopover v-model:show="open" trigger="click" placement="bottom-end" :show-arrow="false" raw>
    <template #trigger>
      <button
        type="button"
        class="nb__btn"
        :aria-label="store.unread ? t('nt.bellUnread', { n: store.unread }) : t('nt.bell')"
        :aria-expanded="open"
        data-test="bell"
      >
        <NIcon :component="Bell" :size="20" aria-hidden="true" />
        <span v-if="store.unread" class="nb__dot" data-test="bell-count">{{ badge }}</span>
      </button>
    </template>
    <section class="nb__panel" :aria-label="t('nt.bell')" data-test="bell-panel">
      <header class="nb__head">
        <strong>{{ t('nt.bell') }}</strong>
        <button
          v-if="store.unread"
          type="button"
          class="nb__all"
          data-test="bell-readall"
          @click="readAll"
        >
          <NIcon :component="Checks" :size="16" aria-hidden="true" /> {{ t('nt.readAll') }}
        </button>
      </header>
      <p v-if="store.failed && !store.recent.length" class="nb__empty" role="alert">
        {{ t('nt.bellFail') }}
      </p>
      <p v-else-if="!store.recent.length" class="nb__empty">{{ t('nt.empty') }}</p>
      <ul v-else class="nb__list">
        <li v-for="n in store.recent.slice(0, 6)" :key="n.id">
          <button type="button" class="nb__item" :class="{ 'is-unread': !n.read }" @click="go(n)">
            <span class="nb__ic" :class="`is-${noticeMeta(n.template).tone}`">
              <NIcon :component="noticeMeta(n.template).icon" :size="18" aria-hidden="true" />
            </span>
            <span class="nb__txt">
              <strong>{{ title(n) }}</strong>
              <small v-if="n.body">{{ n.body }}</small>
              <time class="nb__time" :datetime="n.created_at">{{
                timeAgo(n.created_at, bcp)
              }}</time>
            </span>
            <i v-if="!n.read" class="nb__unread" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <footer class="nb__foot">
        <RouterLink :to="{ name: 'notifications' }" @click="open = false">{{
          t('nt.seeAll')
        }}</RouterLink>
      </footer>
    </section>
  </NPopover>
</template>

<style scoped>
.nb__btn {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid var(--a-line-strong);
  background: transparent;
  color: var(--a-ink);
  cursor: pointer;
}
.nb__btn:hover,
.nb__btn:focus-visible {
  border-color: var(--a-gold);
}
.nb__dot {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font: 700 11px/1 var(--a-sans, sans-serif);
  background: var(--a-danger, #d33);
  color: #fff;
  border: 2px solid var(--a-bg);
}
.nb__panel {
  width: min(380px, calc(100vw - 24px));
  max-height: min(560px, 80vh);
  display: grid;
  grid-template-rows: auto 1fr auto;
  border-radius: 18px;
  border: 1px solid var(--a-line);
  background: var(--a-panel, #fff);
  color: var(--a-ink);
  box-shadow: 0 18px 48px rgb(0 0 0 / 0.22);
  overflow: hidden;
}
.nb__head,
.nb__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
}
.nb__head {
  border-bottom: 1px solid var(--a-line);
}
.nb__foot {
  border-top: 1px solid var(--a-line);
  justify-content: center;
}
.nb__foot a {
  color: var(--a-gold-d, var(--a-gold));
  font-weight: 600;
  text-decoration: none;
}
.nb__all {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  background: none;
  border: 0;
  color: var(--a-gold-d, var(--a-gold));
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.nb__empty {
  margin: 0;
  padding: 28px 16px;
  text-align: center;
  color: var(--a-muted);
}
.nb__list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}
.nb__item {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: start;
  padding: 12px 16px;
  text-align: left;
  background: none;
  border: 0;
  border-bottom: 1px solid var(--a-line);
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.nb__item:hover,
.nb__item:focus-visible {
  background: rgb(217 185 121 / 0.12);
}
.nb__item.is-unread {
  background: rgb(217 185 121 / 0.07);
}
.nb__ic {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: rgb(217 185 121 / 0.16);
  color: var(--a-gold-d, var(--a-gold));
}
.nb__ic.is-good {
  background: rgb(46 160 90 / 0.16);
  color: var(--a-ok, #2a9d5c);
}
.nb__ic.is-warn {
  background: rgb(230 150 30 / 0.18);
  color: #b26a00;
}
.nb__ic.is-bad {
  background: rgb(211 51 51 / 0.14);
  color: var(--a-danger, #d33);
}
.nb__txt {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.nb__txt strong {
  font-size: 14px;
  line-height: 1.3;
}
.nb__txt small {
  color: var(--a-muted);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.nb__time {
  font-size: 12px;
  color: var(--a-muted);
}
.nb__unread {
  width: 9px;
  height: 9px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--a-gold);
}
</style>
