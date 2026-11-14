<script setup lang="ts">
import { useHead } from '@unhead/vue'
import {
  Copy,
  PlayerPause,
  PlayerPlay,
  CalendarEvent,
  CalendarOff,
  AlertTriangle,
} from '@vicons/tabler'
import { NIcon, NInput, useMessage } from 'naive-ui'
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import {
  cancelEvent,
  duplicateEvent,
  pauseSales,
  postponeEvent,
  rescheduleEvent,
  resumeSales,
} from '@/api/organizer'
import { ORG_EVENT } from '@/components/dash/orgEventCtx'
import SideSheet from '@/components/dash/SideSheet.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { formatRupiah } from '@/utils/format'

// Kontrol event: tindakan yang mengubah penjualan/jadwal. Yang berdampak ke pembeli selalu menampilkan
// dampaknya dulu (docs/24 §3.7) dan yang tak bisa dibatalkan (batal event) meminta mengetik nama event.
const { t, locale } = useI18n()
useHead({ title: computed(() => t('dash.event.tab.control')) })
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const ctx = inject(ORG_EVENT)!
const ev = computed(() => ctx.ev.value)
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const rp = (n: number) => formatRupiah(n, bcp.value)

type Act = '' | 'pause' | 'reschedule' | 'postpone' | 'cancel' | 'duplicate'
const act = ref<Act>('')
const open = computed({
  get: () => act.value !== '',
  set: (v) => {
    if (!v) act.value = ''
  },
})
const busy = ref(false)

const status = computed(() => ev.value?.status ?? '')
const live = computed(() => status.value === 'published')
const paused = computed(() => status.value === 'paused')
const sellable = computed(() => live.value || paused.value)

// dampak: tiket yang sudah terjual dan nilainya (dari data kategori yang sama dengan halaman Penjualan)
const sold = computed(() => (ev.value?.tiers ?? []).reduce((a, k) => a + k.sold, 0))
const gross = computed(() => (ev.value?.tiers ?? []).reduce((a, k) => a + k.sold * k.price, 0))

const reason = ref('')
const startsAt = ref('')
const endsAt = ref('')
const typed = ref('')
const dupTitle = ref('')

function start(a: Act): void {
  act.value = a
  reason.value = ''
  typed.value = ''
  endsAt.value = ''
  startsAt.value = ''
  dupTitle.value = ev.value ? `${ev.value.title} (salinan)` : ''
}
const iso = (v: string): string | undefined => (v ? new Date(v).toISOString() : undefined)
const future = (v: string): boolean => !!v && new Date(v).getTime() > Date.now()

const ok = computed(() => {
  switch (act.value) {
    case 'pause':
      return reason.value.trim().length >= 3
    case 'reschedule':
      return (
        future(startsAt.value) &&
        (!endsAt.value || new Date(endsAt.value) > new Date(startsAt.value))
      )
    case 'postpone':
      return true
    case 'cancel':
      return (
        reason.value.trim().length >= 5 &&
        typed.value.trim().toLowerCase() === (ev.value?.title ?? '').trim().toLowerCase()
      )
    case 'duplicate':
      return future(startsAt.value)
    default:
      return false
  }
})

