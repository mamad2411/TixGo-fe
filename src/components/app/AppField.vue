<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
}>()

const describedBy = computed(
  () =>
    [props.hint ? `${props.id}-hint` : null, props.error ? `${props.id}-err` : null]
      .filter(Boolean)
      .join(' ') || undefined,
)
</script>

<template>
  <div class="a-field">
    <label :for="id" class="a-field__label">
      {{ label }}<span v-if="required" class="a-field__req" aria-hidden="true"> *</span>
    </label>
    <!-- Anak memasang `inputProps` ke elemen <input>: id, aria-describedby, aria-invalid. -->
    <slot
      :input-props="{
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      }"
      :invalid="!!error"
    />
    <p v-if="hint" :id="`${id}-hint`" class="a-field__hint">{{ hint }}</p>
    <p v-if="error" :id="`${id}-err`" class="a-field__err" aria-live="polite">{{ error }}</p>
  </div>
</template>

<style scoped>
.a-field {
  display: grid;
  gap: 6px;
}
.a-field__label {
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--a-ink);
  font-weight: 600;
}
.a-field__req {
  color: var(--a-gold);
}
.a-field__hint {
  font-size: 13px;
  color: var(--a-muted);
}
.a-field__err {
  font-size: 13px;
  color: var(--a-danger);
}
</style>
