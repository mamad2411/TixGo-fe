<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useMessage } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { listArtists, type Artist } from '@/api/artists'
import { createArtist, updateArtist, type ArtistInput } from '@/api/organizer'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import EventThumb from '@/components/app/EventThumb.vue'
import ImageUpload from '@/components/org/ImageUpload.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import './org.css'

const { t } = useI18n()
useHead({ title: computed(() => t('org.nav_.org-artists')) })
const message = useMessage()
const apiMessage = useApiMessage()
const rows = ref<Artist[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
const editing = ref<string | null>(null)
const form = reactive({ name: '', bio: '', image_asset_id: '' })
const preview = ref('')
const formErr = ref('')
const busy = ref(false)

async function load(): Promise<void> {
  state.value = 'loading'
  try {
    rows.value = await listArtists()
    state.value = 'ok'
  } catch (e) {
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
onMounted(load)
function reset(): void {
  editing.value = null
  Object.assign(form, { name: '', bio: '', image_asset_id: '' })
  preview.value = ''
  formErr.value = ''
}
function edit(a: Artist): void {
  editing.value = a.id
  Object.assign(form, { name: a.name, bio: a.bio ?? '', image_asset_id: '' })
  preview.value = a.image_url ?? ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
async function save(): Promise<void> {
  formErr.value = ''
  if (form.name.trim().length < 2) {
    formErr.value = t('org.artist.needName')
    return
  }
  const b: ArtistInput = { name: form.name.trim(), bio: form.bio.trim() }
  if (form.image_asset_id) b.image_asset_id = form.image_asset_id
  busy.value = true
  try {
    if (editing.value) await updateArtist(editing.value, b)
    else await createArtist(b)
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
      <h1 class="a-serif ac__title">{{ t('org.nav_.org-artists') }}</h1>
    </div>
    <p class="a-muted">{{ t('org.artist.lead') }}</p>
    <form class="org__card" data-test="artist-form" novalidate @submit.prevent="save">
      <h2 class="a-serif">{{ editing ? t('org.artist.edit') : t('org.artist.new') }}</h2>
      <label class="org__f"
        ><span>{{ t('org.artist.name') }}</span
        ><input v-model="form.name" data-test="a-name" maxlength="120"
      /></label>
      <label class="org__f"
        ><span>{{ t('org.artist.bio') }}</span
        ><textarea v-model="form.bio" maxlength="5000" />
      </label>
      <ImageUpload
        :key="editing ?? 'new'"
        kind="artist"
        :current="preview"
        :label="t('org.artist.photo')"
        @uploaded="form.image_asset_id = $event"
      />
      <p v-if="formErr" class="org__err" role="alert" data-test="form-err">{{ formErr }}</p>
      <div class="org__acts">
        <button type="submit" class="a-pill a-pill--solid" :disabled="busy" data-test="a-save">
          {{ editing ? t('org.save') : t('org.artist.create') }}
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
      :title="t('org.artist.empty')"
      :body="t('org.artist.emptyBody')"
    />
    <ul v-else class="org__list" data-test="artist-list">
      <li v-for="a in rows" :key="a.id" class="org__row">
        <span class="org__main">
          <EventThumb :src="a.image_url" :title="a.name" :w="54" :h="54" />
          <span
            ><strong>{{ a.name }}</strong
            ><small class="a-muted">{{ a.bio }}</small></span
          >
        </span>
        <button type="button" class="a-pill" @click="edit(a)">{{ t('org.edit') }}</button>
      </li>
    </ul>
  </div>
</template>
