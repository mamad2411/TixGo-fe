<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { BuildingStore, ExternalLink } from '@vicons/tabler'
import { NIcon, NInput, useMessage } from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  documentUrl,
  getOrganizer,
  listOrganizers,
  reviewKyb,
  setOrganizerSuspended,
  type KybItem,
  type Organizer,
} from '@/api/admin'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import Chip from '@/components/dash/Chip.vue'
import PageHeader from '@/components/dash/PageHeader.vue'
import SideSheet from '@/components/dash/SideSheet.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import '@/components/dash/dashList.css'

// Verifikasi usaha (KYB) + penangguhan organizer. Organizer baru tidak bisa menjual tiket berbayar sebelum disetujui.
const { t, locale } = useI18n()
useHead({ title: computed(() => t('dash.nav.admin-organizers')) })
const route = useRoute()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const day = (iso: string) =>
  new Intl.DateTimeFormat(bcp.value, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  )

const TABS = ['submitted', 'in_review', 'needs_info', 'approved', 'rejected', 'all'] as const
type Tab = (typeof TABS)[number]
const tab = computed<Tab>(() => {
  const s = String(route.query.status ?? 'submitted') as Tab
  return TABS.includes(s) ? s : 'submitted'
})
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
function setTab(k: Tab): void {
  void router.push({ query: k === 'submitted' ? {} : { status: k } })
}
function goPage(p: number): void {
  void router.push({ query: { ...route.query, page: p > 1 ? String(p) : undefined } })
}

