<script setup lang="ts">
import { NModal, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { toApiError } from '@/api/errors'
import { listReviews, reportReview, type Review } from '@/api/reviews'
import StarRating from '@/components/app/StarRating.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useRequireLogin } from '@/composables/useRequireLogin'

// Ulasan penonton. Rata-rata hanya tampil bila BE mengirimnya (>= 5 ulasan); di bawah itu hanya jumlah.
const props = defineProps<{ slug: string }>()
const { t, locale } = useI18n()
const message = useMessage()
const apiMessage = useApiMessage()
const requireLogin = useRequireLogin()

const PER = 10
const rows = ref<Review[]>([])
const count = ref(0)
const average = ref<number | undefined>()
const page = ref(1)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const more = ref(false)
const err = ref('')

async function load(reset = true): Promise<void> {
  if (reset) {
    page.value = 1
    state.value = 'loading'
  }
  try {
    const r = await listReviews(props.slug, page.value, PER)
    rows.value = reset ? r.reviews : [...rows.value, ...r.reviews]
    count.value = r.count
    average.value = r.average
    more.value = rows.value.length < r.count
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(() => load())
async function loadMore(): Promise<void> {
  page.value++
  await load(false)
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))

// ---- laporkan ----
const reporting = ref<Review | null>(null)
const reason = ref('')
const reasonErr = ref('')
const busy = ref(false)
async function openReport(r: Review): Promise<void> {
  if (!(await requireLogin('rv.needLogin'))) return
  reporting.value = r
  reason.value = ''
  reasonErr.value = ''
}
async function sendReport(): Promise<void> {
  if (!reporting.value) return
  if (reason.value.trim().length < 5) {
    reasonErr.value = t('rv.reasonShort')
    return
  }
  busy.value = true
  try {
    await reportReview(reporting.value.id, reason.value.trim())
    message.success(t('rv.reported'))
    reporting.value = null
  } catch (e) {
    const status = toApiError(e).status
    reasonErr.value = status === 409 ? t('rv.ownReview') : apiMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div data-test="reviews">
    <div v-if="state === 'loading'" class="a-sk" style="min-height: 96px; border-radius: 16px" />
    <p v-else-if="state === 'error'" class="a-muted" role="alert">
      {{ err }}
      <button type="button" class="a-pill a-pill--sm" @click="load()">
        {{ t('common.retry') }}
      </button>
    </p>
    <template v-else>
      <p v-if="!count" class="a-muted" data-test="reviews-empty">{{ t('rv.none') }}</p>
      <template v-else>
        <div class="rv__sum">
          <template v-if="average !== undefined">
            <strong class="rv__avg" data-test="reviews-avg">{{ average.toFixed(1) }}</strong>
            <StarRating :model-value="average" readonly :size="22" />
          </template>
          <span class="a-muted">{{ t('rv.count', { n: count }) }}</span>
        </div>
        <ul class="rv__list">
          <li v-for="r in rows" :key="r.id" class="rv__item" data-test="review-item">
            <div class="rv__top">
              <StarRating :model-value="r.rating" readonly :size="16" />
              <strong>{{ r.author }}</strong>
              <small class="a-muted">{{ fmt(r.created_at) }}</small>
            </div>
            <p v-if="r.body" class="rv__body">{{ r.body }}</p>
            <p v-if="r.organizer_reply" class="rv__reply">
              <strong>{{ t('rv.reply') }}</strong> {{ r.organizer_reply }}
            </p>
            <button type="button" class="rv__rep" data-test="review-report" @click="openReport(r)">
              {{ t('rv.report') }}
            </button>
          </li>
        </ul>
        <button v-if="more" type="button" class="a-pill" data-test="reviews-more" @click="loadMore">
          {{ t('rv.more') }}
        </button>
      </template>
    </template>

    <NModal
      :show="!!reporting"
      preset="card"
      :title="t('rv.reportTitle')"
      style="max-width: 440px"
      @update:show="(v: boolean) => !v && (reporting = null)"
    >
      <label class="a-sr" for="rv-reason">{{ t('rv.reasonLabel') }}</label>
      <textarea
        id="rv-reason"
        v-model="reason"
        class="rv__ta"
        rows="3"
        maxlength="300"
        :placeholder="t('rv.reasonPh')"
        data-test="report-reason"
      />
      <p v-if="reasonErr" class="rv__err" role="alert">{{ reasonErr }}</p>
      <div class="rv__act">
        <button type="button" class="a-pill a-pill--ghost" @click="reporting = null">
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="a-pill a-pill--solid"
          :aria-busy="busy"
          :disabled="busy"
          data-test="report-send"
          @click="sendReport"
        >
          {{ t('rv.reportSend') }}
        </button>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.rv__sum {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.rv__avg {
  font-size: 40px;
  line-height: 1;
  color: var(--a-cream);
}
.rv__list {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: grid;
  gap: 12px;
}
.rv__item {
  padding: 16px 18px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
  display: grid;
  gap: 8px;
}
.rv__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.rv__body {
  margin: 0;
  overflow-wrap: anywhere;
}
.rv__reply {
  margin: 0;
  padding: 10px 12px;
  border-left: 3px solid var(--a-gold);
  background: var(--a-bg3);
  border-radius: 0 10px 10px 0;
  font-size: 14px;
}
.rv__rep {
  justify-self: start;
  min-height: 36px;
  padding: 0 4px;
  border: 0;
  background: none;
  color: var(--a-muted);
  font: inherit;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}
.rv__rep:hover {
  color: var(--a-gold);
}
.rv__ta {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid var(--a-line-strong);
  border-radius: 14px;
  font: inherit;
  resize: vertical;
}
.rv__err {
  color: var(--a-danger, #b3261e);
  margin: 8px 0 0;
}
.rv__act {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
</style>
