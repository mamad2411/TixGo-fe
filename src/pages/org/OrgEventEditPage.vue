<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useMessage } from 'naive-ui'
import { computed, inject, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { listArtists, type Artist } from '@/api/artists'
import { getFilters, listVenues } from '@/api/discover'
import type { VenueView } from '@/api/events'
import {
  addTier,
  createOrgEvent,
  deleteTier,
  eventAction,
  getOrgEvent,
  updateOrgEvent,
  type OrgEvent,
  type OrgEventInput,
} from '@/api/organizer'
import ErrorState from '@/components/app/ErrorState.vue'
import ImageUpload from '@/components/org/ImageUpload.vue'
import { ORG_EVENT } from '@/components/dash/orgEventCtx'
import { useApiMessage } from '@/composables/useApiMessage'
import { toApiError } from '@/api/errors'
import { formatRupiah } from '@/utils/format'
import './org.css'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const id = computed(() => (route.params.id ? String(route.params.id) : ''))
const isNew = computed(() => !id.value)
useHead({ title: computed(() => (isNew.value ? t('org.event.new') : t('org.event.edit'))) })

const ev = ref<OrgEvent | null>(null)
const venues = ref<VenueView[]>([])
const artists = ref<Artist[]>([])
const genres = ref<string[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const formErr = ref('')
const missing = ref<string[]>([])
const busy = ref(false)

// Input datetime-local memakai zona perangkat; BE menerima RFC3339.
const toLocal = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const toIso = (v: string): string => new Date(v).toISOString()

const form = reactive({
  title: '',
  description: '',
  genre: '',
  venue_id: '',
  mode: 'general' as 'general' | 'seated',
  starts_at: '',
  doors_at: '',
  ends_at: '',
  max_per_order: 4,
  max_per_account: 4,
  refundable: false,
  refundable_until: '',
  deduction_pct: 0,
  artist_ids: [] as string[],
  poster_asset_id: '',
})
const tier = reactive({ name: '', price: '', quota: '' })
const editable = computed(() => isNew.value || ev.value?.status === 'draft')

// Workspace (layout) memegang salinan event untuk kepala halaman; selalu disamakan di sini.
const wsCtx = inject(ORG_EVENT, null)
function fill(e: OrgEvent): void {
  ev.value = e
  if (wsCtx) wsCtx.ev.value = e
  Object.assign(form, {
    title: e.title,
    description: e.description ?? '',
    genre: e.genre ?? '',
    venue_id: e.venue?.id ?? '',
    mode: e.mode,
    starts_at: toLocal(e.starts_at),
    doors_at: toLocal(e.doors_at),
    ends_at: toLocal(e.ends_at),
    max_per_order: e.max_per_order,
    max_per_account: e.max_per_account,
    refundable: e.refund_policy?.type === 'refundable',
    refundable_until: toLocal(e.refund_policy?.refundable_until ?? null),
    deduction_pct: e.refund_policy?.deduction_pct ?? 0,
    artist_ids: e.artists.map((a) => a.id),
    poster_asset_id: '',
  })
}
async function load(): Promise<void> {
  state.value = 'loading'
  try {
    const [v, a, f] = await Promise.all([
      listVenues({ per_page: 100 }),
      listArtists(),
      getFilters(),
    ])
    venues.value = v.data
    artists.value = a
    genres.value = f.genres
    if (id.value) fill(await getOrgEvent(id.value))
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

function body(): OrgEventInput | null {
  formErr.value = ''
  if (form.title.trim().length < 3) {
    formErr.value = t('org.event.needTitle')
    return null
  }
  if (!form.venue_id) {
    formErr.value = t('org.event.needVenue')
    return null
  }
  if (!form.starts_at) {
    formErr.value = t('org.event.needStart')
    return null
  }
  if (form.refundable && !form.refundable_until) {
    formErr.value = t('org.event.needRefundUntil')
    return null
  }
  const b: OrgEventInput = {
    title: form.title.trim(),
    description: form.description,
    venue_id: form.venue_id,
    mode: form.mode,
    starts_at: toIso(form.starts_at),
    max_per_order: Number(form.max_per_order),
    max_per_account: Number(form.max_per_account),
    artist_ids: form.artist_ids,
    refund_policy: form.refundable
      ? {
          type: 'refundable',
          refundable_until: toIso(form.refundable_until),
          deduction_pct: Number(form.deduction_pct),
          fee_refundable: false,
        }
      : { type: 'non_refundable', fee_refundable: false },
  }
  if (form.genre) b.genre = form.genre
  if (form.doors_at) b.doors_at = toIso(form.doors_at)
  if (form.ends_at) b.ends_at = toIso(form.ends_at)
  if (form.poster_asset_id) b.poster_asset_id = form.poster_asset_id
  return b
}
async function save(): Promise<void> {
  const b = body()
  if (!b) return
  busy.value = true
  try {
    if (isNew.value) {
      const e = await createOrgEvent(b)
      message.success(t('org.created'))
      await router.replace({ name: 'org-event', params: { id: e.id } })
      fill(e)
    } else {
      fill(await updateOrgEvent(id.value, b))
      message.success(t('org.saved'))
    }
  } catch (e) {
    formErr.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}

async function act(a: 'submit' | 'publish' | 'withdraw'): Promise<void> {
  busy.value = true
  missing.value = []
  formErr.value = ''
  try {
    fill(await eventAction(id.value, a))
    message.success(t(`org.event.did.${a}`))
  } catch (e) {
    // 422 "belum lengkap" membawa daftar yang kurang di details.missing
    const m = toApiError(e).details.missing as string[] | undefined
    if (m?.length) missing.value = m
    formErr.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
async function addT(): Promise<void> {
  formErr.value = ''
  if (!tier.name.trim() || tier.price === '') {
    formErr.value = t('org.tier.need')
    return
  }
  busy.value = true
  try {
    await addTier(id.value, {
      name: tier.name.trim(),
      price: Number(tier.price),
      quota: tier.quota === '' ? 0 : Number(tier.quota),
    })
    Object.assign(tier, { name: '', price: '', quota: '' })
    fill(await getOrgEvent(id.value))
  } catch (e) {
    formErr.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
async function delT(tid: string): Promise<void> {
  busy.value = true
  try {
    await deleteTier(id.value, tid)
    fill(await getOrgEvent(id.value))
  } catch (e) {
    formErr.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
const missLabel = (m: string) => t(`org.missing.${m.split(':')[0]}`, m)
</script>

<template>
  <div class="org">
    <div
      v-if="state === 'loading'"
      class="a-sk"
      style="min-height: 240px; border-radius: 16px"
      role="status"
      :aria-label="t('common.loading')"
    />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <template v-else>
      <!-- Event yang sudah ada: judul + status dipegang kepala workspace (OrgEventLayout); hanya form baru butuh judul sendiri. -->
      <div v-if="isNew" class="org__bar">
        <h1 class="a-serif ac__title">{{ t('org.event.new') }}</h1>
      </div>
      <p v-if="ev && !editable" class="a-muted">{{ t('org.event.locked') }}</p>

      <form class="org__card" data-test="event-form" novalidate @submit.prevent="save">
        <h2 class="a-serif">{{ t('org.event.basic') }}</h2>
        <label class="org__f"
          ><span>{{ t('org.event.title') }}</span
          ><input v-model="form.title" data-test="e-title" maxlength="200" :disabled="!editable"
        /></label>
        <label class="org__f"
          ><span>{{ t('org.event.desc') }}</span
          ><textarea v-model="form.description" :disabled="!editable" />
        </label>
        <div class="org__grid">
          <label class="org__f"
            ><span>{{ t('org.event.genre') }}</span>
            <select v-model="form.genre" :disabled="!editable">
              <option value="">-</option>
              <option v-for="g in genres" :key="g">{{ g }}</option>
            </select>
          </label>
          <label class="org__f"
            ><span>{{ t('org.event.mode') }}</span>
            <select v-model="form.mode" :disabled="!editable || !isNew" data-test="e-mode">
              <option value="general">{{ t('org.event.modeGeneral') }}</option>
              <option value="seated">{{ t('org.event.modeSeated') }}</option>
            </select>
            <small>{{ t('org.event.modeHint') }}</small>
          </label>
          <label class="org__f"
            ><span>{{ t('org.event.venue') }}</span>
            <select v-model="form.venue_id" data-test="e-venue" :disabled="!editable">
              <option value="">{{ t('org.event.pickVenue') }}</option>
              <option v-for="v in venues" :key="v.id" :value="v.id">
                {{ v.name }} ({{ v.city }})
              </option>
            </select>
            <small
              >{{ t('org.event.noVenue') }}
              <RouterLink :to="{ name: 'org-venues' }">{{
                t('org.nav_.org-venues')
              }}</RouterLink></small
            >
          </label>
        </div>
        <div class="org__grid">
          <label class="org__f"
            ><span>{{ t('org.event.starts') }}</span
            ><input
              v-model="form.starts_at"
              type="datetime-local"
              data-test="e-starts"
              :disabled="!editable"
          /></label>
          <label class="org__f"
            ><span>{{ t('org.event.doors') }}</span
            ><input v-model="form.doors_at" type="datetime-local" :disabled="!editable"
          /></label>
          <label class="org__f"
            ><span>{{ t('org.event.ends') }}</span
            ><input v-model="form.ends_at" type="datetime-local" :disabled="!editable"
          /></label>
        </div>
        <small class="a-muted">{{ t('org.event.tzHint') }}</small>
        <div class="org__grid">
          <label class="org__f"
            ><span>{{ t('org.event.maxOrder') }}</span
            ><input
              v-model.number="form.max_per_order"
              type="number"
              min="1"
              max="10"
              :disabled="!editable"
          /></label>
          <label class="org__f"
            ><span>{{ t('org.event.maxAccount') }}</span
            ><input
              v-model.number="form.max_per_account"
              type="number"
              min="1"
              max="20"
              :disabled="!editable"
          /></label>
        </div>
        <fieldset class="org__f" :disabled="!editable">
          <span>{{ t('org.event.artists') }}</span>
          <div class="org__pick" data-test="artist-pick">
            <label v-for="a in artists" :key="a.id" class="org__chk"
              ><input v-model="form.artist_ids" type="checkbox" :value="a.id" /> {{ a.name }}</label
            >
          </div>
          <small
            >{{ t('org.event.noArtist') }}
            <RouterLink :to="{ name: 'org-artists' }">{{
              t('org.nav_.org-artists')
            }}</RouterLink></small
          >
        </fieldset>
        <fieldset class="org__f" :disabled="!editable">
          <span>{{ t('org.event.refund') }}</span>
          <label class="org__chk"
            ><input v-model="form.refundable" type="checkbox" data-test="e-refundable" />
            {{ t('org.event.refundable') }}</label
          >
          <div v-if="form.refundable" class="org__grid">
            <label class="org__f"
              ><span>{{ t('org.event.refundUntil') }}</span
              ><input v-model="form.refundable_until" type="datetime-local"
            /></label>
            <label class="org__f"
              ><span>{{ t('org.event.deduction') }}</span
              ><input v-model.number="form.deduction_pct" type="number" min="0" max="100"
            /></label>
          </div>
        </fieldset>
        <ImageUpload
          v-if="editable"
          kind="poster"
          :current="ev?.poster_url"
          :label="t('org.event.poster')"
          @uploaded="form.poster_asset_id = $event"
        />
        <p v-if="formErr" class="org__err" role="alert" data-test="form-err">{{ formErr }}</p>
        <ul v-if="missing.length" class="org__missing" data-test="missing">
          <li v-for="m in missing" :key="m">{{ missLabel(m) }}</li>
        </ul>
        <div v-if="editable" class="org__acts">
          <button type="submit" class="a-pill a-pill--solid" :disabled="busy" data-test="e-save">
            {{ isNew ? t('org.event.create') : t('org.save') }}
          </button>
        </div>
      </form>

      <section v-if="ev" class="org__card" data-test="tiers">
        <h2 class="a-serif">{{ t('org.tier.title') }}</h2>
        <p v-if="ev.mode === 'seated'" class="a-muted">{{ t('org.tier.seatedNote') }}</p>
        <ul v-if="ev.tiers.length" class="org__list">
          <li v-for="x in ev.tiers" :key="x.id" class="org__row" data-test="tier-row">
            <span
              ><strong>{{ x.name }}</strong
              ><small class="a-muted">
                {{ formatRupiah(x.price) }} ·
                {{ t('org.tier.sold', { s: x.sold, q: x.quota }) }}</small
              ></span
            >
            <button
              v-if="editable && !x.sold"
              type="button"
              class="a-pill"
              :disabled="busy"
              @click="delT(x.id)"
            >
              {{ t('org.tier.remove') }}
            </button>
          </li>
        </ul>
        <p v-else class="a-muted">{{ t('org.tier.empty') }}</p>
        <div v-if="editable" class="org__grid">
          <label class="org__f"
            ><span>{{ t('org.tier.name') }}</span
            ><input v-model="tier.name" data-test="t-name" maxlength="80"
          /></label>
          <label class="org__f"
            ><span>{{ t('org.tier.price') }}</span
            ><input
              v-model="tier.price"
              type="number"
              min="0"
              inputmode="numeric"
              data-test="t-price"
          /></label>
          <label class="org__f"
            ><span>{{ t('org.tier.quota') }}</span
            ><input
              v-model="tier.quota"
              type="number"
              min="0"
              inputmode="numeric"
              data-test="t-quota"
          /></label>
        </div>
        <div v-if="editable" class="org__acts">
          <button type="button" class="a-pill" :disabled="busy" data-test="t-add" @click="addT">
            {{ t('org.tier.add') }}
          </button>
        </div>
      </section>

      <section v-if="ev" class="org__card" data-test="lifecycle">
        <h2 class="a-serif">{{ t('org.event.publishing') }}</h2>
        <p class="a-muted">{{ t(`org.event.flow.${ev.status}`, t('org.event.flow.other')) }}</p>
        <div class="org__acts">
          <button
            v-if="ev.status === 'draft'"
            type="button"
            class="a-pill a-pill--solid"
            :disabled="busy"
            data-test="e-submit"
            @click="act('submit')"
          >
            {{ t('org.event.submit') }}
          </button>
          <button
            v-if="ev.status === 'in_review'"
            type="button"
            class="a-pill"
            :disabled="busy"
            @click="act('withdraw')"
          >
            {{ t('org.event.withdraw') }}
          </button>
          <button
            v-if="ev.status === 'approved'"
            type="button"
            class="a-pill a-pill--solid"
            :disabled="busy"
            data-test="e-publish"
            @click="act('publish')"
          >
            {{ t('org.event.publish') }}
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
