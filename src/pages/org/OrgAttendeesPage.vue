<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Download, Search, UserOff } from '@vicons/tabler'
import { watchDebounced } from '@vueuse/core'
import { NIcon, NInput, useMessage } from 'naive-ui'
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { downloadAttendeesCsv, listAttendees, ticketAction, type Attendee } from '@/api/organizer'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import { ORG_EVENT } from '@/components/dash/orgEventCtx'
import SideSheet from '@/components/dash/SideSheet.vue'
import { useApiMessage } from '@/composables/useApiMessage'

const { t, locale } = useI18n()
useHead({ title: computed(() => t('dash.event.tab.attendees')) })
const route = useRoute()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const ctx = inject(ORG_EVENT)!
const id = computed(() => String(route.params.id))
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const when = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat(bcp.value, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso))
    : ''

// Filter hidup di query-string (bisa dibagikan, tombol Kembali jalan).
const q = ref(String(route.query.q ?? ''))
const status = computed(() => String(route.query.status ?? ''))
const tier = computed(() => String(route.query.tier_id ?? ''))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
function setQuery(patch: Record<string, string | undefined>): void {
  const next = { ...route.query, ...patch }
  for (const k of Object.keys(next)) if (!next[k]) delete next[k]
  void router.replace({ query: next })
}
watchDebounced(q, (v) => setQuery({ q: v.trim() || undefined, page: undefined }), { debounce: 300 })
const activeFilters = computed(
  () => [q.value.trim(), status.value, tier.value].filter(Boolean).length,
)

