<script setup lang="ts">
import { CalendarEvent, Flame, MapPin, Qrcode, ShieldCheck, Ticket } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { listEvents, type EventCard } from '@/api/events'
import AppTheme from '@/components/app/AppTheme.vue'
import BackLink from '@/components/app/BackLink.vue'
import ModeToggle from '@/components/app/ModeToggle.vue'
import PosterWall from '@/components/app/PosterWall.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { formatEventDate } from '@/utils/format'

const { t, locale } = useI18n()
const route = useRoute()
usePageTitle()

// Panel kiri memakai konser nyata sebagai bukti sosial, bukan gambar dummy. Katalognya banyak,
// jadi kartu unggulan DIGILIR: berganti tiap kunjungan (login/daftar/lupa sandi) dan tiap 9 detik.
const ROTATE_MS = 9000
const POOL_KEY = 'tixgo:auth:feat'
const pool = ref<EventCard[]>([])
const idx = ref(0)
const featured = computed(() => pool.value[idx.value] ?? null)
const wall = ref<EventCard[]>([])

// Lanjutkan dari kartu terakhir yang tampil supaya kunjungan berikutnya tidak mengulang yang sama.
const startAt = (size: number): number => {
  if (size < 2) return 0
  const prev = Number(sessionStorage.getItem(POOL_KEY) ?? '-1')
  const next = (Number.isFinite(prev) && prev >= 0 ? prev + 1 : 0) % size
  sessionStorage.setItem(POOL_KEY, String(next))
  return next
}
const step = (dir = 1) => {
  const size = pool.value.length
  if (size < 2) return
  idx.value = (idx.value + dir + size) % size
  sessionStorage.setItem(POOL_KEY, String(idx.value))
}

let timer: ReturnType<typeof setInterval> | undefined
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const stopTimer = () => {
  if (timer) clearInterval(timer)
  timer = undefined
}
const startTimer = () => {
  stopTimer()
  if (reducedMotion() || pool.value.length < 2 || document.hidden) return
  timer = setInterval(() => step(1), ROTATE_MS)
}
const onVisibility = () => {
  if (document.hidden) stopTimer()
  else startTimer()
}

onMounted(async () => {
  try {
    const list = (await listEvents({ per_page: 50, sort: 'popular' })).data
    wall.value = list
    const withPoster = list.filter((e) => e.poster_url)
    const onsale = withPoster.filter((e) => e.sale_state === 'onsale')
    pool.value = onsale.length >= 3 ? onsale : withPoster.length ? withPoster : list
    idx.value = startAt(pool.value.length)
  } catch {
    pool.value = [] // panel tetap tampil dengan gradien; galat katalog bukan urusan halaman auth
  }
  startTimer()
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  stopTimer()
  document.removeEventListener('visibilitychange', onVisibility)
})

const key = computed(() => String(route.meta.authKey ?? 'login'))

// Pindah login <-> daftar <-> lupa sandi: tampilkan tiket lain, bukan yang sama terus.
watch(key, () => step(1))
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const perks = [
  { icon: Ticket, k: 'fair' },
  { icon: ShieldCheck, k: 'price' },
  { icon: Qrcode, k: 'qr' },
] as const
</script>

