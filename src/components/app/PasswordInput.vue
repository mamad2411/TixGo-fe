<script setup lang="ts">
import { Eye, EyeOff, Lock } from '@vicons/tabler'
import { NIcon, NInput } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const model = defineModel<string>({ required: true })
defineProps<{
  inputProps?: Record<string, unknown>
  autocomplete: 'current-password' | 'new-password'
  invalid?: boolean
}>()
defineEmits<{ blur: [] }>()

const { t } = useI18n()
const shown = ref(false)
</script>

<template>
  <NInput
    v-model:value="model"
    placeholder=""
    :type="shown ? 'text' : 'password'"
    size="large"
    :status="invalid ? 'error' : undefined"
    :input-props="{ ...inputProps, autocomplete }"
    @blur="$emit('blur')"
  >
    <template #prefix
      ><NIcon :component="Lock" :size="18" class="pw-lock" aria-hidden="true"
    /></template>
    <template #suffix>
      <!-- Tombol sungguhan (bisa difokus dan dibacakan), bukan ikon dekoratif. -->
      <button
        type="button"
        class="pw-toggle"
        :aria-label="shown ? t('common.hidePassword') : t('common.showPassword')"
        :aria-pressed="shown"
        @click="shown = !shown"
      >
        <NIcon :component="shown ? EyeOff : Eye" :size="20" aria-hidden="true" />
      </button>
    </template>
  </NInput>
</template>

<style scoped>
.pw-lock {
  color: var(--a-gold);
  margin-right: 4px;
}
.pw-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 44x44 target sentuh; margin negatif menjaga tinggi input tetap */
  width: 44px;
  height: 44px;
  margin: -4px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--a-muted);
  cursor: pointer;
}
.pw-toggle:hover {
  color: var(--a-gold);
}
</style>
