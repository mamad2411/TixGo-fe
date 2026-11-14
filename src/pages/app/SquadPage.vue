<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Check, Copy, Crown, Mail } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { toApiError } from '@/api/errors'
import {
  cancelSquad,
  extendSquad,
  getSquad,
  inviteToSquad,
  paySquad,
  type Squad,
} from '@/api/squad'
import BackLink from '@/components/app/BackLink.vue'
import Countdown from '@/components/app/Countdown.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import SkeletonPage from '@/components/app/SkeletonPage.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useAuthStore } from '@/stores/auth'

// Ruang squad: kode ajak teman, status bayar tiap anggota, hitung mundur hold. Ketua bisa mengundang lewat
// email, memperpanjang, dan membatalkan. Halaman menyegarkan diri tiap 10 detik selama masih ditahan.
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const auth = useAuthStore()
const id = computed(() => String(route.params.id))
useHead({ title: computed(() => t('sq.title')) })

const sq = ref<Squad | null>(null)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const busy = ref('')
let timer: ReturnType<typeof setInterval> | undefined

async function load(quiet = false): Promise<void> {
  if (!quiet) state.value = 'loading'
  try {
    sq.value = await getSquad(id.value)
    state.value = 'ok'
  } catch (e) {
    if (!quiet || state.value !== 'ok') {
      err.value = apiMessage(e)
      state.value = 'error'
    }
  }
}
onMounted(() => {
  void load()
  timer = setInterval(() => {
    if (sq.value?.status === 'holding' && !document.hidden) void load(true)
  }, 10_000)
})
onBeforeUnmount(() => clearInterval(timer))

const me = computed(() => sq.value?.members.find((m) => m.user_id === auth.user?.id))
const isLeader = computed(() => !!me.value?.leader)
const active = computed(() => sq.value?.status === 'holding')
const link = computed(() => `${location.origin}/squad/${sq.value?.code ?? ''}`)

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    message.success(t('sq.copied'))
  } catch {
    message.error(t('sq.copyFail'))
  }
}

async function run(key: string, fn: () => Promise<void>): Promise<void> {
  busy.value = key
  try {
    await fn()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = ''
  }
}
// Acara dengan batas usia: BE menolak sampai pengguna mengonfirmasi. Slotmu tetap ditahan; kirim ulang
// dengan konfirmasi (BE mendukung percobaan ulang atas hold anggota yang sama).
const ageMin = ref<number | null>(null)
const ageOk = ref(false)
async function pay(): Promise<void> {
  if (ageMin.value !== null && !ageOk.value) return
  busy.value = 'pay'
  try {
    const r = await paySquad(id.value, { ageConfirmed: ageOk.value })
    await router.push({ name: 'order-pay', params: { id: r.order.id } })
  } catch (e) {
    const err = toApiError(e)
    if (err.code === 'AGE_CONFIRMATION_REQUIRED') ageMin.value = Number(err.details.age_min) || 0
    else message.error(apiMessage(e))
  } finally {
    busy.value = ''
  }
}
const extend = () =>
  run('extend', async () => {
    sq.value = await extendSquad(id.value)
    message.success(t('sq.extended'))
  })
const confirmCancel = ref(false)
const cancel = () =>
  run('cancel', async () => {
    await cancelSquad(id.value)
    message.success(t('sq.cancelled'))
    confirmCancel.value = false
    await load()
  })

const email = ref('')
const emailErr = ref('')
const invite = () => {
  emailErr.value = /^\S+@\S+\.\S+$/.test(email.value.trim()) ? '' : t('sq.errEmail')
  if (emailErr.value) return Promise.resolve()
  return run('invite', async () => {
    await inviteToSquad(id.value, email.value.trim())
    message.success(t('sq.invited', { e: email.value.trim() }))
    email.value = ''
  })
}
</script>

