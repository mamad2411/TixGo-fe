<script setup lang="ts">
import { ArrowUpRight, Menu2, X } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import AccountMenu from '@/components/app/AccountMenu.vue'
import ModeToggle from '@/components/app/ModeToggle.vue'
import AppTheme from '@/components/app/AppTheme.vue'
import SessionGuard from '@/components/app/SessionGuard.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { useAuthStore } from '@/stores/auth'
import { ADMIN_NAV, ORG_NAV, visibleNav } from '@/utils/dashNav'
import '@/pages/account/accountStyle.css'

// Cangkang dashboard bersama organizer & admin (docs/26): sidebar berkelompok, bilah atas, area konten.
// Menu mengikuti peran; di bawah 1024 px sidebar menjadi laci. Gate (scan) memakai GateLayout sendiri.
const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
usePageTitle()

const area = computed(() => route.meta.dash ?? 'organizer')
const groups = computed(() =>
  visibleNav(area.value === 'admin' ? ADMIN_NAV : ORG_NAV, auth.user?.role),
)
function isOn(i: { name: string; also?: readonly string[] }): boolean {
  const n = String(route.name)
  return n === i.name || !!i.also?.some((p) => n.startsWith(p))
}
const sectionTitle = computed(() => (route.meta.title ? t(route.meta.title) : ''))

