<script setup lang="ts">
import { AlertTriangle } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="a-err" role="alert" data-state="error">
    <NIcon :component="AlertTriangle" :size="36" aria-hidden="true" class="a-err__icon" />
    <h2 class="a-serif a-err__title">{{ t('errors.title') }}</h2>
    <p class="a-muted">{{ message }}</p>
    <button type="button" class="a-pill" @click="$emit('retry')">{{ t('common.retry') }}</button>
  </div>
</template>

<style scoped>
.a-err {
  display: grid;
  justify-items: center;
  gap: 10px;
  text-align: center;
  padding: 56px 16px;
  border: 1px solid var(--a-line-strong);
  border-radius: 18px;
}
.a-err__icon {
  color: var(--a-danger);
}
.a-err__title {
  font-size: 30px;
  color: var(--a-cream);
}
</style>
