<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { toApiError } from '@/api/errors'
import { submitReview } from '@/api/reviews'
import StarRating from '@/components/app/StarRating.vue'
import { useApiMessage } from '@/composables/useApiMessage'

// Form ulasan untuk satu tiket yang sudah dipakai. Ulasan dengan kata terlarang/tautan masuk moderasi
// (BE mengembalikan status "pending"); pengguna diberi tahu terus terang, bukan dibiarkan menebak.
const props = defineProps<{ ticketId: string }>()
const { t } = useI18n()
const message = useMessage()
const apiMessage = useApiMessage()

const rating = ref(0)
const body = ref('')
const busy = ref(false)
const err = ref('')
const done = ref<'published' | 'pending' | 'already' | ''>('')
const MAX = 2000

async function send(): Promise<void> {
  err.value = ''
  if (rating.value < 1) {
    err.value = t('rv.needRating')
    return
  }
  busy.value = true
  try {
    const r = await submitReview(props.ticketId, { rating: rating.value, body: body.value.trim() })
    done.value = r.status
    message.success(t(r.status === 'pending' ? 'rv.pending' : 'rv.thanks'))
  } catch (e) {
    if (toApiError(e).status === 409) done.value = 'already'
    else err.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="ac__card rf" data-test="review-form">
    <h2 class="a-serif">{{ t('rv.formTitle') }}</h2>
    <p v-if="done" class="rf__done" role="status" data-test="review-done">
      {{ t(done === 'already' ? 'rv.already' : done === 'pending' ? 'rv.pending' : 'rv.thanks') }}
    </p>
    <form v-else class="rf__form" novalidate @submit.prevent="send">
      <p class="a-muted">{{ t('rv.formLead') }}</p>
      <StarRating v-model="rating" :size="28" />
      <label class="rf__lab" for="rv-body">{{ t('rv.bodyLabel') }}</label>
      <textarea
        id="rv-body"
        v-model="body"
        class="rf__ta"
        rows="4"
        :maxlength="MAX"
        :placeholder="t('rv.bodyPh')"
        data-test="review-body"
      />
      <small class="a-muted rf__cnt">{{ body.length }}/{{ MAX }}</small>
      <p v-if="err" class="rf__err" role="alert" data-test="review-err">{{ err }}</p>
      <button
        type="submit"
        class="a-pill a-pill--solid"
        :aria-busy="busy"
        :disabled="busy"
        data-test="review-send"
      >
        {{ t('rv.send') }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.rf__form {
  display: grid;
  gap: 10px;
  justify-items: start;
}
.rf__lab {
  font-size: 14px;
  font-weight: 600;
}
.rf__ta {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid var(--a-line-strong);
  border-radius: 14px;
  background: var(--a-panel);
  color: var(--a-ink);
  font: inherit;
  resize: vertical;
}
.rf__ta:focus-visible {
  outline: 2px solid var(--a-gold);
  outline-offset: 2px;
}
.rf__cnt {
  justify-self: end;
}
.rf__err {
  margin: 0;
  color: var(--a-danger, #b3261e);
}
.rf__done {
  margin: 0;
  font-weight: 600;
  color: var(--a-gold);
}
</style>
