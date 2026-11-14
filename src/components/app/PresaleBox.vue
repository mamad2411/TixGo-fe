<script setup lang="ts">
import { Ticket } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { redeemPresale, registerFan, type PublicEvent } from '@/api/events'
import { useApiMessage } from '@/composables/useApiMessage'
import { useRequireLogin } from '@/composables/useRequireLogin'
import { useAuthStore } from '@/stores/auth'
import { formatEventDate } from '@/utils/format'

// Fase penjualan khusus: kode presale (siapa pun yang punya kodenya) dan fase fans (daftar dulu, penyelenggara
// memilih). Hanya tampil selama ada fase non-publik yang belum berakhir.
const props = defineProps<{ event: PublicEvent }>()
const { t, locale } = useI18n()
const message = useMessage()
const apiMessage = useApiMessage()
const requireLogin = useRequireLogin()
const auth = useAuthStore()

const now = () => Date.now()
const phases = computed(() =>
  props.event.phases.filter((p) => p.audience !== 'public' && Date.parse(p.ends_at) > now()),
)
const codePhase = computed(() => phases.value.find((p) => p.audience === 'code'))
// Pendaftaran fans hanya dibuka sebelum fasenya mulai (aturan BE: SALE_NOT_OPEN setelahnya).
const fanPhase = computed(() =>
  phases.value.find((p) => p.audience === 'fan' && Date.parse(p.starts_at) > now()),
)
const fmt = (iso: string) =>
  formatEventDate(iso, props.event.tz, locale.value === 'en' ? 'en-GB' : 'id-ID')

// Status "sudah daftar fans" tidak punya endpoint baca; disimpan per akun di peramban (pola sama dengan pengingat).
const KEY = 'tixgo.fan'
const key = computed(() => `${KEY}.${auth.user?.id ?? 'tamu'}`)
function read(): boolean {
  try {
    const l: unknown = JSON.parse(localStorage.getItem(key.value) ?? '[]')
    return Array.isArray(l) && l.includes(props.event.slug)
  } catch {
    return false
  }
}
function write(): void {
  try {
    const l: unknown = JSON.parse(localStorage.getItem(key.value) ?? '[]')
    const set = new Set<string>(Array.isArray(l) ? (l as string[]) : [])
    set.add(props.event.slug)
    localStorage.setItem(key.value, JSON.stringify([...set]))
  } catch {
    // penyimpanan diblokir: status hanya bertahan selama halaman terbuka
  }
}
const fanDone = ref(false)
watch(
  () => [props.event.slug, auth.user?.id],
  () => (fanDone.value = auth.isAuthed && read()),
  { immediate: true },
)

const code = ref('')
const codeErr = ref('')
const opened = ref('')
const busy = ref('')

async function redeem(): Promise<void> {
  codeErr.value = ''
  if (!code.value.trim()) {
    codeErr.value = t('ps.errCode')
    return
  }
  if (!(await requireLogin('ps.needLogin'))) return
  busy.value = 'code'
  try {
    const ph = await redeemPresale(props.event.slug, code.value.trim())
    opened.value = ph.name
    code.value = ''
    message.success(t('ps.opened', { n: ph.name }))
  } catch (e) {
    codeErr.value = apiMessage(e)
  } finally {
    busy.value = ''
  }
}
async function fan(): Promise<void> {
  if (!(await requireLogin('ps.needLogin'))) return
  busy.value = 'fan'
  try {
    await registerFan(props.event.slug)
    fanDone.value = true
    write()
    message.success(t('ps.fanOk'))
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <section v-if="phases.length" class="ps" data-test="presale">
    <h3 class="ps__h">
      <NIcon :component="Ticket" :size="18" aria-hidden="true" /> {{ t('ps.title') }}
    </h3>
    <ul class="ps__list">
      <li v-for="p in phases" :key="p.id">
        <strong>{{ p.name }}</strong>
        <small class="a-muted"
          >{{ t(`ps.aud.${p.audience}`, p.audience) }} · {{ fmt(p.starts_at) }}</small
        >
      </li>
    </ul>

    <form v-if="codePhase" class="ps__code" novalidate @submit.prevent="redeem">
      <label for="ps-code">{{ t('ps.codeLabel') }}</label>
      <div class="ps__row">
        <input
          id="ps-code"
          v-model="code"
          autocomplete="off"
          autocapitalize="characters"
          :placeholder="t('ps.codePh')"
          data-test="presale-code"
        />
        <button
          type="submit"
          class="a-pill a-pill--sm"
          :aria-busy="busy === 'code'"
          :disabled="!!busy"
          data-test="presale-redeem"
        >
          {{ t('ps.use') }}
        </button>
      </div>
      <small v-if="codeErr" class="ps__err" role="alert" data-test="presale-err">{{
        codeErr
      }}</small>
      <small v-else-if="opened" class="ps__ok" role="status" data-test="presale-ok">{{
        t('ps.opened', { n: opened })
      }}</small>
    </form>

    <div v-if="fanPhase" class="ps__fan">
      <p class="a-muted">{{ t('ps.fanLead') }}</p>
      <p v-if="fanDone" class="ps__ok" role="status" data-test="fan-done">{{ t('ps.fanDone') }}</p>
      <button
        v-else
        type="button"
        class="a-pill a-pill--sm"
        :aria-busy="busy === 'fan'"
        :disabled="!!busy"
        data-test="fan-register"
        @click="fan"
      >
        {{ t('ps.fanBtn') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.ps {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px dashed var(--a-gold);
  border-radius: 16px;
}
.ps__h {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  color: var(--a-gold);
}
.ps__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.ps__list li {
  display: grid;
  gap: 1px;
}
.ps__code {
  display: grid;
  gap: 6px;
}
.ps__code label {
  font-size: 14px;
  font-weight: 600;
}
.ps__row {
  display: flex;
  gap: 8px;
}
.ps__row input {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: var(--a-panel);
  color: var(--a-ink);
  font: inherit;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.ps__row input:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 2px;
}
.ps__fan {
  display: grid;
  gap: 8px;
  justify-items: start;
}
.ps__fan p {
  margin: 0;
}
.ps__err {
  color: var(--a-danger, #b3261e);
}
.ps__ok {
  color: var(--a-gold);
  font-weight: 600;
}
</style>
