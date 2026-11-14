<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Cash } from '@vicons/tabler'
import { NInput, useMessage } from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { listPayouts, payoutAction, payoutMarkPaid, type Payout } from '@/api/admin'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import Chip from '@/components/dash/Chip.vue'
import PageHeader from '@/components/dash/PageHeader.vue'
import SideSheet from '@/components/dash/SideSheet.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useAuthStore } from '@/stores/auth'
import { formatRupiah } from '@/utils/format'
import '@/components/dash/dashList.css'

// Antrean pencairan. Aturan pemisahan tugas: orang yang mengajukan tidak boleh menyetujui pencairannya sendiri
// (BE memeriksa, di sini hanya dijelaskan lebih awal agar tombolnya tidak membingungkan).
const { t, locale } = useI18n()
useHead({ title: computed(() => t('dash.nav.admin-payouts')) })
const route = useRoute()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const auth = useAuthStore()
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const rp = (n: number) => formatRupiah(n, bcp.value)
const when = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat(bcp.value, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso))
    : ''

const TABS = ['requested', 'approved', 'processing', 'paid', 'all'] as const
type Tab = (typeof TABS)[number]
const tab = computed<Tab>(() => {
  const s = String(route.query.status ?? 'requested') as Tab
  return TABS.includes(s) ? s : 'requested'
})
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
function setTab(k: Tab): void {
  void router.push({ query: k === 'requested' ? {} : { status: k } })
}
function goPage(p: number): void {
  void router.push({ query: { ...route.query, page: p > 1 ? String(p) : undefined } })
}

