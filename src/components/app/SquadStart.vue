<script setup lang="ts">
import { NModal, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { toApiError } from '@/api/errors'
import type { PublicEvent } from '@/api/events'
import { createSquad, type Squad } from '@/api/squad'
import { useApiMessage } from '@/composables/useApiMessage'
import { useAdmissionStore } from '@/stores/admission'

// Mulai squad dari halaman event: ketua menahan N kursi sekaligus, teman bergabung lewat kode dan bayar sendiri.
// Acara bernomor memakai kursi yang sedang dipilih (ukuran = jumlah kursi); acara umum memakai kategori terpilih.
const props = defineProps<{
  event: PublicEvent
  tierId: string
  seatIds: string[]
  /** Syarat bersama dengan beli biasa (login, verifikasi, antre); null = pengguna sudah dialihkan. */
  prepare: () => Promise<string | undefined | null>
  disabled?: boolean
}>()
const { t } = useI18n()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const admission = useAdmissionStore()

const seated = computed(() => props.event.has_seatmap)
const open = ref(false)
const size = ref(2)
const policy = ref<Squad['policy']>('release_unpaid')
const busy = ref(false)
const maxSize = computed(() => Math.min(10, props.event.max_per_order))
const fixed = computed(() => (seated.value ? props.seatIds.length : 0))
const canStart = computed(() =>
  seated.value
    ? props.seatIds.length >= 2 && props.seatIds.length <= maxSize.value
    : !!props.tierId,
)

async function show(): Promise<void> {
  busy.value = true
  try {
    if ((await props.prepare()) === null) return
    size.value = seated.value
      ? props.seatIds.length
      : Math.min(Math.max(size.value, 2), maxSize.value)
    open.value = true
  } finally {
    busy.value = false
  }
}

async function start(): Promise<void> {
  busy.value = true
  try {
    const token = await props.prepare()
    if (token === null) return
    const s = await createSquad(
      props.event.slug,
      seated.value
        ? { size: props.seatIds.length, policy: policy.value, seat_ids: props.seatIds }
        : { size: size.value, policy: policy.value, tier_id: props.tierId },
      token,
    )
    open.value = false
    await router.push({ name: 'squad', params: { id: s.id } })
  } catch (e) {
    const err = toApiError(e)
    if (props.event.queue_required && /ADMISSION|QUEUE/.test(err.code)) {
      admission.clear(props.event.slug)
      await router.push({ name: 'queue', params: { slug: props.event.slug } })
      return
    }
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="ss">
    <button
      type="button"
      class="a-pill ss__btn"
      :disabled="disabled || busy || !canStart"
      data-test="squad-start"
      @click="show"
    >
      {{ t('sq.start') }}
    </button>
    <small v-if="seated && !canStart" class="a-muted">{{ t('sq.pickSeats') }}</small>
    <NModal v-model:show="open" preset="card" :title="t('sq.startTitle')" style="max-width: 460px">
      <p class="a-muted">{{ t('sq.startLead') }}</p>
      <div class="ss__row">
        <label for="sq-size">{{ t('sq.size') }}</label>
        <strong v-if="seated" data-test="squad-size-fixed">{{ fixed }}</strong>
        <input
          v-else
          id="sq-size"
          v-model.number="size"
          type="number"
          :min="2"
          :max="maxSize"
          data-test="squad-size"
        />
      </div>
      <fieldset class="ss__pol">
        <legend>{{ t('sq.policy') }}</legend>
        <label>
          <input v-model="policy" type="radio" value="release_unpaid" />
          <span>
            <strong>{{ t('sq.polFree') }}</strong>
            <small class="a-muted">{{ t('sq.polFreeBody') }}</small>
          </span>
        </label>
        <label>
          <input v-model="policy" type="radio" value="cancel_all" />
          <span>
            <strong>{{ t('sq.polAll') }}</strong>
            <small class="a-muted">{{ t('sq.polAllBody') }}</small>
          </span>
        </label>
      </fieldset>
      <div class="ss__act">
        <button type="button" class="a-pill a-pill--ghost" @click="open = false">
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="a-pill a-pill--solid"
          :aria-busy="busy"
          :disabled="busy || size < 2 || size > maxSize"
          data-test="squad-create"
          @click="start"
        >
          {{ t('sq.create') }}
        </button>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.ss {
  display: grid;
  gap: 6px;
  justify-items: stretch;
}
/* Aksi sekunder: bergaris, penuh lebar, kalah menonjol dari tombol Beli tiket. */
.ss .a-pill.ss__btn {
  width: 100%;
  min-height: 48px;
  background: transparent;
  border-color: var(--a-line-strong);
  color: var(--a-ink);
}
.ss .a-pill.ss__btn:hover:not(:disabled) {
  background: var(--a-bg3);
  border-color: var(--a-gold);
  color: var(--a-gold);
}
.ss__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 14px 0;
}
.ss__row input {
  width: 90px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--a-line-strong);
  border-radius: 12px;
  font: inherit;
}
.ss__pol {
  border: 0;
  padding: 0;
  margin: 0 0 16px;
  display: grid;
  gap: 10px;
}
.ss__pol legend {
  font-weight: 600;
  margin-bottom: 8px;
}
.ss__pol label {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border: 1px solid var(--a-line);
  border-radius: 14px;
  cursor: pointer;
}
.ss__pol label span {
  display: grid;
  gap: 2px;
}
.ss__pol input {
  margin-top: 4px;
}
.ss__act {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