const STATUSES = ['valid', 'used', 'void', 'refunded', 'transferred'] as const
const rows = ref<Attendee[]>([])
const total = ref(0)
const per = ref(25)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
let seq = 0
async function load(): Promise<void> {
  const my = ++seq
  state.value = 'loading'
  try {
    const r = await listAttendees(id.value, {
      q: String(route.query.q ?? ''),
      status: status.value,
      tier_id: tier.value,
      page: page.value,
    })
    if (my !== seq) return
    rows.value = r.data
    total.value = r.meta.total
    per.value = r.meta.per_page
    state.value = 'ok'
  } catch (e) {
    if (my !== seq) return
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
watch(() => route.fullPath, load, { immediate: true })
onBeforeUnmount(() => seq++)
const pages = computed(() => Math.max(1, Math.ceil(total.value / per.value)))
function clearFilters(): void {
  q.value = ''
  void router.replace({ query: {} })
}

const exporting = ref(false)
async function exportCsv(): Promise<void> {
  exporting.value = true
  try {
    await downloadAttendeesCsv(id.value, {
      q: q.value.trim(),
      status: status.value,
      tier_id: tier.value,
    })
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    exporting.value = false
  }
}

// ---- kelola satu tiket ----
const open = ref(false)
const cur = ref<Attendee | null>(null)
const mode = ref<'' | 'rename' | 'reissue' | 'void'>('')
const name = ref('')
const sure = ref(false)
const busy = ref(false)
function manage(a: Attendee): void {
  cur.value = a
  mode.value = ''
  name.value = a.attendee_name ?? ''
  sure.value = false
  open.value = true
}
function choose(m: 'reissue' | 'void'): void {
  mode.value = m
  sure.value = false
}
const actionable = computed(() => cur.value?.status === 'valid')
async function run(): Promise<void> {
  if (!cur.value || !mode.value || busy.value) return
  if (mode.value === 'rename' && name.value.trim().length < 2) return
  if (mode.value !== 'rename' && !sure.value) return
  busy.value = true
  try {
    await ticketAction(
      id.value,
      cur.value.ticket_id,
      mode.value,
      mode.value === 'rename' ? { name: name.value.trim() } : undefined,
    )
    message.success(t(`dash.event.att.done.${mode.value}`))
    open.value = false
    await load()
    void ctx.reload()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
const who = (a: Attendee) => a.attendee_name || a.owner_email
</script>

<template>
  <div data-test="org-attendees">
    <div class="tb" role="search">
      <label class="tb__q">
        <NIcon :component="Search" :size="18" aria-hidden="true" />
        <span class="a-sr">{{ t('dash.event.att.search') }}</span>
        <input
          v-model="q"
          type="search"
          :placeholder="t('dash.event.att.search')"
          data-test="att-search"
        />
      </label>
      <select
        class="a-select"
        :value="status"
        :aria-label="t('dash.event.att.status')"
        data-test="att-status"
        @change="
          setQuery({
            status: ($event.target as HTMLSelectElement).value || undefined,
            page: undefined,
          })
        "
      >
        <option value="">{{ t('dash.event.att.allStatus') }}</option>
        <option v-for="s in STATUSES" :key="s" :value="s">{{ t(`dash.event.att.st.${s}`) }}</option>
      </select>
      <select
        class="a-select"
        :value="tier"
        :aria-label="t('dash.event.att.tier')"
        data-test="att-tier"
        @change="
          setQuery({
            tier_id: ($event.target as HTMLSelectElement).value || undefined,
            page: undefined,
          })
        "
      >
        <option value="">{{ t('dash.event.att.allTier') }}</option>
        <option v-for="k in ctx.ev.value?.tiers ?? []" :key="k.id" :value="k.id">
          {{ k.name }}
        </option>
      </select>
      <button
        type="button"
        class="a-pill a-pill--sm tb__csv"
        :disabled="exporting || !total"
        :aria-busy="exporting"
        data-test="att-csv"
        @click="exportCsv"
      >
        <NIcon :component="Download" :size="17" aria-hidden="true" />
        {{ t('dash.event.att.csv') }}
      </button>
    </div>
    <p class="a-muted tb__sum" aria-live="polite" data-test="att-count">
      {{ t('dash.event.att.count', { n: total }) }}
      <template v-if="activeFilters">
        ·
        <button type="button" class="tb__clear" @click="clearFilters">
          {{ t('dash.event.att.clear') }} ({{ activeFilters }})
        </button>
      </template>
    </p>

    <div
      v-if="state === 'loading'"
      class="a-sk list-sk"
      role="status"
      :aria-label="t('common.loading')"
    />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <EmptyState
      v-else-if="!rows.length"
      :icon="UserOff"
      :title="t(activeFilters ? 'dash.event.att.emptyFilterT' : 'dash.event.att.emptyT')"
      :body="t(activeFilters ? 'dash.event.att.emptyFilterB' : 'dash.event.att.emptyB')"
    >
      <button v-if="activeFilters" type="button" class="a-pill" @click="clearFilters">
        {{ t('dash.event.att.clear') }}
      </button>
    </EmptyState>
    <template v-else>
      <ul class="ls" data-test="att-list">
        <li
          v-for="a in rows"
          :key="a.ticket_id"
          class="ls__row"
          :class="{ 'is-off': a.status !== 'valid' && a.status !== 'used' }"
        >
          <div class="ls__who">
            <strong>{{ who(a) }}</strong>
            <small class="a-muted">{{ a.attendee_name ? a.owner_email : '' }}</small>
          </div>
          <span class="ls__tier"
            >{{ a.tier
            }}<small v-if="a.seat_label || a.entry_number" class="a-muted">
              · {{ a.seat_label || a.entry_number }}</small
            ></span
          >
          <span class="chip" :class="`is-${a.status}`" :data-status="a.status">{{
            t(`dash.event.att.st.${a.status}`, a.status)
          }}</span>
          <small class="ls__in a-muted">{{
            a.checked_in_at
              ? t('dash.event.att.in', { t: when(a.checked_in_at) })
              : t('dash.event.att.issued', { t: when(a.issued_at) })
          }}</small>
          <button
            type="button"
            class="a-pill a-pill--sm ls__go"
            data-test="att-manage"
            @click="manage(a)"
          >
            {{ t('dash.event.att.manage') }}
          </button>
        </li>
      </ul>
      <nav v-if="pages > 1" class="pager" :aria-label="t('events.pager')">
        <button
          type="button"
          class="a-pill a-pill--sm"
          :disabled="page <= 1"
          @click="setQuery({ page: page - 1 > 1 ? String(page - 1) : undefined })"
        >
          {{ t('common.prev') }}
        </button>
        <span class="a-muted">{{ t('events.pageOf', { p: page, n: pages }) }}</span>
        <button
          type="button"
          class="a-pill a-pill--sm"
          :disabled="page >= pages"
          @click="setQuery({ page: String(page + 1) })"
        >
          {{ t('common.next') }}
        </button>
      </nav>
    </template>

    <SideSheet v-model:show="open" :title="cur ? who(cur) : ''">
      <div v-if="cur" class="dt" data-test="att-sheet">
        <dl class="dt__f">
          <div>
            <dt>{{ t('dash.event.att.tier') }}</dt>
            <dd>{{ cur.tier }}</dd>
          </div>
          <div v-if="cur.seat_label || cur.entry_number">
            <dt>{{ t('dash.event.att.seat') }}</dt>
            <dd>{{ cur.seat_label || cur.entry_number }}</dd>
          </div>
          <div>
            <dt>{{ t('dash.event.att.owner') }}</dt>
            <dd>{{ cur.owner_email }}</dd>
          </div>
          <div>
            <dt>{{ t('dash.event.att.status') }}</dt>
            <dd>
              <span class="chip" :class="`is-${cur.status}`">{{
                t(`dash.event.att.st.${cur.status}`, cur.status)
              }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ t('dash.event.att.origin') }}</dt>
            <dd>{{ t(`dash.event.att.or.${cur.origin}`, cur.origin) }}</dd>
          </div>
        </dl>

        <p v-if="!actionable" class="dt__note">{{ t('dash.event.att.noActions') }}</p>
        <div v-else class="acts">
          <button
            type="button"
            class="act"
            :aria-pressed="mode === 'rename'"
            data-test="act-rename"
            @click="mode = 'rename'"
          >
            <strong>{{ t('dash.event.att.rename') }}</strong
            ><small class="a-muted">{{ t('dash.event.att.renameHint') }}</small>
          </button>
          <button
            type="button"
            class="act"
            :aria-pressed="mode === 'reissue'"
            data-test="act-reissue"
            @click="choose('reissue')"
          >
            <strong>{{ t('dash.event.att.reissue') }}</strong
            ><small class="a-muted">{{ t('dash.event.att.reissueHint') }}</small>
          </button>
          <button
            type="button"
            class="act act--danger"
            :aria-pressed="mode === 'void'"
            data-test="act-void"
            @click="choose('void')"
          >
            <strong>{{ t('dash.event.att.void') }}</strong
            ><small class="a-muted">{{ t('dash.event.att.voidHint') }}</small>
          </button>
        </div>

        <div v-if="mode === 'rename'" class="form">
          <label for="att-name">{{ t('dash.event.att.newName') }}</label>
          <NInput id="att-name" v-model:value="name" :maxlength="100" data-test="att-name" />
        </div>
        <label v-else-if="mode" class="sure">
          <input v-model="sure" type="checkbox" data-test="att-sure" />
          <span>{{
            t(mode === 'void' ? 'dash.event.att.sureVoid' : 'dash.event.att.sureReissue')
          }}</span>
        </label>
      </div>
      <template v-if="cur && actionable && mode" #footer>
        <div class="dec">
          <button
            type="button"
            class="a-pill a-pill--solid"
            :disabled="busy || (mode === 'rename' ? name.trim().length < 2 : !sure)"
            :aria-busy="busy"
            data-test="att-run"
            @click="run"
          >
            {{ t(`dash.event.att.run.${mode}`) }}
          </button>
          <button type="button" class="a-pill" :disabled="busy" @click="mode = ''">
            {{ t('org.cancel') }}
          </button>
        </div>
      </template>
    </SideSheet>
  </div>
</template>

<style scoped>
.tb {
  display: grid;
  gap: 8px;
}
.tb__q {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 0 16px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: var(--a-panel);
  color: var(--a-muted);
}
.tb__q:focus-within {
  border-color: var(--a-gold);
}
.tb__q input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--a-ink);
  font: inherit;
}
.tb__csv {
  justify-self: start;
}
.tb__sum {
  margin: 10px 2px 14px;
  font-size: 14px;
}
.tb__clear {
  border: 0;
  background: none;
  padding: 0;
  color: var(--a-gold);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}
.list-sk {
  min-height: 240px;
  border-radius: 16px;
}
.ls {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ls__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 12px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid var(--a-line);
  border-radius: 14px;
  background: var(--a-panel);
}
.ls__row.is-off {
  opacity: 0.72;
}
.ls__who {
  display: grid;
  min-width: 0;
}
.ls__who strong {
  overflow-wrap: anywhere;
}
.ls__tier {
  grid-column: 1;
  font-size: 14px;
}
.ls__in {
  grid-column: 1;
}
.ls__go {
  grid-column: 2;
  grid-row: 1 / span 3;
  align-self: center;
}
.chip {
  justify-self: start;
  grid-column: 1;
  padding: 3px 10px;
  border: 1px solid var(--a-line);
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--a-muted);
}
.chip.is-valid {
  border-color: color-mix(in srgb, var(--a-gold) 55%, transparent);
  color: var(--a-gold);
}
.chip.is-used {
  border-color: color-mix(in srgb, var(--a-ok) 55%, transparent);
  color: var(--a-ok);
}
.chip.is-void,
.chip.is-refunded {
  border-color: color-mix(in srgb, var(--a-danger) 55%, transparent);
  color: var(--a-danger);
}
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}
.dt {
  display: grid;
  gap: 16px;
}
.dt__f {
  display: grid;
  gap: 10px;
  margin: 0;
}
.dt__f div {
  display: grid;
  gap: 2px;
}
.dt__f dt {
  color: var(--a-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.dt__f dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.dt__note {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--a-line-strong);
  border-radius: 12px;
  color: var(--a-muted);
  font-size: 14px;
}
.acts {
  display: grid;
  gap: 8px;
}
.act {
  display: grid;
  gap: 2px;
  min-height: 56px;
  padding: 10px 14px;
  border: 1px solid var(--a-line);
  border-radius: 14px;
  background: transparent;
  color: var(--a-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.act:hover {
  border-color: var(--a-line-strong);
}
.act[aria-pressed='true'] {
  border-color: var(--a-gold);
  background: rgb(224 178 94 / 0.12);
}
.act--danger[aria-pressed='true'] {
  border-color: var(--a-danger);
  background: color-mix(in srgb, var(--a-danger) 10%, transparent);
}
.form {
  display: grid;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}
.sure {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--a-line);
  border-radius: 12px;
  font-size: 14px;
  cursor: pointer;
}
.sure input {
  margin-top: 3px;
  width: 18px;
  height: 18px;
  accent-color: var(--a-gold);
}
.dec {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
@media (min-width: 900px) {
  .tb {
    grid-template-columns: minmax(220px, 1fr) 180px 180px auto;
    align-items: center;
  }
  .ls__row {
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto minmax(110px, auto) auto;
  }
  .ls__tier,
  .ls__in,
  .chip {
    grid-column: auto;
  }
  .ls__go {
    grid-column: auto;
    grid-row: auto;
  }
}
</style>