<template>
  <AppTheme>
    <a class="a-skip" href="#konten">{{ t('common.skip') }}</a>
    <div class="au">
      <aside class="au__side" aria-hidden="false">
        <PosterWall :events="wall" />
        <div class="au__shade" />
        <div class="au__in">
          <RouterLink class="au__mark" :to="{ name: 'home' }" aria-label="TixGo">TIXGO</RouterLink>
          <div class="au__copy">
            <p class="a-caps au__kick">{{ t(`auth.side.${key}.kicker`) }}</p>
            <h2 class="a-serif au__h">{{ t(`auth.side.${key}.title`) }}</h2>
            <p class="au__p">{{ t(`auth.side.${key}.body`) }}</p>
            <ul class="au__perks">
              <li v-for="p in perks" :key="p.k">
                <span class="au__pi"
                  ><NIcon :component="p.icon" :size="18" aria-hidden="true"
                /></span>
                {{ t(`auth.perks.${p.k}`) }}
              </li>
            </ul>
          </div>
          <Transition name="feat" mode="out-in">
            <RouterLink
              v-if="featured"
              :key="featured.slug"
              class="au__feat"
              :to="{ name: 'event', params: { slug: featured.slug } }"
              @mouseenter="stopTimer"
              @mouseleave="startTimer"
              @focus="stopTimer"
              @blur="startTimer"
            >
              <span class="au__tag"
                ><NIcon :component="Flame" :size="13" aria-hidden="true" />
                {{ t('auth.side.trending') }}</span
              >
              <strong class="a-serif">{{ featured.title }}</strong>
              <span class="au__meta"
                ><NIcon :component="CalendarEvent" :size="14" aria-hidden="true" />
                {{ formatEventDate(featured.starts_at, featured.tz, bcp) }}</span
              >
              <span class="au__meta"
                ><NIcon :component="MapPin" :size="14" aria-hidden="true" />
                {{ featured.venue_name }}, {{ featured.city }}</span
              >
            </RouterLink>
          </Transition>
        </div>
      </aside>

      <ToneLight tag="section" class="au__main">
        <div class="au__top"><BackLink :fallback="{ name: 'events' }" /><ModeToggle /></div>
        <main id="konten" class="au__card" tabindex="-1">
          <div class="au__stub" aria-hidden="true">
            <span>ADMIT ONE</span><span class="au__stubno">TIXGO · No. 0001</span>
          </div>
          <div class="au__perf" aria-hidden="true" />
          <div class="au__body">
            <RouterView v-slot="{ Component, route: r }">
              <Transition name="page">
                <component :is="Component" :key="r.path" />
              </Transition>
            </RouterView>
          </div>
          <svg class="au__bar" viewBox="0 0 240 28" aria-hidden="true" preserveAspectRatio="none">
            <path
              d="M0 0h3v28H0zM6 0h1.5v28H6zM11 0h4v28h-4zM18 0h2v28h-2zM24 0h1v28h-1zM28 0h3.5v28H28zM35 0h1.5v28H35zM40 0h4v28h-4zM47 0h1v28h-1zM51 0h2.5v28H51zM57 0h4v28h-4zM64 0h1.5v28H64zM69 0h3v28h-3zM76 0h1v28h-1zM80 0h4v28h-4zM87 0h2v28h-2zM92 0h1.5v28H92zM97 0h4v28h-4zM104 0h1v28h-1zM108 0h3.5v28H108zM115 0h2v28h-2zM120 0h1.5v28H120zM125 0h4v28h-4zM132 0h1v28h-1zM136 0h3v28h-3zM143 0h2v28h-2zM148 0h4v28h-4zM155 0h1.5v28H155zM160 0h1v28h-1zM164 0h4v28h-4zM171 0h2v28h-2zM176 0h1.5v28H176zM181 0h3.5v28H181zM188 0h1v28h-1zM192 0h4v28h-4zM199 0h2v28h-2zM204 0h1.5v28H204zM209 0h4v28h-4zM216 0h1v28h-1zM220 0h3v28h-3zM227 0h2v28h-2zM232 0h4v28h-4z"
            />
          </svg>
        </main>
        <RouterLink class="au__browse a-muted" :to="{ name: 'events' }">{{
          t('auth.browse')
        }}</RouterLink>
      </ToneLight>
    </div>
  </AppTheme>
</template>

