<script setup lang="ts">
import { ChevronRight, MapPin } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { TicketBrief } from '@/api/account'
import EventThumb from '@/components/app/EventThumb.vue'
import { formatEventDate } from '@/utils/format'

// Kartu tiket bergaya tiket: poster, blok tanggal, hitung mundur manusiawi, status jelas, satu aksi utama.
const props = defineProps<{ ticket: TicketBrief }>()
const { t, locale } = useI18n()
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const start = computed(() => new Date(props.ticket.starts_at))
const day = computed(() =>
  new Intl.DateTimeFormat(bcp.value, { day: '2-digit', timeZone: props.ticket.tz }).format(
    start.value,
  ),
)
const month = computed(() =>
  new Intl.DateTimeFormat(bcp.value, { month: 'short', timeZone: props.ticket.tz }).format(
    start.value,
  ),
)
const live = computed(() => ['valid', 'active'].includes(props.ticket.status))
const past = computed(() => start.value.getTime() < Date.now() - 6 * 3_600_000)
const left = computed(() => {
  const ms = start.value.getTime() - Date.now()
  if (!live.value || past.value) return ''
  if (ms <= 0) return t('ov.now')
  const d = Math.floor(ms / 86_400_000)
  return d === 0 ? t('ov.today') : d === 1 ? t('ov.tomorrow') : t('ov.inDays', { n: d })
})
</script>

<template>
  <article class="tc" :class="{ 'is-off': !live || past }" data-test="ticket-card">
    <EventThumb
      :src="ticket.poster_url"
      :title="ticket.event_title"
      :w="88"
      :h="110"
      class="tc__poster"
    />
    <div class="tc__date" aria-hidden="true">
      <strong>{{ day }}</strong>
      <small>{{ month }}</small>
    </div>
    <div class="tc__body">
      <h3>{{ ticket.event_title }}</h3>
      <p class="tc__meta">{{ formatEventDate(ticket.starts_at, ticket.tz, bcp) }}</p>
      <p class="tc__meta">
        <NIcon :component="MapPin" :size="14" aria-hidden="true" /> {{ ticket.venue_name }}
      </p>
      <p class="tc__meta">
        {{ ticket.seat_label || ticket.tier_name
        }}<template v-if="ticket.attendee_name"> · {{ ticket.attendee_name }}</template>
      </p>
      <p class="tc__chips">
        <span v-if="left" class="tc__left">{{ left }}</span>
        <span class="ac__badge" :class="live ? 'is-paid' : 'is-bad'">{{
          t(`tk.s.${ticket.status}`, ticket.status)
        }}</span>
      </p>
    </div>
    <RouterLink
      class="a-pill a-pill--solid tc__open"
      :to="{ name: 'ticket', params: { id: ticket.id } }"
      data-test="open-ticket"
    >
      {{ t('tk.open') }}
      <NIcon :component="ChevronRight" :size="16" aria-hidden="true" />
    </RouterLink>
  </article>
</template>

<style scoped>
.tc {
  position: relative;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 16px 18px;
  border: 1px solid var(--a-line);
  border-radius: 18px;
  background: var(--a-panel);
}
.tc.is-off {
  opacity: 0.72;
}
.tc__date {
  display: grid;
  place-items: center;
  min-width: 62px;
  padding: 10px 8px;
  border-radius: 14px;
  background: var(--a-gold);
  color: var(--a-on-gold, var(--a-bg));
  line-height: 1;
  text-align: center;
}
.tc__date strong {
  font: 700 30px/1 var(--a-serif, serif);
}
.tc__date small {
  margin-top: 4px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.tc__body {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.tc__body h3 {
  margin: 0;
  font-size: 19px;
  color: var(--a-cream);
  overflow-wrap: anywhere;
}
.tc__meta {
  margin: 0;
  color: var(--a-muted);
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.tc__chips {
  margin: 6px 0 0;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.tc__left {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--a-gold);
  color: var(--a-gold);
}
@media (max-width: 640px) {
  .tc {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'poster body'
      'open open';
    gap: 12px 14px;
  }
  .tc__poster {
    grid-area: poster;
    width: 76px !important;
    height: 96px !important;
  }
  .tc__date {
    position: absolute;
    top: 10px;
    left: 10px;
    min-width: 44px;
    padding: 6px 6px;
    border-radius: 10px;
  }
  .tc__date strong {
    font-size: 20px;
  }
  .tc__body {
    grid-area: body;
  }
  .tc__open {
    grid-area: open;
    justify-content: center;
  }
}
</style>
