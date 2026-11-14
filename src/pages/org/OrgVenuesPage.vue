<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useMessage } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { listVenues } from '@/api/discover'
import type { VenueView } from '@/api/events'
import { createVenue, updateVenue, type VenueInput } from '@/api/organizer'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import EventThumb from '@/components/app/EventThumb.vue'
import ImageUpload from '@/components/org/ImageUpload.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import './org.css'

const { t } = useI18n()
useHead({ title: computed(() => t('org.nav_.org-venues')) })
const message = useMessage()
const apiMessage = useApiMessage()
const rows = ref<VenueView[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const editing = ref<string | null>(null)
const form = reactive({
  name: '',
  city: '',
  address: '',
  lat: '',
  lng: '',
  tz: 'Asia/Jakarta',
  capacity: '',
  image_asset_id: '',
  image_credit: '',
})
const preview = ref('')
const formErr = ref('')
const busy = ref(false)

async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = (await listVenues({ per_page: 100 })).data
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)

function reset(): void {
  editing.value = null
  Object.assign(form, {
    name: '',
    city: '',
    address: '',
    lat: '',
    lng: '',
    tz: 'Asia/Jakarta',
    capacity: '',
    image_asset_id: '',
    image_credit: '',
  })
  preview.value = ''
  formErr.value = ''
}
function edit(v: VenueView): void {
  editing.value = v.id
  Object.assign(form, {
    name: v.name,
    city: v.city,
    address: v.address ?? '',
    lat: v.lat?.toString() ?? '',
    lng: v.lng?.toString() ?? '',
    tz: v.tz,
    capacity: v.capacity?.toString() ?? '',
    image_asset_id: '',
    image_credit: v.image_credit ?? '',
  })
  preview.value = v.image_url ?? ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function body(): VenueInput | null {
  formErr.value = ''
  if (form.name.trim().length < 2 || form.city.trim().length < 2) {
    formErr.value = t('org.venue.needNameCity')
    return null
  }
  if ((form.lat === '') !== (form.lng === '')) {
    formErr.value = t('org.venue.needLatLng')
    return null
  }
  const b: VenueInput = { name: form.name.trim(), city: form.city.trim(), tz: form.tz }
  if (form.address.trim()) b.address = form.address.trim()
  if (form.lat !== '') {
    b.lat = Number(form.lat)
    b.lng = Number(form.lng)
  }
  if (form.capacity !== '') b.capacity = Number(form.capacity)
  if (form.image_asset_id) b.image_asset_id = form.image_asset_id
  if (form.image_credit.trim()) b.image_credit = form.image_credit.trim()
  return b
}
async function save(): Promise<void> {
  const b = body()
  if (!b) return
  busy.value = true
  try {
    if (editing.value) await updateVenue(editing.value, b)
    else await createVenue(b)
    message.success(t(editing.value ? 'org.saved' : 'org.created'))
    reset()
    await load()
  } catch (e) {
    formErr.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="org">
    <div class="org__bar">
      <h1 class="a-serif ac__title">{{ t('org.nav_.org-venues') }}</h1>
    </div>
    <p class="a-muted">{{ t('org.venue.lead') }}</p>

    <form class="org__card" data-test="venue-form" novalidate @submit.prevent="save">
      <h2 class="a-serif">{{ editing ? t('org.venue.edit') : t('org.venue.new') }}</h2>
      <div class="org__grid">
        <label class="org__f"
          ><span>{{ t('org.venue.name') }}</span
          ><input v-model="form.name" data-test="v-name" maxlength="150"
        /></label>
        <label class="org__f"
          ><span>{{ t('org.venue.city') }}</span
          ><input v-model="form.city" data-test="v-city" maxlength="80"
        /></label>
        <label class="org__f"
          ><span>{{ t('org.venue.capacity') }}</span
          ><input v-model="form.capacity" type="number" min="1" inputmode="numeric"
        /></label>
        <label class="org__f"
          ><span>{{ t('org.venue.tz') }}</span>
          <select v-model="form.tz">
            <option>Asia/Jakarta</option>
            <option>Asia/Makassar</option>
            <option>Asia/Jayapura</option>
          </select>
        </label>
      </div>
      <label class="org__f"
        ><span>{{ t('org.venue.address') }}</span
        ><input v-model="form.address" maxlength="300"
      /></label>
      <div class="org__grid">
        <label class="org__f"
          ><span>{{ t('org.venue.lat') }}</span
          ><input v-model="form.lat" inputmode="decimal" placeholder="-6.2255"
        /></label>
        <label class="org__f"
          ><span>{{ t('org.venue.lng') }}</span
          ><input v-model="form.lng" inputmode="decimal" placeholder="106.8017" /><small>{{
            t('org.venue.coordHint')
          }}</small></label
        >
      </div>
      <ImageUpload
        :key="editing ?? 'new'"
        kind="venue"
        :current="preview"
        :label="t('org.venue.photo')"
        @uploaded="form.image_asset_id = $event"
      />
      <small class="a-muted">{{ t('org.venue.photoHint') }}</small>
      <label class="org__f"
        ><span>{{ t('org.venue.credit') }}</span
        ><input v-model="form.image_credit" maxlength="200" :placeholder="t('org.venue.creditPh')"
      /></label>
      <p v-if="formErr" class="org__err" role="alert" data-test="form-err">{{ formErr }}</p>
      <div class="org__acts">
        <button type="submit" class="a-pill a-pill--solid" :disabled="busy" data-test="v-save">
          {{ editing ? t('org.save') : t('org.venue.create') }}
        </button>
        <button v-if="editing" type="button" class="a-pill" @click="reset">
          {{ t('org.cancel') }}
        </button>
      </div>
    </form>

    <div
      v-if="state === 'loading'"
      class="a-sk"
      style="min-height: 160px; border-radius: 16px"
      role="status"
      :aria-label="t('common.loading')"
    />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <EmptyState
      v-else-if="!rows.length"
      :title="t('org.venue.empty')"
      :body="t('org.venue.emptyBody')"
    />
    <ul v-else class="org__list" data-test="venue-list">
      <li v-for="v in rows" :key="v.id" class="org__row">
        <span class="org__main">
          <EventThumb :src="v.image_url" :title="v.name" :w="72" :h="54" />
          <span
            ><strong>{{ v.name }}</strong
            ><small class="a-muted"
              >{{ v.city
              }}<template v-if="v.capacity">
                · {{ v.capacity.toLocaleString('id-ID') }}</template
              ></small
            ></span
          >
        </span>
        <button type="button" class="a-pill" @click="edit(v)">{{ t('org.edit') }}</button>
      </li>
    </ul>
  </div>
</template>
