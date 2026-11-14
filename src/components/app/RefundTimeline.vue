<script setup lang="ts">
import { Check, X } from '@vicons/tabler'
import { NIcon, useMessage } from 'naive-ui'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { setRefundAccount, type Refund } from '@/api/orders'
import { useApiMessage } from '@/composables/useApiMessage'
import { BANKS } from '@/utils/banks'
import { formatRupiah } from '@/utils/format'

// Status refund yang jujur: tahap, perkiraan selesai, dan tindakan yang diminta dari pembeli
// (isi rekening bila refund manual). Baymard: status "diminta" harus kelihatan di halaman pesanan.
const props = defineProps<{ refund: Refund }>()
const emit = defineEmits<{ changed: [] }>()
const { t, locale } = useI18n()
const message = useMessage()
const apiMessage = useApiMessage()
const lc = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const rp = (n: number) => formatRupiah(n, lc.value)
const day = (iso: string) =>
  new Intl.DateTimeFormat(lc.value, { dateStyle: 'medium' }).format(new Date(iso))

const STEPS = ['requested', 'approved', 'refunding', 'refunded'] as const
const failed = computed(
  () => props.refund.status === 'rejected' || props.refund.status === 'refund_failed',
)
const idx = computed(() => {
  const s = props.refund.status
  if (s === 'awaiting_account') return 1
  const i = STEPS.indexOf(s as (typeof STEPS)[number])
  return i < 0 ? 0 : i
})

const form = reactive({ bank: 'BCA', name: '', no: '' })
const tried = ref(false)
const busy = ref(false)
const err = computed(() => {
  if (form.name.trim().length < 2) return t('refund.errName')
  if (!/^[0-9]{6,20}$/.test(form.no.replace(/[\s-]/g, ''))) return t('refund.errNo')
  return ''
})
async function save(): Promise<void> {
  tried.value = true
  if (err.value) return
  busy.value = true
  try {
    await setRefundAccount(props.refund.id, {
      bank_code: form.bank,
      account_name: form.name.trim(),
      account_no: form.no,
    })
    message.success(t('refund.accountSaved'))
    emit('changed')
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <article class="rt" :data-status="refund.status" data-test="refund-card">
    <header class="rt__head">
      <strong>{{ rp(refund.amount) }}</strong>
      <span
        class="ac__badge"
        :class="failed ? 'is-bad' : refund.status === 'refunded' ? 'is-paid' : 'is-pending'"
      >
        {{ t(`refund.s.${refund.status}`) }}
      </span>
    </header>
    <small class="a-muted">
      {{ t('refund.sent', { d: day(refund.created_at) }) }}
      <template v-if="refund.due_at && !failed && refund.status !== 'refunded'">
        · {{ t('refund.due', { d: day(refund.due_at) }) }}
      </template>
    </small>

    <ol v-if="!failed" class="rt__steps" :aria-label="t('refund.progress')">
      <li
        v-for="(s, i) in STEPS"
        :key="s"
        :class="{
          done: i < idx || refund.status === 'refunded',
          now: i === idx && refund.status !== 'refunded',
        }"
      >
        <span class="rt__dot" aria-hidden="true"
          ><NIcon v-if="i < idx || refund.status === 'refunded'" :component="Check" :size="12"
        /></span>
        <span>{{ t(`refund.step.${s}`) }}</span>
      </li>
    </ol>
    <p v-else class="rt__fail">
      <NIcon :component="X" :size="16" aria-hidden="true" />
      {{ refund.note || t(`refund.failedBody.${refund.status}`) }}
    </p>

    <p v-if="refund.status === 'refunded'" class="a-muted">{{ t('refund.doneBody') }}</p>

    <form v-if="refund.needs_account" class="rt__form" novalidate @submit.prevent="save">
      <h3 class="a-serif">{{ t('refund.accountTitle') }}</h3>
      <p class="a-muted">{{ t('refund.accountBody') }}</p>
      <div class="ac__f">
        <label :for="`rb-${refund.id}`">{{ t('refund.bank') }}</label>
        <select :id="`rb-${refund.id}`" v-model="form.bank" data-test="refund-bank">
          <option v-for="b in BANKS" :key="b.code" :value="b.code">{{ b.name }}</option>
        </select>
      </div>
      <div class="ac__f">
        <label :for="`rn-${refund.id}`">{{ t('refund.holder') }}</label>
        <input
          :id="`rn-${refund.id}`"
          v-model="form.name"
          maxlength="100"
          autocomplete="off"
          data-test="refund-holder"
        />
      </div>
      <div class="ac__f">
        <label :for="`ra-${refund.id}`">{{ t('refund.number') }}</label>
        <input
          :id="`ra-${refund.id}`"
          v-model="form.no"
          inputmode="numeric"
          maxlength="24"
          autocomplete="off"
          data-test="refund-number"
        />
        <small role="alert">{{ tried ? err : '' }}</small>
      </div>
      <button
        type="submit"
        class="a-pill a-pill--solid"
        :disabled="busy"
        data-test="refund-account-save"
      >
        {{ busy ? t('common.loading') : t('refund.accountSave') }}
      </button>
    </form>
  </article>
</template>

<style scoped>
.rt {
  display: grid;
  gap: 10px;
  padding: 16px 18px;
  border: 1px solid var(--a-line);
  border-radius: 14px;
  background: var(--a-panel);
}
.rt__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rt__head strong {
  font-size: 20px;
}
.rt__steps {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.rt__steps li {
  display: grid;
  justify-items: center;
  gap: 6px;
  text-align: center;
  font-size: 12px;
  color: var(--a-muted);
  position: relative;
}
.rt__steps li::before {
  content: '';
  position: absolute;
  top: 9px;
  left: -50%;
  width: 100%;
  height: 2px;
  background: var(--a-line);
}
.rt__steps li:first-child::before {
  display: none;
}
.rt__steps li.done::before,
.rt__steps li.now::before {
  background: var(--a-gold);
}
.rt__steps li.now,
.rt__steps li.done {
  color: var(--a-ink);
}
.rt__dot {
  position: relative;
  z-index: 1;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid var(--a-line-strong, var(--a-line));
  background: var(--a-panel);
}
.done .rt__dot {
  background: var(--a-gold);
  border-color: var(--a-gold);
  color: var(--a-on-gold, var(--a-bg));
}
.now .rt__dot {
  border-color: var(--a-gold);
}
.rt__fail {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: var(--a-danger);
}
.rt__form {
  display: grid;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px dashed var(--a-line);
}
.rt__form h3 {
  margin: 0;
  font-size: 20px;
}
.rt__form p {
  margin: 0;
}
</style>
