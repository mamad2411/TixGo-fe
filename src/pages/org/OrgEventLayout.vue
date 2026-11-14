<script setup lang="ts">
import { ArrowLeft, CircleCheck, CircleDashed } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { getOrgEvent, type OrgEvent } from '@/api/organizer'
import ErrorState from '@/components/app/ErrorState.vue'
import EventThumb from '@/components/app/EventThumb.vue'
import { ORG_EVENT } from '@/components/dash/orgEventCtx'
import StatusTag from '@/components/dash/StatusTag.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { formatEventDate } from '@/utils/format'

// Workspace satu event: kepala (poster, status, kesiapan) + tab Detail / Penjualan / Peserta.
const { t, locale } = useI18n()
const route = useRoute()
const apiMessage = useApiMessage()
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const id = computed(() => String(route.params.id))

const ev = ref<OrgEvent | null>(null)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
async function reload(): Promise<void> {
  try {
    ev.value = await getOrgEvent(id.value)
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
watch(
  id,
  () => {
    state.value = 'loading'
    ev.value = null
    void reload()
  },
  { immediate: true },
)
provide(ORG_EVENT, { ev, reload })

// Kesiapan: hal-hal yang membuat event layak diajukan. Tiap butir menunjuk ke tempat memperbaikinya.
const checks = computed(() => {
  const e = ev.value
  if (!e) return []
  return [
    { key: 'poster', ok: !!e.poster_url },
    { key: 'desc', ok: (e.description ?? '').trim().length >= 30 },
    { key: 'venue', ok: !!e.venue },
    { key: 'artist', ok: e.artists.length > 0 },
    { key: 'tier', ok: e.tiers.length > 0 },
    { key: 'date', ok: !!e.starts_at },
  ]
})
const done = computed(() => checks.value.filter((c) => c.ok).length)
const pct = computed(() =>
  checks.value.length ? Math.round((done.value / checks.value.length) * 100) : 0,
)
const tabs = [
  { name: 'org-event', key: 'detail' },
  { name: 'org-event-sales', key: 'sales' },
  { name: 'org-event-attendees', key: 'attendees' },
  { name: 'org-event-promo', key: 'promo' },
  { name: 'org-event-control', key: 'control' },
] as const
</script>

<template>
  <div class="ew" data-test="event-workspace">
    <RouterLink :to="{ name: 'org-events' }" class="ew__back">
      <NIcon :component="ArrowLeft" :size="18" aria-hidden="true" />
      {{ t('dash.event.backToList') }}
    </RouterLink>

    <div
      v-if="state === 'loading'"
      class="ew__sk a-sk"
      role="status"
      :aria-label="t('common.loading')"
    />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="reload" />
    <template v-else-if="ev">
      <header class="ew__head">
        <EventThumb :src="ev.poster_url" :title="ev.title" :w="76" :h="96" />
        <div class="ew__main">
          <div class="ew__row">
            <StatusTag :status="ev.status" data-test="status" />
            <span class="a-muted ew__meta">
              {{ ev.venue?.name
              }}<template v-if="ev.venue">
                · {{ formatEventDate(ev.starts_at, ev.venue.tz, bcp) }}</template
              >
            </span>
          </div>
          <h1 class="a-serif ew__t">{{ ev.title }}</h1>
        </div>
        <details class="ew__ready" :open="done < checks.length">
          <summary>
            <span
              class="ew__ring"
              :style="{ '--p': `${pct}%` }"
              role="img"
              :aria-label="t('dash.event.readyAria', { n: done, m: checks.length })"
            >
              <b>{{ done }}/{{ checks.length }}</b>
            </span>
            <span class="ew__rt">
              <strong>{{ t('dash.event.ready') }}</strong>
              <small class="a-muted">{{
                done === checks.length
                  ? t('dash.event.readyAll')
                  : t('dash.event.readyLeft', { n: checks.length - done })
              }}</small>
            </span>
          </summary>
          <ul class="ew__list">
            <li v-for="c in checks" :key="c.key" :class="{ 'is-ok': c.ok }">
              <NIcon :component="c.ok ? CircleCheck : CircleDashed" :size="17" aria-hidden="true" />
              <span>{{ t(`dash.event.check.${c.key}`) }}</span>
            </li>
          </ul>
        </details>
      </header>

      <nav class="ew__tabs" :aria-label="t('dash.event.tabs')">
        <RouterLink
          v-for="x in tabs"
          :key="x.name"
          :to="{ name: x.name, params: { id } }"
          class="ew__tab"
          :class="{ 'is-on': route.name === x.name }"
          :aria-current="route.name === x.name ? 'page' : undefined"
        >
          {{ t(`dash.event.tab.${x.key}`) }}
        </RouterLink>
      </nav>

      <RouterView />
    </template>
  </div>
</template>

<style scoped>
.ew__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  margin: -8px 0 4px;
  color: var(--a-muted);
  font-size: 14px;
  text-decoration: none;
}
.ew__back:hover {
  color: var(--a-gold);
}
.ew__sk {
  min-height: 160px;
  border-radius: 18px;
}
.ew__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px 18px;
  align-items: center;
  margin-bottom: 18px;
  padding: 16px;
  border: 1px solid var(--a-line);
  border-radius: 20px;
  background: var(--a-panel);
}
.ew__main {
  min-width: 0;
}
.ew__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}
.ew__meta {
  font-size: 13px;
}
.ew__t {
  margin: 6px 0 0;
  color: var(--a-cream);
  font-size: clamp(26px, 4vw, 38px);
  line-height: 1.1;
  overflow-wrap: anywhere;
}
.ew__ready {
  grid-column: 1 / -1;
  border-top: 1px solid var(--a-line);
  padding-top: 12px;
}
.ew__ready summary {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  cursor: pointer;
  list-style: none;
}
.ew__ready summary::-webkit-details-marker {
  display: none;
}
.ew__ring {
  --p: 0%;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: conic-gradient(var(--a-gold) var(--p), var(--a-line) 0);
  position: relative;
}
.ew__ring::before {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  background: var(--a-panel);
}
.ew__ring b {
  position: relative;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.ew__rt {
  display: grid;
  line-height: 1.25;
}
.ew__list {
  display: grid;
  gap: 6px 16px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.ew__list li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--a-muted);
}
.ew__list li.is-ok {
  color: var(--a-ok);
}
.ew__tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--a-line);
  overflow-x: auto;
  scrollbar-width: none;
}
.ew__tab {
  position: relative;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  min-height: 46px;
  padding: 0 16px;
  color: var(--a-muted);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
}
.ew__tab:hover {
  color: var(--a-ink);
}
.ew__tab.is-on {
  color: var(--a-gold);
}
.ew__tab.is-on::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: -1px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--a-gold);
}
@media (min-width: 900px) {
  .ew__head {
    grid-template-columns: auto minmax(0, 1fr) minmax(240px, 300px);
  }
  .ew__ready {
    grid-column: auto;
    border-top: 0;
    border-left: 1px solid var(--a-line);
    padding: 0 0 0 18px;
  }
}
</style>
