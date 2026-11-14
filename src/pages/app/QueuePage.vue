<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Clock, ShieldCheck, Users } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { getEvent, type PublicEvent } from '@/api/events'
import { queueJoin, queueLeave, queueStatus, type QueueStatus } from '@/api/queue'
import BackLink from '@/components/app/BackLink.vue'
import Countdown from '@/components/app/Countdown.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useHeaderTone } from '@/composables/useHeaderTone'
import { useAdmissionStore } from '@/stores/admission'
import '@/pages/account/accountStyle.css'

// Ruang tunggu antre adil. Bahasa sederhana: kamu tidak perlu menyegarkan halaman, urutan diacak saat dibuka,
// datang lebih awal tidak menguntungkan, dan ada batas waktu setelah giliranmu tiba.
const { t } = useI18n()
useHeaderTone(computed(() => 'light'))
const route = useRoute()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const admission = useAdmissionStore()
const slug = computed(() => String(route.params.slug))
useHead({ title: computed(() => t('wr.title')) })

const ev = ref<PublicEvent | null>(null)
const st = ref<QueueStatus | null>(null)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const busy = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let alive = true

async function poll(): Promise<void> {
  clearTimeout(timer)
  try {
    st.value = await queueStatus(slug.value)
    if (st.value.state === 'admitted' && st.value.token) {
      admission.set(slug.value, st.value.token, st.value.expires_at)
    }
    state.value = 'ok'
  } catch (e) {
    if (!st.value) {
      err.value = apiMessage(e)
      state.value = 'error'
    }
  }
  if (!alive) return
  const s = st.value?.state
  // Cepat saat menunggu giliran, santai saat sudah admit / belum gabung.
  const wait = s === 'queued' || s === 'waiting_room' ? 3000 : s === 'admitted' ? 8000 : 15000
  if (!document.hidden || s === 'queued') timer = setTimeout(() => void poll(), wait)
}
onMounted(async () => {
  try {
    ev.value = await getEvent(slug.value)
  } catch {
    /* judul opsional; antre tetap jalan */
  }
  void poll()
})
onBeforeUnmount(() => {
  alive = false
  clearTimeout(timer)
})

