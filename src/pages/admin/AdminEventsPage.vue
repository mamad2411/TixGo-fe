<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { CircleCheck, ShieldCheck } from '@vicons/tabler'
import { NInput, useMessage } from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { getReviewEvent, listReviewEvents, reviewEvent, type ReviewFilter } from '@/api/admin'
import type { OrgEvent } from '@/api/organizer'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import EventThumb from '@/components/app/EventThumb.vue'
import PageHeader from '@/components/dash/PageHeader.vue'
import SideSheet from '@/components/dash/SideSheet.vue'
import StatusTag from '@/components/dash/StatusTag.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { formatEventDate, formatRupiah } from '@/utils/format'

// Antrean tinjau event (admin): organizer mengajukan -> admin setujui / tolak (alasan wajib) -> organizer terbitkan.
const { t, locale } = useI18n()
useHead({ title: computed(() => t('dash.nav.admin-events')) })
const route = useRoute()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))

const TABS: { key: ReviewFilter | 'all'; status: ReviewFilter }[] = [
  { key: 'in_review', status: 'in_review' },
  { key: 'approved', status: 'approved' },
  { key: 'published', status: 'published' },
  { key: 'all', status: '' },
]
// Filter hidup di query-string: bisa dibagikan dan tombol Kembali berfungsi.
const status = computed<ReviewFilter>(() => {
  const s = String(route.query.status ?? 'in_review')
  return s === 'all' ? '' : (TABS.find((x) => x.status === s)?.status ?? 'in_review')
})
const tabKey = computed(() => (status.value === '' ? 'all' : status.value))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
function setTab(k: string): void {
  void router.push({ query: k === 'in_review' ? {} : { status: k } })
}
function goPage(p: number): void {
  void router.push({ query: { ...route.query, page: p > 1 ? String(p) : undefined } })
}

