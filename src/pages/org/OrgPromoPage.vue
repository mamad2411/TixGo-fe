<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Plus, Tag } from '@vicons/tabler'
import { NIcon, NInput, NInputNumber, NSwitch, useMessage } from 'naive-ui'
import { computed, inject, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  createPromo,
  listPromos,
  patchPromo,
  promoReport,
  type Promo,
  type PromoReport,
} from '@/api/organizer'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import { ORG_EVENT } from '@/components/dash/orgEventCtx'
import SideSheet from '@/components/dash/SideSheet.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { formatRupiah } from '@/utils/format'

// Kode promo per event. Diskon dihitung server; di sini hanya membuat/mengatur kode dan membaca laporan pemakaiannya.
const { t, locale } = useI18n()
useHead({ title: computed(() => t('dash.event.tab.promo')) })
const message = useMessage()
const apiMessage = useApiMessage()
const ctx = inject(ORG_EVENT)!
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const rp = (n: number) => formatRupiah(n, bcp.value)
const nf = (n: number) => new Intl.NumberFormat(bcp.value).format(n)
const day = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat(bcp.value, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(iso))
    : ''
const evId = computed(() => ctx.ev.value?.id ?? '')

const rows = ref<Promo[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = await listPromos(evId.value)
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

const label = (p: Promo) => (p.kind === 'percent' ? `${p.value}%` : rp(p.value))
const period = (p: Promo) =>
  p.starts_at || p.ends_at
    ? t('dash.event.promo.period', { a: day(p.starts_at) || '…', b: day(p.ends_at) || '…' })
    : t('dash.event.promo.always')

async function toggle(p: Promo, v: boolean): Promise<void> {
  const prev = p.active
  p.active = v
  try {
    await patchPromo(evId.value, p.id, { active: v })
  } catch (e) {
    p.active = prev
    message.error(apiMessage(e))
  }
}

// laporan per kode (dimuat saat dibuka)
const reports = reactive<Record<string, PromoReport | 'loading' | 'error'>>({})
async function report(p: Promo): Promise<void> {
  if (reports[p.id] && reports[p.id] !== 'error') {
    delete reports[p.id]
    return
  }
  reports[p.id] = 'loading'
  try {
    reports[p.id] = await promoReport(evId.value, p.id)
  } catch {
    reports[p.id] = 'error'
  }
}

// ---- buat kode ----
const open = ref(false)
const busy = ref(false)
const f = reactive({
  code: '',
  kind: 'percent' as 'percent' | 'fixed',
  value: null as number | null,
  max_uses: null as number | null,
  max_per_account: null as number | null,
  min_total: null as number | null,
  starts_at: '',
  ends_at: '',
  tier_ids: [] as string[],
})
function newPromo(): void {
  Object.assign(f, {
    code: '',
    kind: 'percent',
    value: null,
    max_uses: null,
    max_per_account: null,
    min_total: null,
    starts_at: '',
    ends_at: '',
    tier_ids: [],
  })
  open.value = true
}
const codeOk = computed(() => /^[A-Z0-9_-]{3,32}$/.test(f.code))
const valueOk = computed(() => !!f.value && f.value > 0 && (f.kind === 'fixed' || f.value <= 100))
const rangeOk = computed(
  () => !f.starts_at || !f.ends_at || new Date(f.ends_at) > new Date(f.starts_at),
)
const formOk = computed(() => codeOk.value && valueOk.value && rangeOk.value)
const iso = (v: string): string | undefined => (v ? new Date(v).toISOString() : undefined)

async function save(): Promise<void> {
  if (!formOk.value || busy.value) return
  busy.value = true
  try {
    await createPromo(evId.value, {
      code: f.code,
      kind: f.kind,
      value: f.value!,
      max_uses: f.max_uses || undefined,
      max_per_account: f.max_per_account || undefined,
      min_total: f.min_total || undefined,
      starts_at: iso(f.starts_at),
      ends_at: iso(f.ends_at),
      tier_ids: f.tier_ids.length ? f.tier_ids : undefined,
    })
    message.success(t('dash.event.promo.created'))
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
  <div data-test="org-promo">
    <div class="bar">
      <p class="a-muted bar__l">{{ t('dash.event.promo.lead') }}</p>
      <button type="button" class="a-pill a-pill--solid" data-test="promo-new" @click="newPromo">
        <NIcon :component="Plus" :size="18" aria-hidden="true" /> {{ t('dash.event.promo.new') }}
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
      :icon="Tag"
      :title="t('dash.event.promo.emptyT')"
      :body="t('dash.event.promo.emptyB')"
    >
      <button type="button" class="a-pill a-pill--solid" @click="newPromo">
        {{ t('dash.event.promo.new') }}
      </button>
    </EmptyState>
    <ul v-else class="ls" data-test="promo-list">
      <li v-for="p in rows" :key="p.id" class="card" :class="{ 'is-off': !p.active }">
        <div class="card__top">
          <span class="code">{{ p.code }}</span>
          <strong class="off">{{ t('dash.event.promo.off', { v: label(p) }) }}</strong>
          <span class="sw">
            <NSwitch
              :value="p.active"
              :aria-label="t('dash.event.promo.active', { c: p.code })"
              @update:value="(v: boolean) => toggle(p, v)"
            />
            <small class="a-muted">{{
              p.active ? t('dash.event.promo.on') : t('dash.event.promo.paused')
            }}</small>
          </span>
        </div>
        <p class="meta a-muted">
          {{ t('dash.event.promo.used', { u: nf(p.used), m: p.max_uses ? nf(p.max_uses) : '∞' }) }}
          · {{ period(p) }}
          <template v-if="p.min_total">
            · {{ t('dash.event.promo.min', { v: rp(p.min_total) }) }}</template
          >
        </p>
        <button
          type="button"
          class="link"
          :aria-expanded="!!reports[p.id]"
          data-test="promo-report"
          @click="report(p)"
        >
          {{ reports[p.id] ? t('dash.event.promo.hideReport') : t('dash.event.promo.report') }}
        </button>
        <div v-if="reports[p.id]" class="rep" aria-live="polite">
          <span v-if="reports[p.id] === 'loading'" class="a-muted">{{ t('common.loading') }}</span>
          <span v-else-if="reports[p.id] === 'error'" class="bad">{{
            t('dash.event.promo.reportErr')
          }}</span>
          <dl v-else>
            <div>
              <dt>{{ t('dash.event.promo.r.n') }}</dt>
              <dd>{{ nf((reports[p.id] as PromoReport).redemptions) }}</dd>
            </div>
            <div>
              <dt>{{ t('dash.event.promo.r.disc') }}</dt>
              <dd>{{ rp((reports[p.id] as PromoReport).discount_total) }}</dd>
            </div>
            <div>
              <dt>{{ t('dash.event.promo.r.rev') }}</dt>
              <dd>{{ rp((reports[p.id] as PromoReport).revenue) }}</dd>
            </div>
          </dl>
        </div>
      </li>
    </ul>

    <SideSheet v-model:show="open" :title="t('dash.event.promo.new')">
      <form class="fm" data-test="promo-form" novalidate @submit.prevent="save">
        <label for="pr-code">{{ t('dash.event.promo.code') }}</label>
        <NInput
          id="pr-code"
          v-model:value="f.code"
          :maxlength="32"
          :placeholder="'HEMAT10'"
          data-test="pr-code"
          @update:value="(v: string) => (f.code = v.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))"
        />
        <small :class="f.code && !codeOk ? 'bad' : 'a-muted'">{{
          t('dash.event.promo.codeHint')
        }}</small>

        <fieldset class="kind">
          <legend>{{ t('dash.event.promo.kind') }}</legend>
          <label
            ><input v-model="f.kind" type="radio" value="percent" />
            {{ t('dash.event.promo.percent') }}</label
          >
          <label
            ><input v-model="f.kind" type="radio" value="fixed" />
            {{ t('dash.event.promo.fixed') }}</label
          >
        </fieldset>
        <label for="pr-val">{{
          f.kind === 'percent' ? t('dash.event.promo.valuePct') : t('dash.event.promo.valueRp')
        }}</label>
        <NInputNumber
          id="pr-val"
          v-model:value="f.value"
          :min="1"
          :max="f.kind === 'percent' ? 100 : undefined"
          :show-button="false"
          data-test="pr-val"
        />
        <small v-if="f.value && !valueOk" class="bad" role="alert">{{
          t('dash.event.promo.valueBad')
        }}</small>

        <div class="two">
          <div>
            <label for="pr-max">{{ t('dash.event.promo.maxUses') }}</label><NInputNumber
              id="pr-max"
              v-model:value="f.max_uses"
              :min="1"
              :show-button="false"
              :placeholder="t('dash.event.promo.noLimit')"
            />
          </div>
          <div>
            <label for="pr-acc">{{ t('dash.event.promo.perAcc') }}</label><NInputNumber
              id="pr-acc"
              v-model:value="f.max_per_account"
              :min="1"
              :max="50"
              :show-button="false"
              :placeholder="'1'"
            />
          </div>
        </div>
        <label for="pr-min">{{ t('dash.event.promo.minTotal') }}</label>
        <NInputNumber
          id="pr-min"
          v-model:value="f.min_total"
          :min="0"
          :show-button="false"
          :placeholder="'0'"
        />

        <div class="two">
          <div>
            <label for="pr-s">{{ t('dash.event.promo.starts') }}</label><input
              id="pr-s"
              v-model="f.starts_at"
              type="datetime-local"
              class="dt"
            />
          </div>
          <div>
            <label for="pr-e">{{ t('dash.event.promo.ends') }}</label><input
              id="pr-e"
              v-model="f.ends_at"
              type="datetime-local"
              class="dt"
            />
          </div>
        </div>
        <small v-if="!rangeOk" class="bad" role="alert">{{ t('dash.event.promo.rangeBad') }}</small>

        <fieldset v-if="ctx.ev.value?.tiers.length" class="tiers">
          <legend>{{ t('dash.event.promo.tiers') }}</legend>
          <small class="a-muted">{{ t('dash.event.promo.tiersHint') }}</small>
          <label v-for="k in ctx.ev.value.tiers" :key="k.id"
            ><input v-model="f.tier_ids" type="checkbox" :value="k.id" /> {{ k.name }}</label
          >
        </fieldset>
      </form>
      <template #footer>
        <div class="dec">
          <button
            type="button"
            class="a-pill a-pill--solid"
            :disabled="!formOk || busy"
            :aria-busy="busy"
            data-test="promo-save"
            @click="save"
          >
            {{ t('dash.event.promo.create') }}
          </button>
          <button type="button" class="a-pill" :disabled="busy" @click="open = false">
            {{ t('org.cancel') }}
          </button>
        </div>
      </template>
    </SideSheet>
  </div>
</template>

<style scoped>
.bar {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}
.bar__l {
  margin: 0;
  max-width: 60ch;
  font-size: 14px;
}
.list-sk {
  min-height: 200px;
  border-radius: 16px;
}
.ls {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.card {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
}
.card.is-off {
  opacity: 0.7;
}
.card__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}
.code {
  padding: 4px 12px;
  border: 1.5px dashed var(--a-gold);
  border-radius: 8px;
  color: var(--a-gold);
  font-family: ui-monospace, 'Space Mono', monospace;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.off {
  font-size: 18px;
}
.sw {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.meta {
  margin: 0;
  font-size: 13.5px;
}
.link {
  justify-self: start;
  min-height: 36px;
  border: 0;
  background: none;
  padding: 0;
  color: var(--a-gold);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}
.rep dl {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--a-bg3);
}
.rep dt {
  color: var(--a-muted);
  font-size: 12px;
}
.rep dd {
  margin: 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.bad {
  color: var(--a-danger);
}
.fm {
  display: grid;
  gap: 8px;
}
.fm label {
  font-size: 14px;
  font-weight: 600;
}
.kind,
.tiers {
  display: grid;
  gap: 6px;
  margin: 4px 0;
  padding: 10px 12px;
  border: 1px solid var(--a-line);
  border-radius: 12px;
}
.kind legend,
.tiers legend {
  padding: 0 6px;
  font-size: 13px;
  font-weight: 700;
}
.kind label,
.tiers label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  font-weight: 500;
}
.kind input,
.tiers input {
  width: 18px;
  height: 18px;
  accent-color: var(--a-gold);
}
.two {
  display: grid;
  gap: 8px;
}
.two > div {
  display: grid;
  gap: 6px;
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
.dec {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
@media (min-width: 720px) {
  .bar {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }
  .two {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
