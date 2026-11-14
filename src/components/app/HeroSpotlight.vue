<script setup lang="ts">
import { CalendarEvent, MapPin, PlayerPause, PlayerPlay } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { EventCard } from '@/api/events'
import { formatEventDate, formatRupiah } from '@/utils/format'
import { mediaAt, mediaSrcset } from '@/utils/media'

const props = defineProps<{ events: EventCard[] }>()
const { t, locale } = useI18n()

const i = ref(0)
const playing = ref(false)
const hovering = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

// Poster hero berukuran 1600 px. Kalau semua slide dipasangi src sejak awal, lima poster
// terunduh bersamaan sebelum halaman sempat tampil. Slide dimuat bertahap: aktif + berikutnya.
// Slide berikutnya sengaja menunggu jaringan lengang, bukan ikut di awal: hero sudah tampil
// dari slide pertama, dan slide kedua baru dibutuhkan 6,5 dtk kemudian.
const allowed = ref<number[]>([0])
watch(i, (n) => {
  const next = (n + 1) % props.events.length
  if (!allowed.value.includes(n) || !allowed.value.includes(next)) {
    allowed.value = [...new Set([...allowed.value, n, next])]
  }
})

// requestIdleCallback tidak ada di Safari lama; setTimeout jadi cadangan supaya slide kedua
// tetap dimuat sebelum transisi pertama.
function preloadNext(): void {
  const add = () => {
    if (props.events.length < 2) return
    if (!allowed.value.includes(1)) allowed.value = [...allowed.value, 1]
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(add, { timeout: 3000 })
  else setTimeout(add, 1500)
}

const reduce =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const cur = computed(() => props.events[i.value])

function go(n: number): void {
  i.value = (n + props.events.length) % props.events.length
}
function tick(): void {
  if (!hovering.value) go(i.value + 1)
}
function start(): void {
  stop()
  timer = setInterval(tick, 6500)
  playing.value = true
}
function stop(): void {
  if (timer) clearInterval(timer)
  timer = undefined
  playing.value = false
}
// Autoplay hanya bila gerak diizinkan; pengguna selalu bisa menjeda (WCAG 2.2.2).
onMounted(() => {
  preloadNext()
  if (!reduce && props.events.length > 1) start()
})
onBeforeUnmount(stop)

function tag(e: EventCard): string | null {
  if (e.sale_state === 'onsale' && e.almost_gone) return t('events.almostGone')
  if (e.sale_state === 'upcoming') return t('events.state.upcoming')
  if (e.sale_state === 'onsale' && e.queue_required) return t('events.queue')
  return null
}
</script>

<template>
  <section
    v-if="cur"
    class="hero"
    :aria-roledescription="t('spotlight.carousel')"
    :aria-label="t('spotlight.label')"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <div class="hero__stage" aria-live="off">
      <div
        v-for="(e, n) in events"
        :key="e.id"
        class="hero__slide"
        :class="{ 'is-on': n === i }"
        :aria-hidden="n !== i"
        role="group"
        :aria-roledescription="t('spotlight.slide')"
        :aria-label="`${n + 1} / ${events.length}`"
      >
        <img
          v-if="e.poster_url && allowed.includes(n)"
          :src="mediaAt(e.poster_url, 1600)"
          :srcset="mediaSrcset(e.poster_url)"
          sizes="100vw"
          :loading="n === 0 ? 'eager' : 'lazy'"
          :fetchpriority="n === 0 ? 'high' : undefined"
          alt=""
        />
        <div class="hero__shade" />
      </div>
    </div>

    <div :key="cur.id" class="hero__copy">
      <p v-if="tag(cur)" class="hero__tag">{{ tag(cur) }}</p>
      <p class="a-caps hero__genre">{{ cur.genre }}</p>
      <h2 class="a-serif hero__title">{{ cur.title }}</h2>
      <p class="hero__meta">
        <span
          ><NIcon :component="CalendarEvent" :size="17" aria-hidden="true" />
          {{ formatEventDate(cur.starts_at, cur.tz, bcp) }}</span
        >
        <span
          ><NIcon :component="MapPin" :size="17" aria-hidden="true" /> {{ cur.venue_name }},
          {{ cur.city }}</span
        >
      </p>
      <div class="hero__cta">
        <RouterLink
          class="a-pill a-pill--solid hero__btn"
          :to="{ name: 'event', params: { slug: cur.slug } }"
        >
          {{ t('spotlight.cta') }}
        </RouterLink>
        <span v-if="cur.min_final_price != null" class="hero__price">
          {{ t('events.from', { price: formatRupiah(cur.min_final_price, bcp) }) }}
        </span>
      </div>
    </div>

    <div v-if="events.length > 1" class="hero__nav">
      <button
        type="button"
        class="hero__pp"
        :aria-label="playing ? t('spotlight.pause') : t('spotlight.play')"
        @click="playing ? stop() : start()"
      >
        <NIcon :component="playing ? PlayerPause : PlayerPlay" :size="18" aria-hidden="true" />
      </button>
      <ol class="hero__dots">
        <li v-for="(e, n) in events" :key="e.id">
          <button
            type="button"
            class="hero__dot"
            :class="{ 'is-on': n === i }"
            :aria-label="t('spotlight.go', { title: e.title })"
            :aria-current="n === i"
            @click="go(n)"
          >
            <span class="hero__thumb">
              <img v-if="e.poster_url" :src="mediaAt(e.poster_url, 400)" alt="" loading="lazy" />
            </span>
            <span
              class="hero__bar"
              :style="{ animationPlayState: playing && !hovering ? 'running' : 'paused' }"
            />
          </button>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  isolation: isolate;
  min-height: clamp(520px, 78vh, 760px);
  display: grid;
  align-items: end;
  overflow: hidden;
  border-bottom: 1px solid var(--a-line);
}
.hero__stage,
.hero__slide,
.hero__slide img,
.hero__shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.hero__slide {
  opacity: 0;
  transition: opacity 0.9s ease;
}
.hero__slide.is-on {
  opacity: 1;
}
.hero__slide img {
  object-fit: cover;
  transform: scale(1.04);
}
.hero__slide.is-on img {
  animation: kb 9s ease-out forwards;
}
@keyframes kb {
  to {
    transform: scale(1.12);
  }
}
.hero__shade {
  background:
    linear-gradient(to top, var(--a-bg) 4%, rgb(12 10 9 / 0.72) 34%, rgb(12 10 9 / 0.1) 72%),
    linear-gradient(to right, rgb(12 10 9 / 0.75), rgb(12 10 9 / 0) 62%);
}
.hero__copy {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 14px;
  max-width: 760px;
  padding: 120px var(--a-pad) 176px;
  margin: 0 auto 0 max(0px, calc((100vw - var(--a-max)) / 2));
  animation: rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
}
.hero__tag {
  justify-self: start;
  padding: 5px 14px;
  border-radius: 999px;
  background: #b72a1a;
  color: #fff;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
}
.hero__genre {
  color: var(--a-gold);
}
.hero__title {
  font-size: clamp(48px, 8.4vw, 112px);
  line-height: 0.96;
  color: var(--a-cream);
  text-wrap: balance;
}
.hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 22px;
  color: var(--a-ink);
}
.hero__meta span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.hero__cta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 22px;
  margin-top: 6px;
}
.hero__btn {
  min-height: 52px;
  padding: 0 32px;
}
.hero__price {
  color: var(--a-gold);
  font-weight: 700;
}
.hero__nav {
  position: absolute;
  z-index: 2;
  right: var(--a-pad);
  bottom: 84px; /* ruang aman di atas filter bar */
  display: flex;
  align-items: center;
  gap: 14px;
}
.hero__pp {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--a-line-strong);
  background: rgb(12 10 9 / 0.6);
  color: var(--a-gold);
  cursor: pointer;
}
.hero__dots {
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.hero__dot {
  position: relative;
  display: grid;
  gap: 6px;
  width: 64px;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.hero__dot:hover,
.hero__dot.is-on {
  opacity: 1;
}
.hero__thumb {
  display: block;
  aspect-ratio: 4 / 3;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--a-line-strong);
  background: var(--a-bg3);
}
.hero__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.hero__bar {
  height: 3px;
  border-radius: 3px;
  background: rgb(239 229 207 / 0.25);
  position: relative;
  overflow: hidden;
}
.hero__dot.is-on .hero__bar::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--a-gold);
  transform-origin: left;
  animation: fill 6.5s linear forwards;
  animation-play-state: inherit;
}
@keyframes fill {
  from {
    transform: scaleX(0);
  }
}
@media (max-width: 720px) {
  .hero {
    min-height: 640px;
  }
  .hero__copy {
    padding-bottom: 190px;
  }
  .hero__nav {
    left: var(--a-pad);
    justify-content: space-between;
  }
  .hero__dot {
    width: 44px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hero__slide.is-on img,
  .hero__copy {
    animation: none !important;
  }
}
</style>