async function run(): Promise<void> {
  if (!ev.value || !ok.value || busy.value) return
  busy.value = true
  const id = ev.value.id
  try {
    if (act.value === 'pause') await pauseSales(id, reason.value.trim())
    else if (act.value === 'reschedule')
      await rescheduleEvent(id, { starts_at: iso(startsAt.value)!, ends_at: iso(endsAt.value) })
    else if (act.value === 'postpone') await postponeEvent(id)
    else if (act.value === 'cancel') await cancelEvent(id, reason.value.trim())
    else if (act.value === 'duplicate') {
      const copy = await duplicateEvent(id, {
        title: dupTitle.value.trim() || undefined,
        starts_at: iso(startsAt.value)!,
      })
      message.success(t('dash.event.ctl.done.duplicate'))
      act.value = ''
      await router.push({ name: 'org-event', params: { id: copy.id } })
      return
    }
    message.success(t(`dash.event.ctl.done.${act.value}`))
    act.value = ''
    await ctx.reload()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
async function resume(): Promise<void> {
  if (!ev.value || busy.value) return
  busy.value = true
  try {
    await resumeSales(ev.value.id)
    message.success(t('dash.event.ctl.done.resume'))
    await ctx.reload()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="ev" data-test="org-control">
    <p v-if="!sellable" class="note" data-test="ctl-locked">{{ t('dash.event.ctl.locked') }}</p>

    <section class="grp">
      <h2 class="a-serif grp__t">{{ t('dash.event.ctl.sales') }}</h2>
      <article class="row">
        <span class="row__ic"
          ><NIcon :component="paused ? PlayerPlay : PlayerPause" :size="22" aria-hidden="true"
        /></span>
        <div class="row__m">
          <strong>{{ paused ? t('dash.event.ctl.resume') : t('dash.event.ctl.pause') }}</strong>
          <p class="a-muted">
            {{ paused ? t('dash.event.ctl.resumeB') : t('dash.event.ctl.pauseB') }}
          </p>
        </div>
        <button
          v-if="paused"
          type="button"
          class="a-pill a-pill--solid"
          :disabled="busy"
          :aria-busy="busy"
          data-test="ctl-resume"
          @click="resume"
        >
          {{ t('dash.event.ctl.resumeGo') }}
        </button>
        <button
          v-else
          type="button"
          class="a-pill"
          :disabled="!live"
          data-test="ctl-pause"
          @click="start('pause')"
        >
          {{ t('dash.event.ctl.pauseGo') }}
        </button>
      </article>
    </section>

    <section class="grp">
      <h2 class="a-serif grp__t">{{ t('dash.event.ctl.schedule') }}</h2>
      <article class="row">
        <span class="row__ic"
          ><NIcon :component="CalendarEvent" :size="22" aria-hidden="true"
        /></span>
        <div class="row__m">
          <strong>{{ t('dash.event.ctl.reschedule') }}</strong>
          <p class="a-muted">{{ t('dash.event.ctl.rescheduleB') }}</p>
        </div>
        <button
          type="button"
          class="a-pill"
          :disabled="!sellable"
          data-test="ctl-reschedule"
          @click="start('reschedule')"
        >
          {{ t('dash.event.ctl.change') }}
        </button>
      </article>
      <article class="row">
        <span class="row__ic"
          ><NIcon :component="CalendarOff" :size="22" aria-hidden="true"
        /></span>
        <div class="row__m">
          <strong>{{ t('dash.event.ctl.postpone') }}</strong>
          <p class="a-muted">{{ t('dash.event.ctl.postponeB') }}</p>
        </div>
        <button
          type="button"
          class="a-pill"
          :disabled="!sellable"
          data-test="ctl-postpone"
          @click="start('postpone')"
        >
          {{ t('dash.event.ctl.postponeGo') }}
        </button>
      </article>
    </section>

    <section class="grp">
      <h2 class="a-serif grp__t">{{ t('dash.event.ctl.more') }}</h2>
      <article class="row">
        <span class="row__ic"><NIcon :component="Copy" :size="22" aria-hidden="true" /></span>
        <div class="row__m">
          <strong>{{ t('dash.event.ctl.duplicate') }}</strong>
          <p class="a-muted">{{ t('dash.event.ctl.duplicateB') }}</p>
        </div>
        <button type="button" class="a-pill" data-test="ctl-duplicate" @click="start('duplicate')">
          {{ t('dash.event.ctl.duplicateGo') }}
        </button>
      </article>
    </section>

    <section class="grp danger">
      <h2 class="a-serif grp__t">{{ t('dash.event.ctl.danger') }}</h2>
      <article class="row row--danger">
        <span class="row__ic"
          ><NIcon :component="AlertTriangle" :size="22" aria-hidden="true"
        /></span>
        <div class="row__m">
          <strong>{{ t('dash.event.ctl.cancel') }}</strong>
          <p class="a-muted">{{ t('dash.event.ctl.cancelB') }}</p>
        </div>
        <button
          type="button"
          class="a-pill danger-btn"
          :disabled="!sellable"
          data-test="ctl-cancel"
          @click="start('cancel')"
        >
          {{ t('dash.event.ctl.cancelGo') }}
        </button>
      </article>
    </section>

    <SideSheet v-model:show="open" :title="act ? t(`dash.event.ctl.sheet.${act}`) : ''">
      <div v-if="act" class="sh" data-test="ctl-sheet">
        <p class="sh__lead">{{ t(`dash.event.ctl.lead.${act}`) }}</p>

        <aside
          v-if="act === 'cancel' || act === 'postpone' || act === 'reschedule'"
          class="impact"
          :class="{ 'is-bad': act === 'cancel' }"
          data-test="ctl-impact"
        >
          <strong>{{ t('dash.event.ctl.impact') }}</strong>
          <p v-if="act === 'cancel'">
            {{ t('dash.event.ctl.impactCancel', { n: sold, total: rp(gross) }) }}
          </p>
          <p v-else-if="act === 'postpone'">
            {{ t('dash.event.ctl.impactPostpone', { n: sold }) }}
          </p>
          <p v-else>{{ t('dash.event.ctl.impactReschedule', { n: sold }) }}</p>
        </aside>

        <template v-if="act === 'pause' || act === 'cancel'">
          <label class="f" for="ctl-reason">{{
            t(act === 'cancel' ? 'dash.event.ctl.reasonCancel' : 'dash.event.ctl.reasonPause')
          }}</label>
          <NInput
            id="ctl-reason"
            v-model:value="reason"
            type="textarea"
            :maxlength="500"
            show-count
            :autosize="{ minRows: 2, maxRows: 5 }"
            data-test="ctl-reason"
          />
          <small class="a-muted">{{
            t(
              act === 'cancel'
                ? 'dash.event.ctl.reasonCancelHint'
                : 'dash.event.ctl.reasonPauseHint',
            )
          }}</small>
        </template>

        <template v-if="act === 'reschedule' || act === 'duplicate'">
          <template v-if="act === 'duplicate'">
            <label class="f" for="ctl-title">{{ t('dash.event.ctl.newTitle') }}</label>
            <NInput id="ctl-title" v-model:value="dupTitle" :maxlength="160" />
          </template>
          <label class="f" for="ctl-start">{{ t('dash.event.ctl.newStart') }}</label>
          <input
            id="ctl-start"
            v-model="startsAt"
            type="datetime-local"
            class="dt"
            data-test="ctl-start"
          />
          <small v-if="startsAt && !future(startsAt)" class="bad" role="alert">{{
            t('dash.event.ctl.mustFuture')
          }}</small>
          <template v-if="act === 'reschedule'">
            <label class="f" for="ctl-end">{{ t('dash.event.ctl.newEnd') }}</label>
            <input id="ctl-end" v-model="endsAt" type="datetime-local" class="dt" />
          </template>
        </template>

        <template v-if="act === 'cancel'">
          <label class="f" for="ctl-typed">{{
            t('dash.event.ctl.typeName', { title: ev.title })
          }}</label>
          <NInput
            id="ctl-typed"
            v-model:value="typed"
            :placeholder="ev.title"
            data-test="ctl-typed"
          />
        </template>
      </div>
      <template v-if="act" #footer>
        <div class="dec">
          <button
            type="button"
            class="a-pill a-pill--solid"
            :class="{ 'danger-solid': act === 'cancel' }"
            :disabled="!ok || busy"
            :aria-busy="busy"
            data-test="ctl-run"
            @click="run"
          >
            {{ t(`dash.event.ctl.run.${act}`) }}
          </button>
          <button type="button" class="a-pill" :disabled="busy" @click="act = ''">
            {{ t('org.cancel') }}
          </button>
        </div>
      </template>
    </SideSheet>
  </div>
</template>

<style scoped>
.note {
  margin: 0 0 18px;
  padding: 12px 14px;
  border: 1px dashed var(--a-line-strong);
  border-radius: 14px;
  color: var(--a-muted);
  font-size: 14px;
}
.grp {
  display: grid;
  gap: 10px;
  margin-bottom: 26px;
}
.grp__t {
  margin: 0;
  color: var(--a-cream);
  font-size: 22px;
}
.row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px 14px;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
}
.row > .a-pill {
  grid-column: 1 / -1;
  justify-self: start;
}
.row__ic {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgb(224 178 94 / 0.14);
  color: var(--a-gold);
}
.row__m p {
  margin: 2px 0 0;
  font-size: 14px;
}
.row--danger {
  border-color: color-mix(in srgb, var(--a-danger) 45%, transparent);
}
.row--danger .row__ic {
  background: color-mix(in srgb, var(--a-danger) 14%, transparent);
  color: var(--a-danger);
}
.danger-btn {
  border-color: var(--a-danger);
  color: var(--a-danger);
}
.danger-btn:hover:not(:disabled) {
  background: var(--a-danger);
  color: var(--a-bg);
}
:deep(.danger-solid) {
  background: var(--a-danger);
  border-color: var(--a-danger);
  color: var(--a-bg);
}
.sh {
  display: grid;
  gap: 10px;
}
.sh__lead {
  margin: 0;
}
.impact {
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid var(--a-line-strong);
  border-radius: 14px;
  background: rgb(224 178 94 / 0.1);
  font-size: 14px;
}
.impact.is-bad {
  border-color: var(--a-danger);
  background: color-mix(in srgb, var(--a-danger) 10%, transparent);
}
.impact p {
  margin: 0;
}
.f {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
}
.dt {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--a-line-strong);
  border-radius: 12px;
  background: var(--a-bg);
  color: var(--a-ink);
  font: inherit;
}
.bad {
  color: var(--a-danger);
}
.dec {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
@media (min-width: 720px) {
  .row {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .row > .a-pill {
    grid-column: auto;
    justify-self: end;
  }
}
</style>
