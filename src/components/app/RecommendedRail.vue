<script setup lang="ts">
import { Bell, BellRinging, EyeOff, Share, Ticket } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { getRecommendations } from '@/api/discover'
import { listEvents, removeReminder, setReminder, type EventCard as EventCardT } from '@/api/events'
import { useApiMessage } from '@/composables/useApiMessage'
import { useRequireLogin } from '@/composables/useRequireLogin'
import { useAuthStore } from '@/stores/auth'

import ErrorState from './ErrorState.vue'
import EventCard from './EventCard.vue'
import EventCardSkeleton from './EventCardSkeleton.vue'
import EventRail from './EventRail.vue'

// "Mungkin kamu suka": rekomendasi BE (dari yang diikuti + riwayat) dilengkapi konser populer agar tidak pernah
// sepi. Tiap kartu punya aksi: favorit (di kartu), ingatkan, bagikan, sembunyikan. Tamu melihat "Lagi ramai".
const props = withDefaults(defineProps<{ limit?: number }>(), { limit: 12 })
const { t } = useI18n()
const auth = useAuthStore()
const message = useMessage()
const apiMessage = useApiMessage()
const requireLogin = useRequireLogin()

interface Item {
  event: EventCardT
  reason: string
}
const items = ref<Item[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const personal = ref(false)

// Disimpan di perangkat: BE belum punya "tidak tertarik" dan status pengingat tidak bisa dibaca.
const HID = 'tixgo.rec-hidden.v1'
// Sama dengan TicketPanel: daftar slug per akun, agar status pengingat konsisten di semua halaman.
const remKey = () => `tixgo.remind.${auth.user?.id ?? 'tamu'}`
const readSet = (k: string): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(k) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
const writeSet = (k: string, s: Set<string>): void => {
  try {
    localStorage.setItem(k, JSON.stringify([...s].slice(-200)))
  } catch {
    /* mode privat: berlaku untuk sesi ini */
  }
}
const hidden = ref(readSet(HID))
const reminded = ref(readSet(remKey()))
watch(
  () => auth.user?.id,
  () => (reminded.value = readSet(remKey())),
)

const buyable = (e: EventCardT) => ['onsale', 'upcoming'].includes(e.sale_state)
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    if (!auth.ready) await auth.restore()
    const recs = auth.isAuthed ? await getRecommendations().catch(() => []) : []
    const popular = (await listEvents({ sort: 'popular', per_page: 30 })).data
    const seen = new Set<string>()
    const out: Item[] = []
    for (const r of recs) {
      if (buyable(r.event) && !seen.has(r.event.id)) {
        seen.add(r.event.id)
        out.push({ event: r.event, reason: r.reasons[0] ?? '' })
      }
    }
    personal.value = out.length > 0
    for (const e of popular) {
      if (buyable(e) && !seen.has(e.id)) {
        seen.add(e.id)
        out.push({
          event: e,
          reason: e.almost_gone ? t('rec.reasonAlmost') : t('rec.reasonPopular'),
        })
      }
    }
    items.value = out
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)
watch(() => auth.isAuthed, load)

const shown = computed(() =>
  items.value.filter((i) => !hidden.value.has(i.event.id)).slice(0, props.limit),
)

async function remind(e: EventCardT): Promise<void> {
  if (!(await requireLogin('rec.needLogin'))) return
  const on = reminded.value.has(e.slug)
  try {
    if (on) await removeReminder(e.slug)
    else await setReminder(e.slug)
    const next = new Set(reminded.value)
    if (on) next.delete(e.slug)
    else next.add(e.slug)
    reminded.value = next
    writeSet(remKey(), next)
    message.success(t(on ? 'tickets.reminderOff' : 'tickets.reminderOn'))
  } catch (ex) {
    message.error(apiMessage(ex))
  }
}
async function share(e: EventCardT): Promise<void> {
  const url = `${location.origin}/events/${e.slug}`
  try {
    if (navigator.share) await navigator.share({ title: e.title, url })
    else {
      await navigator.clipboard.writeText(url)
      message.success(t('rec.copied'))
    }
  } catch (ex) {
    if ((ex as DOMException).name !== 'AbortError') message.error(t('rec.shareFail'))
  }
}
function hide(e: EventCardT): void {
  const next = new Set(hidden.value).add(e.id)
  hidden.value = next
  writeSet(HID, next)
  message.info(t('rec.hidden'))
}
function resetHidden(): void {
  hidden.value = new Set()
  writeSet(HID, new Set())
}
</script>

