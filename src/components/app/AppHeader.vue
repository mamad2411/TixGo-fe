<script setup lang="ts">
import { Search } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import AccountMenu from '@/components/app/AccountMenu.vue'
import SuggestPanel from '@/components/app/SuggestPanel.vue'
import { rememberSearch, useSearchSuggest } from '@/composables/useSearchSuggest'
import { formatEventDate } from '@/utils/format'
import NotificationBell from '@/components/app/NotificationBell.vue'
import ModeToggle from '@/components/app/ModeToggle.vue'
import { mode } from '@/composables/useThemeMode'
import { useAuthStore } from '@/stores/auth'
import { useNoticesStore } from '@/stores/notices'
import { usePendingStore } from '@/stores/pending'

const { t, locale } = useI18n()
const auth = useAuthStore()
const pending = usePendingStore()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const notices = useNoticesStore()
watch(
  () => auth.isAuthed,
  (v) => {
    if (!v) notices.clear()
  },
)
watch(
  () => [auth.isAuthed, route.fullPath],
  () => {
    // Halaman pesanan memuat daftar yang sama lalu menyerahkannya ke store; jangan minta dua kali.
    if (auth.isAuthed && route.name !== 'orders') void pending.load()
  },
  { immediate: true },
)

const sg = useSearchSuggest('h', {
  inEvents: (term) => t('sg.search', { q: term }),
  date: (e) =>
    `${formatEventDate(e.starts_at, e.tz, locale.value === 'en' ? 'en-GB' : 'id-ID')} · ${e.venue_name}`,
})
const q = sg.term
q.value = typeof route.query.q === 'string' ? route.query.q : ''
watch(
  () => route.query.q,
  (v) => {
    q.value = typeof v === 'string' ? v : ''
  },
)

function search(): void {
  const term = q.value.trim()
  rememberSearch(term)
  sg.open.value = false
  void router.push({ name: 'events', query: term ? { q: term } : {} })
}

import { isOrganizer, isStaff } from '@/utils/roles'

const ACCOUNT_ROUTES = [
  'overview',
  'tickets',
  'orders',
  'refunds',
  'vouchers',
  'favorites',
  'following',
  'org-home',
  'admin-home',
  'notifications',
  'profile',
  'security',
  'help',
]
const menu = computed(() => {
  const items: { label: string; key: string }[] = [
    { label: t('acct.nav_.overview'), key: 'overview' },
    { label: t('acct.tickets'), key: 'tickets' },
    {
      label: pending.active.length
        ? `${t('acct.orders')} (${pending.active.length})`
        : t('acct.orders'),
      key: 'orders',
    },
    { label: t('acct.nav_.refunds'), key: 'refunds' },
    { label: t('acct.nav_.vouchers'), key: 'vouchers' },
    { label: t('acct.favorites'), key: 'favorites' },
    { label: t('acct.nav_.following'), key: 'following' },
    { label: t('acct.nav_.notifications'), key: 'notifications' },
    { label: t('acct.profile'), key: 'profile' },
    { label: t('acct.nav_.security'), key: 'security' },
    { label: t('acct.nav_.help'), key: 'help' },
  ]
  if (isStaff(auth.user?.role)) items.unshift({ label: t('dash.adminArea'), key: 'admin-home' })
  if (isOrganizer(auth.user?.role)) items.unshift({ label: t('org.area'), key: 'org-home' })
  if (!auth.phoneVerified) items.push({ label: t('nav.verifyPhone'), key: 'phone' })
  if (!auth.emailVerified) items.push({ label: t('nav.verifyEmail'), key: 'email' })
  items.push({ label: t('nav.logout'), key: 'logout' })
  return items
})

async function onSelect(key: string): Promise<void> {
  if (ACCOUNT_ROUTES.includes(key)) await router.push({ name: key })
  else if (key === 'phone') await router.push({ name: 'verify-phone' })
  else if (key === 'email') await router.push({ name: 'verify-email' })
  else if (key === 'logout') {
    await auth.logout()
    pending.clear()
    message.success(t('nav.loggedOut'))
    await router.push({ name: 'events' })
  }
}

const loginTo = computed(() => ({
  name: 'login',
  query: route.name === 'login' || route.name === 'register' ? {} : { next: route.fullPath },
}))
</script>

