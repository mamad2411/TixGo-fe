<script setup lang="ts">
import { Camera, Trash } from '@vicons/tabler'
import { NIcon, NModal, useMessage } from 'naive-ui'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cropper, CircleStencil } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

import { removeAvatar, setAvatar } from '@/api/account'
import UserAvatar from '@/components/app/UserAvatar.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const message = useMessage()
const apiMessage = useApiMessage()

const MAX = 8 * 1024 * 1024
const input = ref<HTMLInputElement>()
const cropper = ref<InstanceType<typeof Cropper>>()
const src = ref<string | null>(null)
const open = computed({ get: () => !!src.value, set: (v) => !v && close() })
const busy = ref(false)
const ready = ref(false)
const err = ref('')

function close(): void {
  if (src.value) URL.revokeObjectURL(src.value)
  src.value = null
  ready.value = false
  err.value = ''
  if (input.value) input.value.value = ''
}
onBeforeUnmount(close)

function pick(f?: File | null): void {
  err.value = ''
  if (!f) return
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return void message.error(t('acct.avatar.errType'))
  if (f.size > MAX) return void message.error(t('acct.avatar.errSize'))
  src.value = URL.createObjectURL(f)
}
function onDrop(e: DragEvent): void {
  pick(e.dataTransfer?.files?.[0])
}

async function save(): Promise<void> {
  const canvas = cropper.value?.getResult().canvas
  if (!canvas) {
    err.value = t('acct.avatar.errNotReady')
    return
  }
  busy.value = true
  try {
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.9))
    if (!blob) throw new Error('canvas')
    auth.user = await setAvatar(blob)
    message.success(t('acct.avatar.saved'))
    close()
  } catch (e) {
    err.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
async function remove(): Promise<void> {
  busy.value = true
  try {
    auth.user = await removeAvatar()
    message.success(t('acct.avatar.removed'))
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="au" @dragover.prevent @drop.prevent="onDrop">
    <button
      type="button"
      class="au__pick"
      data-test="avatar-pick"
      :aria-label="t('acct.avatar.change')"
      @click="input?.click()"
    >
      <UserAvatar :name="auth.user?.name ?? ''" :avatar-key="auth.user?.avatar_key" :size="96" />
      <span class="au__cam" aria-hidden="true"><NIcon :component="Camera" :size="16" /></span>
    </button>
    <div class="au__txt">
      <strong>{{ t('acct.avatar.title') }}</strong>
      <small class="a-muted">{{ t('acct.avatar.hint') }}</small>
      <div class="ac__act">
        <button type="button" class="a-pill" @click="input?.click()">
          {{ t('acct.avatar.upload') }}
        </button>
        <button
          v-if="auth.user?.avatar_key"
          type="button"
          class="a-pill"
          :disabled="busy"
          data-test="avatar-remove"
          @click="remove"
        >
          <NIcon :component="Trash" :size="16" aria-hidden="true" /> {{ t('acct.avatar.remove') }}
        </button>
      </div>
    </div>
    <input
      ref="input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      data-test="avatar-file"
      @change="pick(($event.target as HTMLInputElement).files?.[0])"
    />
    <NModal
      v-model:show="open"
      preset="card"
      :title="t('acct.avatar.cropTitle')"
      style="max-width: 440px"
      :mask-closable="!busy"
    >
      <Cropper
        v-if="src"
        ref="cropper"
        class="au__crop"
        :src="src"
        :stencil-component="CircleStencil"
        :stencil-props="{ aspectRatio: 1 }"
        :canvas="{ width: 512, height: 512 }"
        image-restriction="stencil"
        @ready="ready = true"
      />
      <p v-if="err" class="au__err" role="alert">{{ err }}</p>
      <template #footer>
        <div class="ac__act">
          <button
            type="button"
            class="a-pill a-pill--solid"
            :disabled="busy || !ready"
            data-test="avatar-save"
            @click="save"
          >
            {{ busy ? t('common.loading') : t('acct.avatar.save') }}
          </button>
          <button type="button" class="a-pill" :disabled="busy" @click="close">
            {{ t('acct.cancel') }}
          </button>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.au {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 20px;
}
.au__pick {
  position: relative;
  border: 0;
  padding: 0;
  background: none;
  border-radius: 50%;
  cursor: pointer;
}
.au__cam {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--a-bg3);
  color: var(--a-ink);
  border: 2px solid var(--a-bg);
}
.au__txt {
  display: grid;
  gap: 6px;
  flex: 1 1 220px;
}
.au__crop {
  height: 320px;
  background: #111;
}
.au__err {
  margin: 10px 0 0;
  color: var(--a-danger);
  font-size: 13px;
}
</style>