<template>
  <section v-if="state !== 'ok' || shown.length || hidden.size" class="rec" data-test="recommended">
    <ErrorState v-if="state === 'error'" :message="err" @retry="load" />
    <div
      v-else-if="state === 'loading'"
      class="rec__sk"
      role="status"
      :aria-label="t('common.loading')"
    >
      <EventCardSkeleton v-for="n in 4" :key="n" />
    </div>
    <EventRail
      v-else-if="shown.length"
      :kicker="personal ? t('rec.kickerPersonal') : t('rec.kickerGuest')"
      :title="personal ? t('rec.title') : t('rec.titleGuest')"
      :to="{ name: 'events', query: { koleksi: 'all', sort: 'popular' } }"
    >
      <li v-for="i in shown" :key="i.event.id" class="rec__item" data-test="rec-item">
        <EventCard :event="i.event" :to="{ name: 'event', params: { slug: i.event.slug } }" />
        <p class="rec__why" data-test="rec-reason">{{ i.reason }}</p>
        <div class="rec__acts">
          <button
            v-if="i.event.sale_state === 'upcoming'"
            type="button"
            class="rec__btn"
            :aria-pressed="reminded.has(i.event.slug)"
            data-test="rec-remind"
            @click="remind(i.event)"
          >
            <NIcon
              :component="reminded.has(i.event.slug) ? BellRinging : Bell"
              :size="16"
              aria-hidden="true"
            />
            {{ reminded.has(i.event.slug) ? t('rec.reminded') : t('rec.remind') }}
          </button>
          <RouterLink
            v-else
            :to="{ name: 'event', params: { slug: i.event.slug } }"
            class="rec__btn rec__btn--buy"
            data-test="rec-buy"
          >
            <NIcon :component="Ticket" :size="16" aria-hidden="true" /> {{ t('rec.buy') }}
          </RouterLink>
          <button type="button" class="rec__btn" data-test="rec-share" @click="share(i.event)">
            <NIcon :component="Share" :size="16" aria-hidden="true" /> {{ t('rec.share') }}
          </button>
          <button
            type="button"
            class="rec__btn"
            data-test="rec-hide"
            :aria-label="t('rec.hide')"
            @click="hide(i.event)"
          >
            <NIcon :component="EyeOff" :size="16" aria-hidden="true" />
          </button>
        </div>
      </li>
    </EventRail>
    <p v-if="state === 'ok' && hidden.size" class="rec__reset">
      {{ t('rec.hiddenN', { n: hidden.size }) }}
      <button type="button" class="rec__link" data-test="rec-reset" @click="resetHidden">
        {{ t('rec.showAgain') }}
      </button>
    </p>
  </section>
</template>

<style scoped>
.rec {
  display: grid;
  grid-template-columns: minmax(
    0,
    1fr
  ); /* tanpa ini kolom melebar mengikuti isi geser dan mendorong "Lihat semua" keluar layar */
  gap: 10px;
}
.rec__sk {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
.rec__item {
  flex-direction: column;
  gap: 8px;
}
.rec__why {
  margin: 0;
  color: var(--a-muted);
  font-size: 13px;
  line-height: 1.35;
  min-height: 2.7em;
}
.rec__acts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.rec__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--a-line-strong);
  background: transparent;
  color: var(--a-ink);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.rec__btn:hover,
.rec__btn:focus-visible {
  border-color: var(--a-gold);
}
.rec__btn--buy {
  background: var(--a-gold);
  color: var(--a-on-gold);
  border-color: var(--a-gold);
  text-decoration: none;
}
.rec__btn[aria-pressed='true'] {
  background: var(--a-gold);
  color: var(--a-on-gold);
  border-color: var(--a-gold);
}
.rec__reset {
  margin: 0;
  color: var(--a-muted);
  font-size: 14px;
}
.rec__link {
  background: none;
  border: 0;
  padding: 0;
  color: var(--a-gold-d, var(--a-gold));
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
</style>
