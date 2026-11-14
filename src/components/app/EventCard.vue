<script setup lang="ts">
import { Clock, Flame, Lock, MapPin, Ticket } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import type { EventCard } from '@/api/events'
import FavoriteButton from '@/components/app/FavoriteButton.vue'
import { dateBlock, formatRupiah } from '@/utils/format'
import { fallbackCover } from '@/utils/fallbackCover'
import { mediaAt, mediaSrcset } from '@/utils/media'

const props = defineProps<{
  event: EventCard
  to?: RouteLocationRaw
  /** lg = kartu unggulan lebar (bento). */
  size?: 'md' | 'lg'
  /** Dimuat segera (di atas lipatan) tanpa lazy. */
  eager?: boolean
}>()
const { t, locale } = useI18n()

const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const block = computed(() => dateBlock(props.event.starts_at, props.event.tz, bcp.value))
const price = computed(() =>
  props.event.min_final_price == null ? null : formatRupiah(props.event.min_final_price, bcp.value),
)
const soldOut = computed(() => ['sold_out', 'full_booked'].includes(props.event.sale_state))
const badge = computed(() => {
  const s = props.event.sale_state
  if (s === 'onsale' && props.event.almost_gone)
    return { tone: 'hot', icon: Flame, text: t('events.almostGone') }
  if (s === 'onsale' && props.event.queue_required)
    return { tone: 'queue', icon: Ticket, text: t('events.queue') }
  if (s === 'upcoming') return { tone: s, icon: Clock, text: t(`events.state.${s}`, s) }
  if (soldOut.value) return { tone: s, icon: Lock, text: t(`events.state.${s}`, s) }
  return { tone: s, icon: Ticket, text: t(`events.state.${s}`, s) }
})
const src = computed(() => mediaAt(props.event.poster_url, 800) ?? fallbackCover(props.event.slug))
const srcset = computed(() => mediaSrcset(props.event.poster_url))
</script>

<template>
  <article
    class="ev"
    :class="[`ev--${size ?? 'md'}`, { 'is-off': soldOut }]"
    data-test="event-card"
  >
    <div class="ev__art">
      <img
        v-if="src"
        :src="src"
        :srcset="srcset"
        :sizes="size === 'lg' ? '(min-width: 900px) 640px, 92vw' : '(min-width: 900px) 330px, 46vw'"
        :loading="eager ? 'eager' : 'lazy'"
        :fetchpriority="eager ? 'high' : undefined"
        decoding="async"
        :alt="t('events.posterAlt', { title: event.title })"
      />
      <span v-else class="a-serif ev__ph" aria-hidden="true">{{ event.title.slice(0, 1) }}</span>
      <span class="ev__badge" :data-tone="badge.tone"
        ><NIcon :component="badge.icon" :size="13" aria-hidden="true" />{{ badge.text }}</span
      >
      <FavoriteButton class="ev__fav" :event-id="event.id" :title="event.title" />
    </div>

    <div class="ev__body">
      <p class="ev__when">
        <span class="ev__day">{{ block.day }} {{ block.month }}</span>
        <span class="ev__dot" aria-hidden="true" />
        <span class="ev__genre">{{ event.genre ?? t('events.genreNone') }}</span>
      </p>
      <h3 class="ev__title">
        <RouterLink v-if="to" :to="to" class="ev__link">{{ event.title }}</RouterLink>
        <template v-else>{{ event.title }}</template>
      </h3>
      <p class="ev__where">
        <NIcon :component="MapPin" :size="15" aria-hidden="true" />
        <span>{{ event.venue_name }}, {{ event.city }}</span>
      </p>
      <p class="ev__foot">
        <span v-if="soldOut" class="ev__price ev__price--off">{{
          t('events.state.sold_out')
        }}</span>
        <span v-else-if="price" class="ev__price">
          <small>{{ t('events.fromLabel') }}</small> {{ price }}
        </span>
      </p>
    </div>
  </article>
</template>

<style scoped>
/* Kartu: poster di atas, info di bawah permukaan panel. Semua warna lewat token (terang dan gelap). */
.ev {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  height: 100%;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
  color: var(--a-ink);
  transition:
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.2s ease;
}
.ev:hover,
.ev:focus-within {
  transform: translateY(-3px);
  border-color: var(--a-line-strong);
  box-shadow: var(--a-shadow);
}
.ev__art {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--a-bg2);
}
.ev--lg .ev__art {
  aspect-ratio: 4 / 3;
}
@media (min-width: 900px) {
  .ev--lg .ev__art {
    aspect-ratio: 16 / 9;
  }
}
.ev__art img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.ev:hover .ev__art img {
  transform: scale(1.04);
}
.is-off .ev__art img {
  filter: grayscale(0.85) brightness(0.8);
}
.ev__ph {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 96px;
  color: var(--a-gold);
  opacity: 0.6;
}
.ev__badge {
  position: absolute;
  left: 12px;
  top: 12px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgb(15 14 12 / 0.78);
  color: #f1ebdd;
  backdrop-filter: blur(6px);
}
.ev__badge[data-tone='hot'] {
  background: #b72a1a;
  color: #fff;
}
.ev__badge[data-tone='queue'] {
  background: #e0b25e;
  color: #1c1812;
}
.ev__fav {
  position: absolute;
  right: 10px;
  top: 10px;
}
.ev__body {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 14px 16px 16px;
}
.ev__when {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--a-gold);
}
.ev__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--a-muted);
}
.ev__genre {
  color: var(--a-muted);
  font-weight: 600;
}
.ev__title {
  margin: 0;
  font-family: var(--a-sans);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--a-cream);
  text-wrap: balance;
}
.ev--lg .ev__title {
  font-size: 22px;
}
.ev__link {
  color: inherit;
  text-decoration: none;
  padding-block: 4px;
}
.ev__link::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1; /* seluruh kartu bisa diklik; tombol favorit tetap di atas */
}
.ev__link:focus-visible {
  outline: none;
}
.ev:has(.ev__link:focus-visible) {
  outline: 2px solid var(--a-gold);
  outline-offset: 3px;
}
.ev__fav {
  z-index: 2;
}
.ev__where {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 14px;
  color: var(--a-muted);
}
.ev__where svg {
  flex: none;
  margin-top: 3px;
}
.ev__foot {
  margin-top: 4px;
}
.ev__price {
  font-weight: 700;
  color: var(--a-ink);
}
.ev__price small {
  font-weight: 500;
  color: var(--a-muted);
  margin-right: 4px;
}
.ev__price--off {
  color: var(--a-muted);
}
@media (prefers-reduced-motion: reduce) {
  .ev,
  .ev__art img {
    transition: none;
  }
  .ev:hover,
  .ev:focus-within,
  .ev:hover .ev__art img {
    transform: none;
  }
}
</style>