const rows = ref<Payout[]>([])
const total = ref(0)
const per = ref(20)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
let seq = 0
async function load(): Promise<void> {
  const my = ++seq
  state.value = 'loading'
  try {
    const r = await listPayouts(tab.value === 'all' ? '' : tab.value, page.value)
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
  s === 'paid' ? 'ok' : s === 'rejected' || s === 'failed' ? 'bad' : 'wait'

// ---- detail + tindakan ----
const open = ref(false)
const cur = ref<Payout | null>(null)
const mode = ref<'' | 'reject' | 'fail' | 'paid'>('')
const note = ref('')
const proof = ref<File | null>(null)
const busy = ref(false)
const sameUser = computed(() => !!cur.value && cur.value.requested_by === auth.user?.id)
const proofOk = computed(() => !!proof.value && proof.value.size <= 5 * 1024 * 1024)
const noteOk = computed(() => note.value.trim().length >= 5)

function show(p: Payout): void {
  cur.value = p
  mode.value = ''
  note.value = ''
  proof.value = null
  open.value = true
}
function onFile(e: Event): void {
  proof.value = (e.target as HTMLInputElement).files?.[0] ?? null
}
async function run(a: 'approve' | 'process' | 'reject' | 'fail' | 'paid'): Promise<void> {
  if (!cur.value || busy.value) return
  if ((a === 'reject' || a === 'fail') && !noteOk.value) return
  if (a === 'paid' && !proofOk.value) return
  busy.value = true
  try {
    if (a === 'paid') await payoutMarkPaid(cur.value.id, proof.value!, note.value.trim())
    else await payoutAction(cur.value.id, a, note.value.trim())
    message.success(t(`dash.pay.done.${a}`))
    open.value = false
    await load()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div data-test="admin-payouts">
    <PageHeader :title="t('dash.nav.admin-payouts')" :lead="t('dash.pay.lead')" />

    <div class="dl-tabs" role="tablist" :aria-label="t('dash.review.filter')">
      <button
        v-for="k in TABS"
        :key="k"
        type="button"
        role="tab"
        :aria-selected="tab === k"
        :data-test="`pay-tab-${k}`"
        @click="setTab(k)"
      >
        {{ t(`dash.pay.tab.${k}`) }}
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
      :icon="Cash"
      :title="t('dash.pay.emptyT')"
      :body="t('dash.pay.emptyB')"
    />
    <template v-else>
      <ul class="dl-list" data-test="pay-list">
        <li v-for="p in rows" :key="p.id" class="dl-row">
          <div class="dl-row__m">
            <strong>{{ rp(p.amount) }}</strong>
            <small class="a-muted"
              >{{ p.organizer_name || p.organizer_id }} ·
              {{ t('dash.pay.asked', { d: when(p.created_at) }) }}</small
            >
          </div>
          <div class="dl-row__tags">
            <Chip :kind="kindOf(p.status)">{{ t(`dash.pay.st.${p.status}`, p.status) }}</Chip>
            <Chip v-if="p.bank_code">{{ p.bank_code }} •••{{ p.account_last4 }}</Chip>
          </div>
          <button
            type="button"
            class="a-pill a-pill--sm dl-row__go"
            :class="{ 'a-pill--solid': p.status === 'requested' }"
            data-test="pay-open"
            @click="show(p)"
          >
            {{ t('dash.pay.open') }}
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

    <SideSheet v-model:show="open" :title="cur ? rp(cur.amount) : ''">
      <div v-if="cur" class="sh" data-test="pay-sheet">
        <aside class="impact">
          <strong>{{ t('dash.pay.impact') }}</strong>
          <p>
            {{
              t('dash.pay.impactB', {
                amt: rp(cur.amount),
                name: cur.account_name || '-',
                bank: cur.bank_code || '-',
                last: cur.account_last4 || '----',
              })
            }}
          </p>
        </aside>
        <dl class="dl-facts">
          <div>
            <dt>{{ t('dash.pay.org') }}</dt>
            <dd>{{ cur.organizer_name || cur.organizer_id }}</dd>
          </div>
          <div>
            <dt>{{ t('dash.pay.status') }}</dt>
            <dd>
              <Chip :kind="kindOf(cur.status)">{{
                t(`dash.pay.st.${cur.status}`, cur.status)
              }}</Chip>
            </dd>
          </div>
          <div v-if="cur.account_no">
            <dt>{{ t('dash.pay.accNo') }}</dt>
            <dd>{{ cur.account_no }}</dd>
          </div>
          <div>
            <dt>{{ t('dash.pay.requested') }}</dt>
            <dd>{{ when(cur.created_at) }}</dd>
          </div>
          <div v-if="cur.paid_at">
            <dt>{{ t('dash.pay.paidAt') }}</dt>
            <dd>{{ when(cur.paid_at) }}</dd>
          </div>
          <div v-if="cur.note">
            <dt>{{ t('dash.pay.note') }}</dt>
            <dd>{{ cur.note }}</dd>
          </div>
        </dl>

        <p v-if="cur.status === 'requested' && sameUser" class="dl-note" data-test="pay-same">
          {{ t('dash.pay.sameUser') }}
        </p>

        <template v-if="mode === 'reject' || mode === 'fail'">
          <label class="dl-field" for="pay-note">{{
            t(mode === 'reject' ? 'dash.pay.reasonReject' : 'dash.pay.reasonFail')
          }}</label>
          <NInput
            id="pay-note"
            v-model:value="note"
            type="textarea"
            :maxlength="500"
            show-count
            :autosize="{ minRows: 2, maxRows: 5 }"
            data-test="pay-note"
          />
          <small :class="note && !noteOk ? 'dl-bad' : 'a-muted'">{{
            t('dash.pay.noteHint')
          }}</small>
        </template>
        <template v-else-if="mode === 'paid'">
          <label class="dl-field" for="pay-proof">{{ t('dash.pay.proof') }}</label>
          <input
            id="pay-proof"
            type="file"
            accept="image/*,application/pdf"
            data-test="pay-proof"
            @change="onFile"
          />
          <small :class="proof && !proofOk ? 'dl-bad' : 'a-muted'">{{
            t('dash.pay.proofHint')
          }}</small>
          <label class="dl-field" for="pay-note2">{{ t('dash.pay.noteOpt') }}</label>
          <NInput id="pay-note2" v-model:value="note" :maxlength="500" />
        </template>
      </div>
      <template v-if="cur && ['requested', 'approved', 'processing'].includes(cur.status)" #footer>
        <div class="dl-btns">
          <template v-if="!mode">
            <button
              v-if="cur.status === 'requested'"
              type="button"
              class="a-pill a-pill--solid"
              :disabled="busy || sameUser"
              :aria-busy="busy"
              data-test="pay-approve"
              @click="run('approve')"
            >
              {{ t('dash.pay.approve') }}
            </button>
            <button
              v-if="cur.status === 'requested'"
              type="button"
              class="a-pill"
              :disabled="busy"
              data-test="pay-reject"
              @click="mode = 'reject'"
            >
              {{ t('dash.pay.reject') }}
            </button>
            <button
              v-if="cur.status === 'approved'"
              type="button"
              class="a-pill a-pill--solid"
              :disabled="busy"
              :aria-busy="busy"
              data-test="pay-process"
              @click="run('process')"
            >
              {{ t('dash.pay.process') }}
            </button>
            <button
              v-if="cur.status === 'processing'"
              type="button"
              class="a-pill a-pill--solid"
              :disabled="busy"
              data-test="pay-paid"
              @click="mode = 'paid'"
            >
              {{ t('dash.pay.markPaid') }}
            </button>
            <button
              v-if="cur.status === 'processing'"
              type="button"
              class="a-pill"
              :disabled="busy"
              data-test="pay-fail"
              @click="mode = 'fail'"
            >
              {{ t('dash.pay.markFail') }}
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="a-pill a-pill--solid"
              :disabled="busy || (mode === 'paid' ? !proofOk : !noteOk)"
              :aria-busy="busy"
              data-test="pay-confirm"
              @click="run(mode)"
            >
              {{ t(`dash.pay.go.${mode}`) }}
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
.impact {
  padding: 12px 14px;
  border: 1px solid var(--a-line-strong);
  border-radius: 14px;
  background: rgb(224 178 94 / 0.1);
  font-size: 14px;
}
.impact p {
  margin: 4px 0 0;
}
input[type='file'] {
  padding: 10px;
  border: 1px dashed var(--a-line-strong);
  border-radius: 12px;
  background: var(--a-bg);
  color: var(--a-ink);
  font: inherit;
  font-size: 14px;
}
</style>