const rows = ref<OrgEvent[]>([])
const total = ref(0)
const per = ref(20)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
let ctrl = 0
async function load(): Promise<void> {
  const my = ++ctrl
  state.value = 'loading'
  try {
    const r = await listReviewEvents(status.value, page.value)
    if (my !== ctrl) return
    rows.value = r.data
    total.value = r.meta.total
    per.value = r.meta.per_page
    state.value = 'ok'
  } catch (e) {
    if (my !== ctrl) return
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
watch(() => route.fullPath, load, { immediate: true })
onBeforeUnmount(() => ctrl++)
const pages = computed(() => Math.max(1, Math.ceil(total.value / per.value)))

// ---- detail + keputusan ----
const open = ref(false)
const cur = ref<OrgEvent | null>(null)
const loadingDetail = ref(false)
const rejecting = ref(false)
const note = ref('')
const busy = ref(false)
const noteOk = computed(() => note.value.trim().length >= 10)

async function show(e: OrgEvent): Promise<void> {
  cur.value = e
  open.value = true
  rejecting.value = false
  note.value = ''
  loadingDetail.value = true
  try {
    cur.value = await getReviewEvent(e.id)
  } catch (x) {
    message.error(apiMessage(x))
  } finally {
    loadingDetail.value = false
  }
}
async function decide(decision: 'approve' | 'reject'): Promise<void> {
  if (!cur.value || busy.value) return
  if (decision === 'reject' && !noteOk.value) return
  busy.value = true
  try {
    await reviewEvent(cur.value.id, decision, decision === 'reject' ? note.value.trim() : '')
    message.success(t(decision === 'approve' ? 'dash.review.approved' : 'dash.review.rejected'))
    open.value = false
    await load()
  } catch (x) {
    message.error(apiMessage(x))
  } finally {
    busy.value = false
  }
}
const quotaOf = (e: OrgEvent) => e.tiers.reduce((a, k) => a + k.quota, 0)
</script>

<template>
  <div data-test="admin-events">
    <PageHeader :title="t('dash.nav.admin-events')" :lead="t('dash.review.lead')" />

    <div class="tabs" role="tablist" :aria-label="t('dash.review.filter')">
      <button
        v-for="x in TABS"
        :key="x.key"
        type="button"
        role="tab"
        :aria-selected="tabKey === x.key"
        :data-test="`tab-${x.key}`"
        @click="setTab(x.key)"
      >
        {{ t(`dash.review.tab.${x.key}`) }}
      </button>
    </div>

    <div
      v-if="state === 'loading'"
      class="a-sk list-sk"
      role="status"
      :aria-label="t('common.loading')"
    />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <EmptyState
      v-else-if="!rows.length"
      :icon="tabKey === 'in_review' ? CircleCheck : ShieldCheck"
      :title="t(tabKey === 'in_review' ? 'dash.review.emptyQueue' : 'dash.review.emptyList')"
      :body="t(tabKey === 'in_review' ? 'dash.review.emptyQueueBody' : 'dash.review.emptyListBody')"
    />
    <template v-else>
      <ul class="list" data-test="review-list">
        <li v-for="e in rows" :key="e.id">
          <div class="row">
            <EventThumb :src="e.poster_url" :title="e.title" :w="52" :h="66" />
            <div class="row__m">
              <strong>{{ e.title }}</strong>
              <small class="a-muted">
                {{ e.venue?.name
                }}<template v-if="e.venue">
                  · {{ formatEventDate(e.starts_at, e.venue.tz, bcp) }}</template
                >
              </small>
              <small class="a-muted">{{
                t('dash.review.tiers', { n: e.tiers.length, q: quotaOf(e) })
              }}</small>
            </div>
            <StatusTag :status="e.status" />
            <button
              type="button"
              class="a-pill a-pill--sm row__go"
              :class="{ 'a-pill--solid': e.status === 'in_review' }"
              data-test="review-open"
              @click="show(e)"
            >
              {{ t(e.status === 'in_review' ? 'dash.review.review' : 'dash.review.view') }}
            </button>
          </div>
        </li>
      </ul>
      <nav v-if="pages > 1" class="pager" :aria-label="t('events.pager')">
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

    <SideSheet v-model:show="open" :title="cur?.title ?? ''">
      <div data-test="review-drawer">
        <div v-if="cur" class="dt">
          <div class="dt__top">
            <StatusTag :status="cur.status" />
            <span class="a-muted"
              >{{ cur.genre }} · {{ t(`dash.review.mode.${cur.mode}`, cur.mode) }}</span
            >
          </div>
          <img v-if="cur.poster_url" :src="cur.poster_url" alt="" class="dt__poster" />
          <p v-if="cur.description" class="dt__desc">{{ cur.description }}</p>

          <dl class="dt__facts">
            <div>
              <dt>{{ t('dash.review.venue') }}</dt>
              <dd>
                {{ cur.venue?.name }}<span v-if="cur.venue?.city">, {{ cur.venue.city }}</span>
              </dd>
            </div>
            <div>
              <dt>{{ t('dash.review.when') }}</dt>
              <dd>
                {{ cur.venue ? formatEventDate(cur.starts_at, cur.venue.tz, bcp) : cur.starts_at }}
              </dd>
            </div>
            <div v-if="cur.artists.length">
              <dt>{{ t('dash.review.artists') }}</dt>
              <dd>{{ cur.artists.map((a) => a.name).join(', ') }}</dd>
            </div>
            <div>
              <dt>{{ t('dash.review.refund') }}</dt>
              <dd>{{ t(`dash.review.refundType.${cur.refund_policy.type}`) }}</dd>
            </div>
          </dl>

          <h3 class="dt__h">{{ t('dash.review.tierTitle') }}</h3>
          <p v-if="!cur.tiers.length" class="dt__warn" role="alert">
            {{ t('dash.review.noTier') }}
          </p>
          <ul v-else class="dt__tiers">
            <li v-for="k in cur.tiers" :key="k.id">
              <span>{{ k.name }}</span>
              <span class="a-muted">{{ t('dash.review.quota', { n: k.quota }) }}</span>
              <strong>{{ formatRupiah(k.price, bcp) }}</strong>
            </li>
          </ul>
        </div>
      </div>

      <template v-if="cur?.status === 'in_review'" #footer>
        <div class="dec">
          <template v-if="!rejecting">
            <p class="a-muted dec__note">{{ t('dash.review.approveNote') }}</p>
            <div class="dec__btns">
              <button
                type="button"
                class="a-pill a-pill--solid"
                :disabled="busy || loadingDetail"
                :aria-busy="busy"
                data-test="approve"
                @click="decide('approve')"
              >
                {{ t('dash.review.approve') }}
              </button>
              <button
                type="button"
                class="a-pill"
                :disabled="busy"
                data-test="reject-start"
                @click="rejecting = true"
              >
                {{ t('dash.review.reject') }}
              </button>
            </div>
          </template>
          <template v-else>
            <label class="dec__l" for="rj-note">{{ t('dash.review.reasonLabel') }}</label>
            <NInput
              id="rj-note"
              v-model:value="note"
              type="textarea"
              :maxlength="1000"
              show-count
              :autosize="{ minRows: 3, maxRows: 6 }"
              :placeholder="t('dash.review.reasonPh')"
              data-test="reject-note"
            />
            <p class="dec__hint" :class="{ 'is-bad': note && !noteOk }">
              {{ t('dash.review.reasonHint') }}
            </p>
            <div class="dec__btns">
              <button
                type="button"
                class="a-pill a-pill--solid"
                :disabled="busy || !noteOk"
                :aria-busy="busy"
                data-test="reject-confirm"
                @click="decide('reject')"
              >
                {{ t('dash.review.rejectConfirm') }}
              </button>
              <button type="button" class="a-pill" :disabled="busy" @click="rejecting = false">
                {{ t('org.cancel') }}
              </button>
            </div>
          </template>
        </div>
      </template>
    </SideSheet>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 18px;
  padding-bottom: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs button {
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid var(--a-line);
  border-radius: 999px;
  background: transparent;
  color: var(--a-ink);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.tabs button:hover {
  border-color: var(--a-line-strong);
}
.tabs button[aria-selected='true'] {
  border-color: var(--a-gold);
  background: rgb(224 178 94 / 0.16);
  color: var(--a-gold);
}
.list-sk {
  min-height: 220px;
  border-radius: 16px;
}
.list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px 14px;
  padding: 12px 14px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
}
.row__m {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.row__m strong {
  overflow-wrap: anywhere;
}
.row > :nth-child(3) {
  grid-column: 1 / -1;
  justify-self: start;
}
.row__go {
  grid-column: 1 / -1;
  justify-self: stretch;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 22px;
}
.dt {
  display: grid;
  gap: 14px;
}
.dt__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
.dt__poster {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  border-radius: 14px;
}
.dt__desc {
  margin: 0;
  line-height: 1.6;
  white-space: pre-line;
}
.dt__facts {
  display: grid;
  gap: 10px;
  margin: 0;
}
.dt__facts div {
  display: grid;
  gap: 2px;
}
.dt__facts dt {
  color: var(--a-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.dt__facts dd {
  margin: 0;
}
.dt__h {
  margin: 6px 0 0;
  font-size: 15px;
}
.dt__warn {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--a-danger);
  border-radius: 12px;
  color: var(--a-danger);
  font-size: 14px;
}
.dt__tiers {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dt__tiers li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--a-line);
  border-radius: 12px;
  font-size: 14px;
}
.dec {
  display: grid;
  gap: 10px;
  width: 100%;
}
.dec__note,
.dec__hint {
  margin: 0;
  font-size: 13px;
}
.dec__hint.is-bad {
  color: var(--a-danger);
}
.dec__l {
  font-size: 14px;
  font-weight: 600;
}
.dec__btns {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
@media (min-width: 720px) {
  .row {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
  }
  .row > :nth-child(3),
  .row__go {
    grid-column: auto;
    justify-self: end;
  }
}
</style>
