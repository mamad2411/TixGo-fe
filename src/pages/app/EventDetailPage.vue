<script setup lang="ts">
import { useHead } from '@unhead/vue'

import {
  CalendarEvent,
  CalendarPlus,
  Clock,
  MapPin,
  Share,
  UserExclamation,
  LayoutGrid,
  Microphone2,
  Notes,
  Star,
  ShieldCheck,
} from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { calendarUrl, getEvent, type PublicEvent } from '@/api/events'
import { toApiError } from '@/api/errors'
import BackLink from '@/components/app/BackLink.vue'
import EventResale from '@/components/app/EventResale.vue'
import EventReviews from '@/components/app/EventReviews.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import FavoriteButton from '@/components/app/FavoriteButton.vue'
import TicketPanel from '@/components/app/TicketPanel.vue'
import VenueCard from '@/components/app/VenueCard.vue'
import VenueExplorer, { type SeatPick } from '@/components/venue/VenueExplorer.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { recordViewed } from '@/composables/useRecentlyViewed'
import { formatLongDate, formatRupiah, formatTime } from '@/utils/format'
import { fallbackCover } from '@/utils/fallbackCover'
import { mediaAt, mediaSrcset } from '@/utils/media'

const { t, locale } = useI18n()
const route = useRoute()
const message = useMessage()
const apiMessage = useApiMessage()

const ev = ref<PublicEvent | null>(null)
// pilihan pembeli dibagi antara denah dan panel tiket
const picked = ref<SeatPick[]>([])
const tierSel = ref('')
const state = ref<'loading' | 'ok' | 'notfound' | 'error'>('loading')
const errText = ref('')

async function load(): Promise<void> {
  state.value = 'loading'
  picked.value = []
  try {
    ev.value = await getEvent(String(route.params.slug))
    recordViewed(ev.value.slug)
    state.value = 'ok'
  } catch (e) {
    const err = toApiError(e)
    errText.value = apiMessage(err)
    state.value = err.status === 404 ? 'notfound' : 'error'
  }
}
watch(() => route.params.slug, load, { immediate: true })

useHead({ title: computed(() => ev.value?.title ?? '') })

const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const when = computed(() =>
  ev.value ? formatLongDate(ev.value.starts_at, ev.value.tz, bcp.value) : '',
)
const start = computed(() =>
  ev.value ? formatTime(ev.value.starts_at, ev.value.tz, bcp.value) : '',
)
const doors = computed(() =>
  ev.value?.doors_at ? formatTime(ev.value.doors_at, ev.value.tz, bcp.value) : null,
)
const fromPrice = computed(() =>
  ev.value?.min_final_price != null ? formatRupiah(ev.value.min_final_price, bcp.value) : null,
)

async function share(): Promise<void> {
  if (!ev.value) return
  const data = {
    title: ev.value.title,
    text: t('detail.shareText', { title: ev.value.title }),
    url: location.href,
  }
  try {
    if (navigator.share) {
      await navigator.share(data)
      return
    }
    await navigator.clipboard.writeText(location.href)
    message.success(t('detail.linkCopied'))
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return // pengguna menutup lembar bagikan
    message.error(t('detail.shareFailed'))
  }
}