<template>
  <header class="a-head" :class="{ 'tone-light': mode === 'light' }">
    <div class="a-head__in">
      <RouterLink class="a-head__mark" :to="{ name: 'home' }" aria-label="TixGo">TIXGO</RouterLink>

      <nav class="a-head__nav" :aria-label="t('nav.primary')">
        <RouterLink :to="{ name: 'events' }" class="a-head__link">{{ t('nav.events') }}</RouterLink>
        <RouterLink :to="{ name: 'artists' }" class="a-head__link" data-test="nav-artists">{{
          t('nav.artists')
        }}</RouterLink>
        <RouterLink :to="{ name: 'venues' }" class="a-head__link" data-test="nav-venues">{{
          t('nav.venues')
        }}</RouterLink>
        <RouterLink :to="{ name: 'calendar' }" class="a-head__link" data-test="nav-calendar">{{
          t('nav.calendar')
        }}</RouterLink>
      </nav>

      <form
        v-if="route.name !== 'events'"
        class="a-head__search"
        role="search"
        @submit.prevent="search"
      >
        <SuggestPanel :sg="sg" />
        <label class="a-sr" for="a-search">{{ t('nav.searchLabel') }}</label>
        <input
          id="a-search"
          v-model="q"
          type="search"
          maxlength="100"
          :placeholder="t('nav.searchPlaceholder')"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="sg.open.value"
          :aria-controls="sg.listId"
          :aria-activedescendant="sg.active.value >= 0 ? sg.optId(sg.active.value) : undefined"
          data-test="search-input"
          @focus="sg.open.value = true"
          @blur="sg.open.value = false"
          @input="sg.open.value = true"
          @keydown="sg.onKey($event)"
        />
        <button type="submit" :aria-label="t('nav.searchSubmit')">
          <NIcon :component="Search" :size="18" aria-hidden="true" />
        </button>
      </form>

      <div class="a-head__acct">
        <ModeToggle />
        <template v-if="!auth.ready">
          <span class="a-head__ph" aria-hidden="true" />
        </template>
        <template v-else-if="auth.isAuthed">
          <RouterLink
            v-if="pending.active.length"
            class="a-pill a-pill--solid a-head__pend"
            :to="{ name: 'order', params: { id: pending.active[0].id } }"
            data-test="pending-chip"
          >
            {{ t('acct.pendingChip') }}
          </RouterLink>
          <NotificationBell />
          <AccountMenu
            :label="auth.user?.name ?? ''"
            :avatar-key="auth.user?.avatar_key"
            :items="menu"
            @select="onSelect"
          />
        </template>
        <template v-else>
          <RouterLink class="a-pill" :to="loginTo" data-test="login">{{
            t('nav.login')
          }}</RouterLink>
          <RouterLink class="a-pill a-pill--solid a-head__reg" :to="{ name: 'register' }">
            {{ t('nav.register') }}
          </RouterLink>
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
.a-head {
  position: sticky;
  top: 0;
  z-index: 20;
  /* Latar pekat, bukan kaca. Dulu `var(--a-glass)` (90% opak) + blur: 10% isi halaman menembus,
     sehingga saat digulir teks dan gambar terlihat meluncur di dalam header walau posisinya tetap.
     Mode terang sudah tampak pekat, mode gelap belum — sekarang keduanya sama dan header diam.
     Sekaligus sesuai docs/16 §2: tanpa glassmorphism. */
  background: var(--a-bg);
  border-bottom: 1px solid var(--a-line);
}
.a-head__in {
  max-width: var(--a-max);
  margin: 0 auto;
  padding: 10px var(--a-pad);
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.a-head__mark {
  font-family: var(--a-serif);
  font-size: 26px;
  letter-spacing: 0.18em;
  color: var(--a-cream);
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.a-head__nav {
  display: flex;
  align-items: center;
  gap: 22px;
}
.a-head__link {
  color: var(--a-ink);
  text-decoration: none;
  font-size: 14px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.a-head__link.router-link-active {
  color: var(--a-gold);
}
.a-head__search {
  position: relative;
  flex: 1 1 220px;
  display: flex;
  align-items: center;
  max-width: 420px;
  margin-left: auto;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: var(--a-bg3);
  padding-left: 16px;
}
.a-head__search:focus-within {
  border-color: var(--a-gold);
}
.a-head__search input {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  background: transparent;
  border: 0;
  color: var(--a-ink);
  font: inherit;
  font-size: 14px;
}
.a-head__search input:focus-visible {
  outline: none; /* fokus ditampilkan oleh :focus-within pada pembungkus */
}
.a-head__search button {
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  color: var(--a-gold);
  cursor: pointer;
  border-radius: 50%;
}
.a-head__acct {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.a-head__ph {
  width: 120px;
  height: 44px;
}
.a-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
@media (max-width: 520px) {
  /* Navigasi tetap ada di HP (Konser, Artis): satu baris ringkas di atas kolom cari, bukan disembunyikan. */
  .a-head__nav {
    order: 4;
    flex-basis: 100%;
    display: flex;
    gap: 18px;
    margin-left: 0;
  }
  .a-head__in {
    gap: 10px;
  }
}
@media (max-width: 640px) {
  .a-head__search {
    order: 5;
    flex-basis: 100%;
    max-width: none;
    margin-left: 0;
  }
  .a-head__acct {
    margin-left: auto;
  }
}
</style>