<template>
  <ToneLight class="tone-page">
    <div class="sq">
      <BackLink plain class="pg-back" :fallback="{ name: 'squads' }" :label="t('sq.back')" />
      <SkeletonPage v-if="state === 'loading'" :rows="4" />
      <ErrorState v-else-if="state === 'error'" :message="err" @retry="load()" />
      <template v-else-if="sq">
        <header class="sq__head">
          <p class="a-caps">{{ t('sq.kicker') }}</p>
          <h1 class="a-serif">{{ sq.event_title || t('sq.title') }}</h1>
          <p class="a-muted">
            {{ t(`sq.st.${sq.status}`) }} · {{ t('sq.progress', { paid: sq.paid, size: sq.size }) }}
          </p>
          <div
            class="sq__bar"
            role="progressbar"
            :aria-valuenow="sq.paid"
            :aria-valuemax="sq.size"
            :aria-label="t('sq.progress', { paid: sq.paid, size: sq.size })"
          >
            <span :style="{ width: `${(sq.paid / sq.size) * 100}%` }" />
          </div>
        </header>

        <section v-if="active && sq.expires_at" class="sq__card" data-test="squad-timer">
          <h2 class="a-serif">{{ t('sq.timeLeft') }}</h2>
          <Countdown :to="sq.expires_at" @done="load(true)" />
          <p class="a-muted">
            {{ t(sq.policy === 'cancel_all' ? 'sq.policyAll' : 'sq.policyFree') }}
          </p>
        </section>

        <section v-if="active" class="sq__card">
          <h2 class="a-serif">{{ t('sq.invite') }}</h2>
          <p class="a-muted">{{ t('sq.inviteLead', { n: sq.open_slots }) }}</p>
          <div class="sq__code">
            <code data-test="squad-code">{{ sq.code }}</code>
            <button type="button" class="a-pill a-pill--sm" @click="copy(sq.code)">
              <NIcon :component="Copy" :size="16" aria-hidden="true" /> {{ t('sq.copyCode') }}
            </button>
            <button
              type="button"
              class="a-pill a-pill--sm"
              data-test="squad-link"
              @click="copy(link)"
            >
              {{ t('sq.copyLink') }}
            </button>
          </div>
          <form v-if="isLeader" class="sq__mail" novalidate @submit.prevent="invite">
            <label for="sq-email" class="a-sr">{{ t('sq.emailLabel') }}</label>
            <input
              id="sq-email"
              v-model="email"
              type="email"
              inputmode="email"
              :placeholder="t('sq.emailPh')"
              data-test="squad-email"
            />
            <button
              type="submit"
              class="a-pill"
              :aria-busy="busy === 'invite'"
              :disabled="busy === 'invite'"
              data-test="squad-invite"
            >
              <NIcon :component="Mail" :size="16" aria-hidden="true" /> {{ t('sq.sendInvite') }}
            </button>
            <small v-if="emailErr" class="sq__err" role="alert">{{ emailErr }}</small>
          </form>
        </section>

        <section class="sq__card">
          <h2 class="a-serif">{{ t('sq.members') }}</h2>
          <ul class="sq__list" data-test="squad-members">
            <li v-for="m in sq.members" :key="m.user_id" :data-status="m.status">
              <span class="sq__who">
                <NIcon v-if="m.leader" :component="Crown" :size="16" :title="t('sq.leader')" />
                <strong>{{ m.name }}</strong>
                <small v-if="m.user_id === auth.user?.id" class="a-muted"
                  >({{ t('sq.you') }})</small
                >
                <small v-if="m.seat_label" class="a-muted">· {{ m.seat_label }}</small>
              </span>
              <span class="sq__chip" :class="`sq__chip--${m.status}`">
                <NIcon
                  v-if="m.status === 'paid'"
                  :component="Check"
                  :size="14"
                  aria-hidden="true"
                />
                {{ t(`sq.ms.${m.status}`) }}
              </span>
            </li>
            <li v-for="n in Math.max(sq.open_slots, 0)" :key="`o${n}`" class="sq__open">
              <span class="a-muted">{{ t('sq.openSlot') }}</span>
            </li>
          </ul>
        </section>

        <label v-if="ageMin !== null" class="sq__age" data-test="squad-age">
          <input v-model="ageOk" type="checkbox" data-test="squad-age-ok" />
          <span>{{ t('sq.age', { n: ageMin }) }}</span>
        </label>
        <div class="sq__act">
          <button
            v-if="active && me?.status === 'joined'"
            type="button"
            class="a-pill a-pill--solid"
            :aria-busy="busy === 'pay'"
            :disabled="!!busy || (ageMin !== null && !ageOk)"
            data-test="squad-pay"
            @click="pay"
          >
            {{ t('sq.payMine') }}
          </button>
          <RouterLink
            v-else-if="me?.status === 'paid'"
            :to="{ name: 'tickets' }"
            class="a-pill a-pill--solid"
            >{{ t('sq.toTickets') }}</RouterLink
          >
          <button
            v-if="active && isLeader"
            type="button"
            class="a-pill"
            :aria-busy="busy === 'extend'"
            :disabled="!!busy"
            data-test="squad-extend"
            @click="extend"
          >
            {{ t('sq.extend') }}
          </button>
          <template v-if="active && isLeader">
            <button
              v-if="!confirmCancel"
              type="button"
              class="a-pill a-pill--ghost"
              data-test="squad-cancel"
              @click="confirmCancel = true"
            >
              {{ t('sq.cancel') }}
            </button>
            <span v-else class="sq__confirm" role="alert">
              {{ t('sq.cancelAsk') }}
              <button
                type="button"
                class="a-pill a-pill--sm a-pill--solid"
                :disabled="!!busy"
                data-test="squad-cancel-yes"
                @click="cancel"
              >
                {{ t('sq.cancelYes') }}
              </button>
              <button
                type="button"
                class="a-pill a-pill--sm a-pill--ghost"
                @click="confirmCancel = false"
              >
                {{ t('sq.cancelNo') }}
              </button>
            </span>
          </template>
        </div>
      </template>
    </div>
  </ToneLight>