async function join(): Promise<void> {
  busy.value = true
  try {
    st.value = await queueJoin(slug.value)
    void poll()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
async function leave(): Promise<void> {
  busy.value = true
  try {
    await queueLeave(slug.value)
    admission.clear(slug.value)
    message.success(t('wr.left'))
    await poll()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
function pick(): void {
  void router.push({ name: 'event', params: { slug: slug.value }, hash: '#tiket' })
}

const eta = computed(() => {
  const s = st.value?.eta_sec ?? 0
  if (s <= 0) return t('wr.etaSoon')
  const m = Math.ceil(s / 60)
  return m <= 1 ? t('wr.etaMin1') : t('wr.etaMin', { n: m })
})
const progress = computed(() => {
  const total = st.value?.total ?? 0
  const ahead = st.value?.ahead ?? 0
  return total > 0 ? Math.max(4, Math.round(((total - ahead) / total) * 100)) : 4
})
</script>

<template>
  <ToneLight class="tone-page">
    <div class="wr">
      <BackLink plain :fallback="{ name: 'event', params: { slug } }" />
      <div
        v-if="state === 'loading'"
        class="a-sk"
        style="min-height: 280px; border-radius: 20px"
        role="status"
        :aria-label="t('common.loading')"
      />
      <ErrorState v-else-if="state === 'error'" :message="err" @retry="poll" />
      <section
        v-else-if="st"
        class="wr__card"
        data-test="queue"
        :data-state="st.state"
        aria-live="polite"
      >
        <p class="a-caps">{{ t('wr.kicker') }}</p>
        <h1 class="a-serif">{{ ev?.title ?? t('wr.title') }}</h1>

        <template v-if="st.state === 'none'">
          <p class="wr__lead">{{ t('wr.noneLead') }}</p>
          <ul class="wr__rules">
            <li>
              <NIcon :component="ShieldCheck" :size="18" aria-hidden="true" /> {{ t('wr.fair') }}
            </li>
            <li>
              <NIcon :component="Users" :size="18" aria-hidden="true" /> {{ t('wr.noRefresh') }}
            </li>
            <li>
              <NIcon :component="Clock" :size="18" aria-hidden="true" /> {{ t('wr.timeLimit') }}
            </li>
          </ul>
          <button
            type="button"
            class="a-pill a-pill--solid wr__cta"
            :disabled="busy"
            data-test="queue-join"
            @click="join"
          >
            {{ busy ? t('common.loading') : t('wr.join') }}
          </button>
        </template>

        <template v-else-if="st.state === 'waiting_room'">
          <p class="wr__lead">{{ t('wr.waitingLead') }}</p>
          <div v-if="st.opens_at" class="wr__opens">
            <p class="a-caps">{{ t('wr.opensIn') }}</p>
            <Countdown :to="st.opens_at" @done="poll" />
          </div>
          <p class="a-muted">{{ t('wr.randomNote') }}</p>
          <button type="button" class="a-pill" :disabled="busy" @click="leave">
            {{ t('wr.leave') }}
          </button>
        </template>

        <template v-else-if="st.state === 'queued'">
          <p class="wr__lead">{{ t('wr.queuedLead') }}</p>
          <div class="wr__pos" data-test="queue-pos">
            <strong>{{ st.position }}</strong>
            <span>{{ t('wr.position') }}</span>
          </div>
          <div
            class="wr__bar"
            role="progressbar"
            :aria-valuenow="progress"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="t('wr.position')"
          >
            <span :style="{ width: `${progress}%` }" />
          </div>
          <p class="a-muted">
            {{ t('wr.ahead', { n: st.ahead ?? 0, total: st.total ?? 0 }) }} · {{ t('wr.eta') }}
            <strong>{{ eta }}</strong>
          </p>
          <p class="wr__keep">{{ t('wr.keepOpen') }}</p>
          <button
            type="button"
            class="a-pill"
            :disabled="busy"
            data-test="queue-leave"
            @click="leave"
          >
            {{ t('wr.leave') }}
          </button>
        </template>

        <template v-else-if="st.state === 'admitted'">
          <p class="wr__lead wr__go">{{ t('wr.admittedLead') }}</p>
          <div v-if="st.expires_at" class="wr__opens">
            <p class="a-caps">{{ t('wr.timeLeft') }}</p>
            <Countdown :to="st.expires_at" @done="poll" />
          </div>
          <button
            type="button"
            class="a-pill a-pill--solid wr__cta"
            data-test="queue-pick"
            @click="pick"
          >
            {{ t('wr.pick') }}
          </button>
        </template>

        <template v-else>
          <p class="wr__lead">{{ st.state === 'done' ? t('wr.doneLead') : t('wr.expiredLead') }}</p>
          <div class="ac__act">
            <button
              v-if="st.state === 'expired'"
              type="button"
              class="a-pill a-pill--solid"
              :disabled="busy"
              @click="join"
            >
              {{ t('wr.rejoin') }}
            </button>
            <RouterLink class="a-pill" :to="{ name: 'orders' }">{{ t('acct.orders') }}</RouterLink>
          </div>
        </template>
      </section>
    </div>
  </ToneLight>
</template>

<style scoped>
.wr {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px var(--a-pad) 72px;
  display: grid;
  gap: 18px;
}
.wr__card {
  display: grid;
  gap: 16px;
  padding: clamp(22px, 4vw, 36px);
  border: 1px solid var(--a-line);
  border-radius: 24px;
  background:
    radial-gradient(
      120% 120% at 100% 0%,
      color-mix(in srgb, var(--a-gold) 16%, transparent),
      transparent 60%
    ),
    var(--a-panel);
}
.wr__card h1 {
  margin: 0;
  font-size: clamp(28px, 5vw, 44px);
  color: var(--a-cream);
  line-height: 1.1;
  overflow-wrap: anywhere;
}
.wr__card p {
  margin: 0;
}
.wr__lead {
  font-size: 18px;
  line-height: 1.5;
}
.wr__go {
  color: var(--a-gold);
  font-weight: 700;
  font-size: 22px;
}
.wr__rules {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.wr__rules li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.wr__rules :deep(svg) {
  flex: none;
  margin-top: 3px;
  color: var(--a-gold);
}
.wr__cta {
  justify-self: start;
  min-height: 52px;
  padding: 0 28px;
  font-size: 16px;
}
.wr__pos {
  display: grid;
  justify-items: start;
}
.wr__pos strong {
  font: 700 clamp(56px, 14vw, 96px)/1 var(--a-serif, serif);
  color: var(--a-gold);
}
.wr__pos span {
  color: var(--a-muted);
}
.wr__bar {
  height: 10px;
  border-radius: 5px;
  background: var(--a-line);
  overflow: hidden;
}
.wr__bar span {
  display: block;
  height: 100%;
  background: var(--a-gold);
  transition: width 0.8s ease;
}
@media (prefers-reduced-motion: reduce) {
  .wr__bar span {
    transition: none;
  }
}
.wr__keep {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--a-bg2);
  font-size: 14px;
}
.wr__opens {
  display: grid;
  gap: 6px;
}
</style>