<style scoped>
.au {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  min-height: 100vh;
}
.au__side {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: linear-gradient(135deg, #1d1915, #3a2c1a);
}
.au__bg,
.au__shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
}
.au__bg {
  object-fit: cover;
  animation: au-kb 22s ease-out forwards;
}
@keyframes au-kb {
  from {
    transform: scale(1.02);
  }
  to {
    transform: scale(1.1);
  }
}
.au__shade {
  background:
    linear-gradient(to top, rgb(12 10 9 / 0.96), rgb(12 10 9 / 0.45) 55%, rgb(12 10 9 / 0.7)),
    linear-gradient(to right, rgb(12 10 9 / 0.6), transparent);
}
.au__in {
  position: sticky;
  top: 0;
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 24px;
  padding: 32px clamp(24px, 4vw, 56px) 40px;
}
.au__mark {
  justify-self: start;
  font-family: var(--a-serif);
  font-size: 30px;
  letter-spacing: 0.24em;
  color: var(--a-cream);
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.au__copy {
  align-self: center;
  display: grid;
  gap: 14px;
  max-width: 520px;
}
.au__kick {
  color: var(--a-gold);
}
.au__h {
  font-size: clamp(40px, 4.6vw, 68px);
  line-height: 1;
  color: var(--a-cream);
  text-wrap: balance;
}
.au__p {
  font-size: 17px;
  color: var(--a-ink);
  max-width: 44ch;
}
.au__perks {
  display: grid;
  gap: 10px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.au__perks li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
}
.au__pi {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--a-line-strong);
  background: rgb(12 10 9 / 0.5);
  color: var(--a-gold);
}
.au__feat {
  display: grid;
  gap: 4px;
  max-width: 420px;
  padding: 16px 18px;
  border: 1px solid var(--a-line-strong);
  border-radius: 18px;
  background: rgb(12 10 9 / 0.62);
  backdrop-filter: blur(10px);
  color: var(--a-ink);
  text-decoration: none;
  transition: border-color 0.2s;
}
.au__feat:hover {
  border-color: var(--a-gold);
}
/* Giliran kartu unggulan: masuk halus, keluar cepat. */
.feat-enter-active {
  transition:
    opacity 0.35s ease-out,
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.feat-leave-active {
  transition: opacity 0.16s linear;
}
.feat-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.feat-leave-to {
  opacity: 0;
}
.au__feat strong {
  font-size: 26px;
  font-weight: 400;
  color: var(--a-cream);
}
.au__tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: start;
  padding: 3px 10px;
  border-radius: 999px;
  background: #b72a1a;
  color: #fff;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}
.au__meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: rgb(239 229 207 / 0.85);
}
.au__main {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 22px;
  padding: 28px clamp(20px, 5vw, 72px);
  background:
    radial-gradient(700px 360px at 80% -10%, rgb(217 185 121 / 0.1), transparent 70%), var(--a-bg);
}
.au__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.au__top .bk {
  background: var(--a-bg2);
  border-color: var(--a-line-strong);
}
/* Halaman auth tampil datar: kontrol Naive UI tanpa bayangan keras (aturan global memakai
   --shadow-keras) dan tanpa geser saat hover/tekan. */
.au :deep(.n-button:not(.n-button--disabled)),
.au :deep(.n-button:not(.n-button--disabled):hover),
.au :deep(.n-button:not(.n-button--disabled):active) {
  box-shadow: none;
  transform: none;
}
.au__card {
  position: relative;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  border: 1px solid var(--a-line-strong);
  border-radius: 26px;
  background: linear-gradient(180deg, var(--a-bg3), var(--a-bg2));
  /* tanpa bayangan: kartu login/daftar tampil datar, hanya garis tepi */
}
.au__stub {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 32px 14px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: var(--a-gold);
}
.au__stubno {
  letter-spacing: 0.16em;
  color: var(--a-muted);
  font-weight: 600;
}
/* perforasi tiket: garis putus + dua takik setengah lingkaran */
.au__perf {
  position: relative;
  height: 0;
  border-top: 2px dashed var(--a-line-strong);
  margin: 0 22px;
}
.au__perf::before,
.au__perf::after {
  content: '';
  position: absolute;
  top: -13px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--a-bg);
  border: 1px solid var(--a-line-strong);
}
.au__perf::before {
  left: -35px;
}
.au__perf::after {
  right: -35px;
}
.au__body {
  padding: 28px clamp(22px, 5vw, 36px) 8px;
}
.au__bar {
  display: block;
  width: calc(100% - 64px);
  height: 26px;
  margin: 8px 32px 22px;
  fill: var(--a-gold);
}
.au__browse {
  align-self: center;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  font-size: 14px;
}

@media (max-width: 959px) {
  .au {
    grid-template-columns: 1fr;
  }
  .au__side {
    min-height: 0;
  }
  .au__in {
    position: static;
    min-height: 0;
    grid-template-rows: auto;
    padding: 18px var(--a-pad);
  }
  .au__copy,
  .au__feat {
    display: none; /* ponsel: fokus ke form; panel foto menjadi pita merek */
  }
  .au__side {
    height: 84px;
  }
  .au__main {
    padding-top: 20px;
    justify-content: flex-start;
  }
}
@media (prefers-reduced-motion: reduce) {
  .au__bg {
    animation: none;
  }
}
</style>