const rows = ref<Organizer[]>([])
const total = ref(0)
const per = ref(20)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
let seq = 0
async function load(): Promise<void> {
  const my = ++seq
  state.value = 'loading'
  try {
    const r = await listOrganizers(tab.value === 'all' ? '' : tab.value, page.value)
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

const kindOf = (s: string): 'idle' | 'wait' | 'ok' | 'bad' =>
  s === 'approved' ? 'ok' : s === 'rejected' ? 'bad' : s === 'draft' ? 'idle' : 'wait'

// ---- detail + keputusan ----
const open = ref(false)
const cur = ref<KybItem | null>(null)
const mode = ref<'' | 'reject' | 'needs_info'>('')
const reason = ref('')
const busy = ref(false)
const reasonOk = computed(() => reason.value.trim().length >= 10)
const reviewable = computed(() => ['submitted', 'in_review'].includes(cur.value?.kyb_status ?? ''))

async function show(o: Organizer): Promise<void> {
  cur.value = { ...o, owner_user_id: '' }
  mode.value = ''
  reason.value = ''
  open.value = true
  try {
    cur.value = await getOrganizer(o.id)
  } catch (e) {
    message.error(apiMessage(e))
  }
}
async function openDoc(docId: string): Promise<void> {
  if (!cur.value) return
  try {
    const url = await documentUrl(cur.value.id, docId)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (e) {
    message.error(apiMessage(e))
  }
}
async function decide(d: 'approve' | 'reject' | 'needs_info'): Promise<void> {
  if (!cur.value || busy.value) return
  if (d !== 'approve' && !reasonOk.value) return
  busy.value = true
  try {
    await reviewKyb(cur.value.id, d, d === 'approve' ? '' : reason.value.trim())
    message.success(t(`dash.org.done.${d}`))
    open.value = false
    await load()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
async function suspend(v: boolean): Promise<void> {
  if (!cur.value || busy.value) return
  busy.value = true
  try {
    await setOrganizerSuspended(cur.value.id, v)
    message.success(t(v ? 'dash.org.done.suspend' : 'dash.org.done.unsuspend'))
    cur.value.status = v ? 'suspended' : 'active'
    await load()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div data-test="admin-organizers">
    <PageHeader :title="t('dash.nav.admin-organizers')" :lead="t('dash.org.lead')" />

    <div class="dl-tabs" role="tablist" :aria-label="t('dash.review.filter')">
      <button
        v-for="k in TABS"
        :key="k"
        type="button"
        role="tab"
        :aria-selected="tab === k"
        :data-test="`org-tab-${k}`"
        @click="setTab(k)"
      >
        {{ t(`dash.org.tab.${k}`) }}
      </button>
    </div>

    <div
      v-if="state === 'loading'"
      class="a-sk dl-sk"
      role="status"
      :aria-label="t('common.loading')"
    />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <EmptyState
      v-else-if="!rows.length"
      :icon="BuildingStore"
      :title="t('dash.org.emptyT')"
      :body="t('dash.org.emptyB')"
    />
    <template v-else>
      <ul class="dl-list" data-test="org-list">
        <li v-for="o in rows" :key="o.id" class="dl-row">
          <div class="dl-row__m">
            <strong>{{ o.name }}</strong>
            <small class="a-muted"
              >{{ o.legal_name || o.contact_email }} ·
              {{ t('dash.org.since', { d: day(o.created_at) }) }}</small
            >
          </div>
          <div class="dl-row__tags">
            <Chip :kind="kindOf(o.kyb_status)">{{
              t(`dash.org.kyb.${o.kyb_status}`, o.kyb_status)
            }}</Chip>
            <Chip v-if="o.status === 'suspended'" kind="bad">{{ t('dash.org.suspended') }}</Chip>
          </div>
          <button
            type="button"
            class="a-pill a-pill--sm dl-row__go"
            :class="{ 'a-pill--solid': ['submitted', 'in_review'].includes(o.kyb_status) }"
            data-test="org-open"
            @click="show(o)"
          >
            {{ t('dash.org.open') }}
          </button>
        </li>
      </ul>
      <nav v-if="pages > 1" class="dl-pager" :aria-label="t('events.pager')">
        <button
          type="button"
          class="a-pill a-pill--sm"
          :disabled="page <= 1"
          @click="goPage(page - 1)"
        >
          {{ t('common.prev') }}
        </button>
        <span class="a-muted">{{ t('events.pageOf', { p: page, n: pages }) }}</span>
        <button
          type="button"
          class="a-pill a-pill--sm"
          :disabled="page >= pages"
          @click="goPage(page + 1)"
        >
          {{ t('common.next') }}
        </button>
      </nav>
    </template>

    <SideSheet v-model:show="open" :title="cur?.name ?? ''">
      <div v-if="cur" class="sh" data-test="org-sheet">
        <div class="dl-row__tags">
          <Chip :kind="kindOf(cur.kyb_status)">{{
            t(`dash.org.kyb.${cur.kyb_status}`, cur.kyb_status)
          }}</Chip>
          <Chip :kind="cur.can_sell_paid ? 'ok' : 'wait'">{{
            cur.can_sell_paid ? t('dash.org.canSell') : t('dash.org.cannotSell')
          }}</Chip>
          <Chip v-if="cur.status === 'suspended'" kind="bad">{{ t('dash.org.suspended') }}</Chip>
        </div>
        <dl class="dl-facts">
          <div>
            <dt>{{ t('dash.org.f.type') }}</dt>
            <dd>{{ t(`dash.org.type.${cur.type}`, cur.type) }}</dd>
          </div>
          <div v-if="cur.legal_name">
            <dt>{{ t('dash.org.f.legal') }}</dt>
            <dd>{{ cur.legal_name }}</dd>
          </div>
          <div v-if="cur.contact_email">
            <dt>{{ t('dash.org.f.email') }}</dt>
            <dd>{{ cur.contact_email }}</dd>
          </div>
          <div v-if="cur.contact_phone">
            <dt>{{ t('dash.org.f.phone') }}</dt>
            <dd>{{ cur.contact_phone }}</dd>
          </div>
          <div v-if="cur.address">
            <dt>{{ t('dash.org.f.address') }}</dt>
            <dd>{{ cur.address }}</dd>
          </div>
          <div v-if="cur.kyb_reason">
            <dt>{{ t('dash.org.f.reason') }}</dt>
            <dd>{{ cur.kyb_reason }}</dd>
          </div>
        </dl>

        <h3 class="dl-sec">{{ t('dash.org.docs') }}</h3>
        <p v-if="!cur.documents?.length" class="dl-note">{{ t('dash.org.noDocs') }}</p>
        <ul v-else class="docs">
          <li v-for="d in cur.documents" :key="d.id">
            <span>{{ t(`dash.org.doc.${d.kind}`, d.kind) }}</span>
            <button type="button" class="link" data-test="org-doc" @click="openDoc(d.id)">
              {{ t('dash.org.openDoc') }}
              <NIcon :component="ExternalLink" :size="15" aria-hidden="true" />
            </button>
          </li>
        </ul>

        <h3 class="dl-sec">{{ t('dash.org.banks') }}</h3>
        <p v-if="!cur.banks?.length" class="dl-note">{{ t('dash.org.noBanks') }}</p>
        <ul v-else class="docs">
          <li v-for="b in cur.banks" :key="b.id">
            <span>{{ b.bank_code }} {{ b.account_no_masked }} · {{ b.account_name }}</span>
            <Chip :kind="b.verified ? 'ok' : 'wait'">{{
              b.verified ? t('dash.org.verified') : t('dash.org.unverified')
            }}</Chip>
          </li>
        </ul>

        <template v-if="mode">
          <label class="dl-field" for="kyb-reason">{{
            t(mode === 'reject' ? 'dash.org.reasonReject' : 'dash.org.reasonInfo')
          }}</label>
          <NInput
            id="kyb-reason"
            v-model:value="reason"
            type="textarea"
            :maxlength="1000"
            show-count
            :autosize="{ minRows: 3, maxRows: 6 }"
            data-test="kyb-reason"
          />
          <small :class="reason && !reasonOk ? 'dl-bad' : 'a-muted'">{{
            t('dash.org.reasonHint')
          }}</small>
        </template>

        <div class="susp">
          <p class="a-muted">
            {{ cur.status === 'suspended' ? t('dash.org.suspendedB') : t('dash.org.suspendB') }}
          </p>
          <button
            type="button"
            class="a-pill a-pill--sm"
            :disabled="busy"
            data-test="org-suspend"
            @click="suspend(cur.status !== 'suspended')"
          >
            {{ cur.status === 'suspended' ? t('dash.org.unsuspend') : t('dash.org.suspend') }}
          </button>
        </div>
      </div>
      <template v-if="cur && reviewable" #footer>
        <div class="dl-btns">
          <template v-if="!mode">
            <button
              type="button"
              class="a-pill a-pill--solid"
              :disabled="busy"
              :aria-busy="busy"
              data-test="kyb-approve"
              @click="decide('approve')"
            >
              {{ t('dash.org.approve') }}
            </button>
            <button
              type="button"
              class="a-pill"
              :disabled="busy"
              data-test="kyb-info"
              @click="mode = 'needs_info'"
            >
              {{ t('dash.org.askInfo') }}
            </button>
            <button
              type="button"
              class="a-pill"
              :disabled="busy"
              data-test="kyb-reject"
              @click="mode = 'reject'"
            >
              {{ t('dash.org.reject') }}
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="a-pill a-pill--solid"
              :disabled="busy || !reasonOk"
              :aria-busy="busy"
              data-test="kyb-confirm"
              @click="decide(mode)"
            >
              {{ t(mode === 'reject' ? 'dash.org.rejectGo' : 'dash.org.askInfoGo') }}
            </button>
            <button type="button" class="a-pill" :disabled="busy" @click="mode = ''">
              {{ t('org.cancel') }}
            </button>
          </template>
        </div>
      </template>
    </SideSheet>
  </div>
</template>

<style scoped>
.sh {
  display: grid;
  gap: 12px;
}
.docs {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.docs li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--a-line);
  border-radius: 12px;
  font-size: 14px;
}
.link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 36px;
  border: 0;
  background: none;
  color: var(--a-gold);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.susp {
  display: grid;
  gap: 6px;
  justify-items: start;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--a-line);
}
.susp p {
  margin: 0;
  font-size: 13.5px;
}
</style>
