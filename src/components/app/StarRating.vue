<script setup lang="ts">
import { Star } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'

// Bintang 1-5. Tanpa `modelValue` setter = tampilan saja (gambar dengan label teks untuk pembaca layar);
// dengan v-model = grup radio yang bisa dipakai papan ketik (panah kiri/kanan bawaan radio).
const props = withDefaults(
  defineProps<{ modelValue?: number; readonly?: boolean; size?: number }>(),
  {
    modelValue: 0,
    readonly: false,
    size: 20,
  },
)
const emit = defineEmits<{ 'update:modelValue': [n: number] }>()
const { t } = useI18n()
const uid = `star-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <span v-if="readonly" class="stars" role="img" :aria-label="t('rv.ratingOf', { n: modelValue })">
    <NIcon
      v-for="n in 5"
      :key="n"
      :component="Star"
      :size="size"
      class="stars__i"
      :class="{ 'stars__i--on': n <= Math.round(props.modelValue) }"
      aria-hidden="true"
    />
  </span>
  <fieldset v-else class="stars stars--input">
    <legend class="a-sr">{{ t('rv.rate') }}</legend>
    <label v-for="n in 5" :key="n" class="stars__lab">
      <input
        type="radio"
        :name="uid"
        :value="n"
        :checked="modelValue === n"
        class="stars__radio"
        :data-test="`star-${n}`"
        @change="emit('update:modelValue', n)"
      />
      <NIcon
        :component="Star"
        :size="size"
        class="stars__i"
        :class="{ 'stars__i--on': n <= modelValue }"
        aria-hidden="true"
      />
      <span class="a-sr">{{ t('rv.ratingOf', { n }) }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.stars {
  display: inline-flex;
  gap: 2px;
  border: 0;
  padding: 0;
  margin: 0;
  vertical-align: middle;
}
.stars__i {
  color: var(--a-line-strong);
  pointer-events: none; /* klik jatuh ke radio di bawahnya */
}
.stars__i--on {
  color: var(--a-gold);
}
.stars__i--on :deep(svg) {
  fill: currentColor;
}
.stars__lab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  cursor: pointer;
  scroll-margin-top: 120px; /* tidak tertutup header menempel */
}
.stars__radio {
  position: absolute;
  inset: 0;
  opacity: 0;
  margin: 0;
  cursor: pointer;
}
.stars__lab:has(.stars__radio:focus-visible) {
  outline: 2px solid var(--a-gold);
  outline-offset: 2px;
  border-radius: 10px;
}
.stars__lab:hover .stars__i {
  color: var(--a-gold);
}
</style>