</template>

<style scoped>
.sq {
  max-width: 760px;
  margin: 0 auto;
  padding: 28px var(--a-pad) 64px;
  display: grid;
  gap: 18px;
}
.sq__head h1 {
  font-size: clamp(30px, 4vw, 44px);
  color: var(--a-cream);
  margin: 4px 0;
}
.sq__bar {
  height: 8px;
  border-radius: 999px;
  background: var(--a-bg3);
  overflow: hidden;
  margin-top: 10px;
}
.sq__bar span {
  display: block;
  height: 100%;
  background: var(--a-gold);
  transition: width 0.4s;
}
.sq__card {
  display: grid;
  gap: 10px;
  padding: 18px 20px;
  border: 1px solid var(--a-line);
  border-radius: 18px;
  background: var(--a-panel);
}
.sq__card h2 {
  margin: 0;
  font-size: 20px;
}
.sq__code {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.sq__code code {
  padding: 8px 14px;
  border-radius: 12px;
  background: var(--a-bg3);
  font-size: 22px;
  letter-spacing: 0.18em;
  font-weight: 700;
}
.sq__mail {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.sq__mail input {
  flex: 1 1 220px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: var(--a-panel);
  color: var(--a-ink);
  font: inherit;
}
.sq__mail input:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 2px;
}
.sq__err {
  flex-basis: 100%;
  color: var(--a-danger, #b3261e);
}
.sq__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.sq__list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--a-line);
  border-radius: 12px;
}
.sq__open {
  border-style: dashed !important;
}
.sq__who {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.sq__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: var(--a-bg3);
  color: var(--a-ink);
}
.sq__chip--paid {
  background: var(--a-gold);
  color: var(--a-on-gold, var(--a-bg));
}
.sq__chip--released {
  opacity: 0.6;
}
.sq__act {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.sq__age {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--a-gold);
  border-radius: 14px;
}
.sq__confirm {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