// ---- navigasi section (scrollspy) ----
const sections = computed(() => {
  const e = ev.value
  if (!e) return []
  const out: { id: string; icon: typeof Notes }[] = []
  if (e.description) out.push({ id: 'tentang', icon: Notes })
  if (e.artists.length) out.push({ id: 'lineup', icon: Microphone2 })
  if (e.tiers.length) out.push({ id: 'denah', icon: LayoutGrid })
  out.push(
    { id: 'lokasi', icon: MapPin },
    { id: 'ulasan', icon: Star },
    { id: 'refund', icon: ShieldCheck },
  )
  return out
})
const active = ref('')
let io: IntersectionObserver | undefined
watch(sections, async (list) => {
  io?.disconnect()
  if (!list.length) return
  await nextTick()
  io = new IntersectionObserver(
    (entries) => {
      const vis = entries
        .filter((x) => x.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (vis) active.value = vis.target.id
    },
    { rootMargin: '-120px 0px -60% 0px' },
  )
  for (const x of list) {
    const el = document.getElementById(x.id)
    if (el) io.observe(el)
  }
})
onBeforeUnmount(() => io?.disconnect())
function jump(id: string): void {
  document.getElementById(id)?.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
}

function toPanel(): void {
  document.getElementById('tiket')?.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
}
</script>

<template>
  <div class="dt">
    <div
      v-if="state === 'loading'"
      class="dt__sk a-sk"
      role="status"
      :aria-label="t('common.loading')"
    >
      <div class="dt__skhero" />
      <div class="dt__skwrap">
        <div class="dt__skcol">
          <span class="a-sk-bar a-sk-bar--sm" style="width: 34%" />
          <span class="a-sk-bar a-sk-bar--title" style="width: 78%" />
          <span class="a-sk-bar" style="width: 58%" />
          <span class="a-sk-bar" style="width: 86%" />
          <span class="a-sk-bar" style="width: 44%" />
        </div>
        <div class="dt__skpanel" />
      </div>
    </div>

    <div v-else-if="state === 'notfound'" class="dt__wrap">
      <ErrorState :message="t('detail.notFound')" @retry="load" />
      <p class="dt__back">
        <RouterLink :to="{ name: 'events' }">{{ t('detail.backAll') }}</RouterLink>
      </p>
    </div>

    <div v-else-if="state === 'error'" class="dt__wrap">
      <ErrorState :message="errText" @retry="load" />
    </div>

    <template v-else-if="ev">
      <header class="dt__hero on-dark">
        <img
          class="dt__bg"
          :src="mediaAt(ev.poster_url, 1600) ?? fallbackCover(ev.slug)"
          :srcset="mediaSrcset(ev.poster_url)"
          sizes="100vw"
          fetchpriority="high"
          alt=""
        />
        <div class="dt__shade" />
        <div class="dt__hero-in">
          <BackLink class="dt__back-btn" />
          <nav class="dt__crumb a-caps" :aria-label="t('detail.crumb')">
            <RouterLink :to="{ name: 'events' }">{{ t('events.title') }}</RouterLink>
            <span aria-hidden="true">/</span>
            <RouterLink v-if="ev.genre" :to="{ name: 'events', query: { genre: ev.genre } }">{{
              ev.genre
            }}</RouterLink>
          </nav>
          <h1 class="a-serif dt__title">{{ ev.title }}</h1>
          <p v-if="ev.artists.length" class="dt__artists">
            {{ ev.artists.map((a) => a.name).join(' · ') }}
          </p>
          <ul class="dt__facts">
            <li><NIcon :component="CalendarEvent" :size="18" aria-hidden="true" /> {{ when }}</li>
            <li>
              <NIcon :component="Clock" :size="18" aria-hidden="true" /> {{ start
              }}<template v-if="doors"> · {{ t('detail.doors', { t: doors }) }}</template>
            </li>
            <li>
              <NIcon :component="MapPin" :size="18" aria-hidden="true" /> {{ ev.venue_name }},
              {{ ev.city }}
            </li>
            <li v-if="ev.age_min">
              <NIcon :component="UserExclamation" :size="18" aria-hidden="true" />
              {{ t('detail.age', { n: ev.age_min }) }}
            </li>
          </ul>
          <div class="dt__acts">
            <FavoriteButton :event-id="ev.id" :title="ev.title" variant="pill" />
            <button type="button" class="act" data-test="share" @click="share">
              <NIcon :component="Share" :size="18" aria-hidden="true" /> {{ t('detail.share') }}
            </button>
            <a class="act" :href="calendarUrl(ev.slug)" download data-test="ics">
              <NIcon :component="CalendarPlus" :size="18" aria-hidden="true" />
              {{ t('detail.calendar') }}
            </a>
          </div>
        </div>
      </header>

      <nav class="dt__tabs" :aria-label="t('detail.sections')">
        <div class="dt__tabs-in">
          <a
            v-for="x in sections"
            :key="x.id"
            :href="`#${x.id}`"
            :class="{ 'is-on': active === x.id }"
            @click.prevent="jump(x.id)"
          >
            <NIcon :component="x.icon" :size="17" aria-hidden="true" />
            {{ t(`detail.nav.${x.id}`) }}
          </a>
        </div>
      </nav>

      <div class="dt__wrap dt__grid">
        <div class="dt__main">
          <section v-if="ev.description" id="tentang" class="blk">
            <h2 class="a-serif blk__h">{{ t('detail.about') }}</h2>
            <p class="blk__p">{{ ev.description }}</p>
          </section>

          <section v-if="ev.artists.length" id="lineup" class="blk">
            <h2 class="a-serif blk__h">{{ t('detail.lineup') }}</h2>
            <ul class="lineup">
              <li v-for="a in ev.artists" :key="a.id" class="lu">
                <img
                  v-if="a.image_url"
                  :src="mediaAt(a.image_url, 400)"
                  :srcset="mediaSrcset(a.image_url)"
                  sizes="160px"
                  loading="lazy"
                  :alt="t('detail.artistAlt', { name: a.name })"
                />
                <div>
                  <h3 class="a-serif lu__n">{{ a.name }}</h3>
                  <p v-if="a.bio" class="a-muted lu__b">{{ a.bio }}</p>
                </div>
              </li>
            </ul>
          </section>

          <section v-if="ev.tiers.length" id="denah" class="blk">
            <h2 class="a-serif blk__h">{{ t('detail.stage') }}</h2>
            <VenueExplorer v-model:picked="picked" v-model:tier="tierSel" :event="ev" />
          </section>

          <section id="lokasi" class="blk">
            <h2 class="a-serif blk__h">{{ t('detail.where') }}</h2>
            <VenueCard v-if="ev.venue" :venue="ev.venue" />
          </section>

          <EventResale :slug="ev.slug" />

          <section id="ulasan" class="blk">
            <h2 class="a-serif blk__h">{{ t('detail.reviews') }}</h2>
            <EventReviews :slug="ev.slug" />
          </section>

          <section id="refund" class="blk">
            <h2 class="a-serif blk__h">{{ t('detail.refund') }}</h2>
            <p class="callout">{{ ev.refund_summary }}</p>
          </section>
        </div>

        <TicketPanel v-model:picked="picked" v-model:tier="tierSel" :event="ev" class="dt__panel" />
      </div>

      <!-- Bilah beli untuk ponsel -->
      <div class="dt__bar">
        <div>
          <small class="a-muted">{{ t('events.fromLabel') }}</small>
          <strong v-if="fromPrice">{{ fromPrice }}</strong>
        </div>
        <button type="button" class="a-pill a-pill--solid" @click="toPanel">
          {{ t('detail.pickTickets') }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dt {
  /* Satu sumber untuk offset lengket: header (66) + bar tab (61) + jarak 12.
     Panel tiket harus berhenti DI BAWAH bar tab, bukan menabraknya. */
  --dt-head: 66px;
  --dt-tabs: 61px;
  --dt-panel-top: calc(var(--dt-head) + var(--dt-tabs) + 12px);
}
.dt__sk {
  min-height: 100vh; /* mengisi layar penuh agar footer tidak melompat saat konten tiba (CLS) */
  display: grid;
  grid-template-rows: clamp(360px, 56vh, 560px) auto;
}
.dt__skhero {
  background: var(--a-bg3);
  opacity: 0.55;
}
.dt__skwrap {
  width: 100%;
  max-width: var(--a-max);
  margin: 0 auto;
  padding: 32px var(--a-pad) 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 40px;
  align-items: start;
}
.dt__skcol {
  display: grid;
  gap: 14px;
  align-content: start;
}
.dt__skpanel {
  height: 300px;
  border: 1px solid var(--a-line);
  border-radius: 20px;
  background: var(--a-bg2);
}
@media (max-width: 959px) {
  .dt__skwrap {
    grid-template-columns: minmax(0, 1fr);
  }
  .dt__skpanel {
    display: none;
  }
}
.dt__hero {
  position: relative;
  isolation: isolate;
  min-height: clamp(460px, 68vh, 640px);
  display: grid;
  align-items: end;
  overflow: hidden;
  background: var(--a-bg); /* dasar gelap: kontras teks hero tidak bergantung pada foto */
}
.dt__bg,
.dt__shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
}
.dt__bg {
  object-fit: cover;
}
.dt__shade {
  background:
    linear-gradient(to top, var(--a-bg) 2%, rgb(12 10 9 / 0.78) 38%, rgb(12 10 9 / 0.25) 78%),
    linear-gradient(to right, rgb(12 10 9 / 0.7), transparent 70%);
}
.dt__hero-in {
  width: 100%;
  max-width: var(--a-max);
  margin: 0 auto;
  padding: 88px var(--a-pad) 40px;
  display: grid;
  gap: 14px;
}
.dt__back-btn {
  justify-self: start;
}
.dt__crumb {
  display: flex;
  gap: 10px;
  align-items: center;
}
.dt__crumb a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  margin-block: -10px; /* target sentuh 44px tanpa menambah tinggi baris remah */
  color: var(--a-gold);
  text-decoration: none;
}
.dt__title {
  font-size: clamp(44px, 8vw, 104px);
  line-height: 0.98;
  color: var(--a-cream);
  max-width: 14ch;
  text-wrap: balance;
}
.dt__artists {
  font-size: 18px;
  color: var(--a-gold);
}
.dt__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 26px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}
.dt__facts li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.dt__acts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}
.act {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid rgb(255 255 255 / 0.28);
  border-radius: 999px;
  background: rgb(12 10 9 / 0.55);
  backdrop-filter: blur(8px);
  color: var(--a-cream);
  font: inherit;
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
}
.act:hover {
  color: var(--a-gold);
  background: rgb(12 10 9 / 0.8);
}
.dt__wrap {
  max-width: var(--a-max);
  margin: 0 auto;
  padding: 0 var(--a-pad);
}
.dt__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 48px;
  align-items: start;
  padding-top: 40px;
}
.dt__panel {
  position: sticky;
  top: var(--dt-panel-top);
}
/* Laptop 768 px: panel lebih tinggi dari layar, jadi bisa digulir sendiri (tidak terpotong di bawah). */
@media (max-height: 860px) {
  .dt__panel {
    max-height: calc(100dvh - var(--dt-panel-top) - 16px);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
}
.dt__tabs {
  position: sticky;
  top: var(--dt-head);
  z-index: 15;
  background: var(--a-glass);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--a-line);
}
.dt__tabs-in {
  display: flex;
  gap: 6px;
  max-width: var(--a-max);
  margin: 0 auto;
  padding: 8px var(--a-pad);
  overflow-x: auto;
  scrollbar-width: none;
}
.dt__tabs a {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  color: var(--a-muted);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.dt__tabs a:hover {
  color: var(--a-ink);
}
.dt__tabs a.is-on {
  background: rgb(217 185 121 / 0.16);
  color: var(--a-gold);
}
.blk {
  scroll-margin-top: 130px;
}
.dt__main {
  display: grid;
  gap: 48px;
}
.blk {
  display: grid;
  gap: 14px;
}
.blk__h {
  font-size: clamp(30px, 3.4vw, 42px);
  color: var(--a-cream);
}
.blk__p {
  font-size: 18px;
  line-height: 1.75;
  color: var(--a-ink);
  max-width: 68ch;
}
.lineup {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.lu {
  display: grid;
  grid-template-columns: 112px 1fr;
  gap: 18px;
  align-items: center;
  padding: 14px;
  border: 1px solid var(--a-line);
  border-radius: 20px;
  background: var(--a-bg2);
}
.lu img {
  width: 112px;
  height: 112px;
  object-fit: cover;
  border-radius: 14px;
}
.lu__n {
  font-size: 28px;
  color: var(--a-cream);
}
.lu__b {
  margin-top: 4px;
  font-size: 15px;
}
.where {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border: 1px solid var(--a-line);
  border-radius: 20px;
  background: var(--a-bg2);
}
.where__n {
  font-weight: 700;
  color: var(--a-cream);
}
.callout {
  padding: 18px 20px;
  border-left: 3px solid var(--a-gold);
  border-radius: 4px 16px 16px 4px;
  background: var(--a-bg2);
  max-width: 68ch;
}
.dt__back {
  margin-top: 16px;
  text-align: center;
}
.dt__bar {
  display: none;
}
@media (max-width: 980px) {
  .dt__grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .dt__panel {
    position: static;
    order: -1;
  }
  .dt__bar {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 25;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px var(--a-pad) calc(12px + env(safe-area-inset-bottom));
    background: var(--a-glass);
    backdrop-filter: blur(12px);
    border-top: 1px solid var(--a-line-strong);
  }
  .dt__bar small {
    display: block;
    line-height: 1;
  }
  .dt__bar strong {
    font-family: var(--a-serif);
    font-size: 28px;
    color: var(--a-gold);
    font-weight: 400;
  }
}
@media (max-width: 560px) {
  .lu {
    grid-template-columns: 84px 1fr;
  }
  .lu img {
    width: 84px;
    height: 84px;
  }
}
</style>
