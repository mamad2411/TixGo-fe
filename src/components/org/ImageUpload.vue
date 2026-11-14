<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { uploadMedia } from '@/api/organizer'
import { useApiMessage } from '@/composables/useApiMessage'

// Pilih gambar -> unggah langsung -> kirim id aset ke induk. Pratinjau memakai blob lokal.
const props = defineProps<{
  kind: 'poster' | 'artist' | 'venue'
  current?: string
  label: string
}>()
const emit = defineEmits<{ uploaded: [id: string] }>()
const { t } = useI18n()
const apiMessage = useApiMessage()
const preview = ref(props.current ?? '')
const busy = ref(false)
const err = ref('')
const MAX = 8 * 1024 * 1024

async function pick(e: Event): Promise<void> {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  err.value = ''
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
    err.value = t('org.img.type')
    return
  }
  if (f.size > MAX) {
    err.value = t('org.img.size')
    return
  }
  busy.value = true
  try {
    const id = await uploadMedia(props.kind, f, f.name)
    preview.value = URL.createObjectURL(f)
    emit('uploaded', id)
  } catch (ex) {
    err.value = apiMessage(ex)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="iu">
    <span class="iu__label">{{ label }}</span>
    <div class="iu__box">
      <img v-if="preview" :src="preview" alt="" class="iu__img" />
      <span v-else class="iu__ph" aria-hidden="true">{{ t('org.img.none') }}</span>
    </div>
    <label class="a-pill iu__btn" :aria-busy="busy">
      {{ busy ? t('org.img.uploading') : preview ? t('org.img.change') : t('org.img.choose') }}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="iu__in"
        :disabled="busy"
        data-test="img-input"
        @change="pick"
      />
    </label>
    <small v-if="err" class="iu__err" role="alert">{{ err }}</small>
  </div>
</template>

<style scoped>
.iu {
  display: grid;
  gap: 8px;
  justify-items: start;
}
.iu__label {
  font-weight: 600;
}
.iu__box {
  width: 240px;
  aspect-ratio: 16 / 10;
  border-radius: 14px;
  overflow: hidden;
  border: 1px dashed var(--a-line-strong);
  background: var(--a-panel);
  display: grid;
  place-items: center;
}
.iu__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.iu__ph {
  color: var(--a-muted);
  font-size: 13px;
}
.iu__btn {
  position: relative;
  cursor: pointer;
}
.iu__in {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.iu__err {
  color: var(--a-danger, #d33);
}
</style>