// laci (ponsel/tablet)
const open = ref(false)
const drawer = ref<HTMLElement>()
const menuBtn = ref<HTMLButtonElement>()
async function openDrawer(): Promise<void> {
  open.value = true
  await nextTick()
  drawer.value?.querySelector<HTMLElement>('a, button')?.focus()
}
function closeDrawer(focusBack = false): void {
  open.value = false
  if (focusBack) menuBtn.value?.focus()
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) closeDrawer(true)
}
onMounted(() => {
  if (!auth.ready) void auth.restore()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
watch(
  () => route.fullPath,
  () => closeDrawer(),
)

const options = computed(() => [
  { label: t('dash.viewSite'), key: 'site' },
  { label: t('dash.myAccount'), key: 'account' },
  { label: t('nav.logout'), key: 'logout' },
])
async function onMenu(key: string): Promise<void> {
  if (key === 'site') await router.push({ name: 'events' })
  else if (key === 'account') await router.push({ name: 'overview' })
  else if (key === 'logout') {
    await auth.logout()
    await router.push({ name: 'home' })
  }
}
</script>

<template>
  <AppTheme>
    <ToneLight class="ds" :data-area="area" :data-test="area === 'admin' ? 'admin' : 'org'">
      <a class="a-skip" href="#konten">{{ t('common.skip') }}</a>
      <SessionGuard />

      <div v-if="open" class="ds__scrim" aria-hidden="true" @click="closeDrawer(true)" />
      <aside
        id="ds-side"
        ref="drawer"
        class="ds__side"
        :class="{ 'is-open': open }"
        :aria-label="t('dash.navLabel')"
      >
        <div class="ds__brand">
          <RouterLink :to="{ name: 'home' }" class="ds__logo" aria-label="TixGo">
            <span class="ds__mark">TIXGO</span>
          </RouterLink>
          <span class="ds__area">{{ t(`dash.area.${area}`) }}</span>
          <button
            type="button"
            class="ds__x"
            :aria-label="t('common.close')"
            @click="closeDrawer(true)"
          >
            <NIcon :component="X" :size="20" />
          </button>
        </div>

        <nav class="ds__nav">
          <div v-for="g in groups" :key="g.key" class="ds__grp">
            <p class="ds__cap">{{ t(`dash.group.${g.key}`) }}</p>
            <RouterLink
              v-for="i in g.items"
              :key="i.name"
              :to="{ name: i.name }"
              class="ds__link"
              :class="{
                'is-on': isOn(i),
              }"
            >
              <NIcon :component="i.icon" :size="19" aria-hidden="true" />
              <span>{{ t(`dash.nav.${i.name}`) }}</span>
            </RouterLink>
          </div>
        </nav>

        <RouterLink :to="{ name: 'events' }" class="ds__site">
          <span>{{ t('dash.viewSite') }}</span>
          <NIcon :component="ArrowUpRight" :size="16" aria-hidden="true" />
        </RouterLink>
      </aside>

      <div class="ds__col">
        <header class="ds__top">
          <button
            ref="menuBtn"
            type="button"
            class="ds__burger"
            :aria-label="t('dash.openMenu')"
            aria-controls="ds-side"
            :aria-expanded="open"
            @click="openDrawer"
          >
            <NIcon :component="Menu2" :size="22" />
          </button>
          <p class="ds__crumb">
            <span class="ds__crumb-a">{{ t(`dash.area.${area}`) }}</span>
            <span v-if="sectionTitle" aria-hidden="true">/</span>
            <strong v-if="sectionTitle">{{ sectionTitle }}</strong>
          </p>
          <span class="ds__sp" />
          <ModeToggle />
          <AccountMenu
            :label="auth.user?.name || auth.user?.email || ''"
            :avatar-key="auth.user?.avatar_key"
            :items="options"
            @select="onMenu"
          />
        </header>

        <main id="konten" class="ds__main" tabindex="-1">
          <RouterView v-slot="{ Component, route: r }">
            <Transition name="page" mode="out-in">
              <component :is="Component" :key="r.path" />
            </Transition>
          </RouterView>
        </main>
      </div>
    </ToneLight>
  </AppTheme>
</template>

<style scoped>
.ds {
  --ds-side: 252px;
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  background: var(--a-bg);
}
.ds__scrim {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgb(10 8 6 / 0.55);
}
.ds__side {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 80;
  width: min(86vw, 300px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 12px;
  overflow-y: auto;
  border-right: 1px solid var(--a-line);
  background: var(--a-bg2);
  transform: translateX(-102%);
  visibility: hidden;
  transition:
    transform 0.22s ease,
    visibility 0s 0.22s;
}
.ds__side.is-open {
  transform: none;
  visibility: visible;
  transition: transform 0.22s ease;
}
.ds__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 14px;
}
.ds__logo {
  color: var(--a-cream);
  text-decoration: none;
}
.ds__mark {
  font-family: var(--a-serif);
  font-size: 22px;
  letter-spacing: 0.22em;
}
.ds__area {
  padding: 3px 9px;
  border-radius: 999px;
  background: rgb(224 178 94 / 0.16);
  color: var(--a-gold);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ds__x {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-left: auto;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--a-muted);
  cursor: pointer;
}
.ds__nav {
  display: grid;
  gap: 18px;
  flex: 1;
  align-content: start;
}
.ds__grp {
  display: grid;
  gap: 2px;
}
.ds__cap {
  margin: 0 0 4px;
  padding: 0 10px;
  color: var(--a-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.ds__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  color: var(--a-ink);
  font-size: 15px;
  text-decoration: none;
  transition: background 0.15s;
}
.ds__link:hover {
  background: var(--a-bg3);
}
.ds__link:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 1px;
}
.ds__link.is-on {
  background: rgb(224 178 94 / 0.16);
  color: var(--a-gold);
  font-weight: 650;
}
.ds__link.is-on::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--a-gold);
}
.ds__site {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--a-line);
  border-radius: 12px;
  color: var(--a-muted);
  font-size: 14px;
  text-decoration: none;
}
.ds__site:hover {
  border-color: var(--a-line-strong);
  color: var(--a-ink);
}
.ds__col {
  display: grid;
  grid-template-columns: minmax(
    0,
    1fr
  ); /* tanpa ini kolom ikut melebar mengikuti isi nowrap di header */
  grid-template-rows: auto 1fr;
  min-width: 0;
  min-height: 100vh;
}
.ds__top {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 60px;
  padding: 8px var(--a-pad);
  border-bottom: 1px solid var(--a-line);
  background: var(--a-glass);
  backdrop-filter: blur(10px);
}
.ds__burger {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--a-ink);
  cursor: pointer;
}
.ds__burger:hover {
  background: var(--a-bg3);
}
.ds__crumb {
  flex: 0 1 auto;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  color: var(--a-muted);
  white-space: nowrap;
}
.ds__crumb strong {
  overflow: hidden;
  color: var(--a-ink);
  font-weight: 650;
  text-overflow: ellipsis;
}
.ds__crumb-a {
  display: none;
}
.ds__sp {
  flex: 1;
}
.ds__main {
  min-width: 0;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px var(--a-pad) 72px;
}
.ds__main:focus {
  outline: none;
}
/* HP kecil: akun cukup avatar agar bilah atas tidak sesak */
.ds__top :deep(.am__name) {
  display: none;
}
.ds__top :deep(.am .a-pill) {
  padding: 0 8px;
}
@media (min-width: 640px) {
  .ds__top :deep(.am__name) {
    display: inline;
  }
  .ds__top :deep(.am .a-pill) {
    padding: 0 22px;
  }
  .ds__crumb-a {
    display: inline;
  }
}
@media (min-width: 1024px) {
  .ds {
    grid-template-columns: var(--ds-side) minmax(0, 1fr);
  }
  .ds__side {
    position: sticky;
    top: 0;
    z-index: 1;
    width: auto;
    height: 100vh;
    transform: none;
    visibility: visible;
    transition: none;
  }
  .ds__x,
  .ds__burger {
    display: none;
  }
  .ds__link.is-on::before {
    left: -12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ds__side,
  .ds__side.is-open {
    transition: none;
  }
}
</style>
