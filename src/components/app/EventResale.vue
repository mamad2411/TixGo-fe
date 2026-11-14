<script setup lang="ts">
import { NIcon, useMessage } from 'naive-ui'
import { ShieldCheck } from '@vicons/tabler'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { toApiError } from '@/api/errors'
import { buyListing, getEventResale, type EventResale } from '@/api/resale'
import { useApiMessage } from '@/composables/useApiMessage'
import { useRequireLogin } from '@/composables/useRequireLogin'
import { formatRupiah } from '@/utils/format'

// Tiket resmi dari penonton lain. Bagian ini tidak muncul sama sekali bila acara tidak membuka resale
// (BE 404) atau belum ada listing: tidak ada kotak kosong yang membingungkan.
const props = defineProps<{ slug: string }>()
const { t, locale } = useI18n()
const message = useMessage()
const apiMessage = useApiMessage()
const requireLogin = useRequireLogin()
const router = useRouter()

const data = ref<EventResale | null>(null)
const busy = ref('')
const rp = (n: number) => formatRupiah(n, locale.value === 'en' ? 'en-GB' : 'id-ID')

async function load(): Promise<void> {
  try {
    const r = await getEventResale(props.slug)
    data.value = r.listings.length ? r : null
  } catch {
    data.value = null
  }
}
onMounted(load)

async function buy(id: string): Promise<void> {
  if (!(await requireLogin('rs.needLogin'))) return
  busy.value = id
  try {
    const o = await buyListing(id)
    await router.push({ name: 'order-pay', params: { id: o.id } })
  } catch (e) {
    const code = toApiError(e).code
    message.error(apiMessage(e))
    // Sudah dipesan orang lain / tidak tersedia: segarkan daftar agar tidak menggoda lagi.
    if (code === 'SEAT_TAKEN' || code === 'TICKET_INVALID') await load()
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <section v-if="data" id="resale" class="blk" data-test="resale">
    <h2 class="a-serif blk__h">{{ t('rs.title') }}</h2>
    <p class="a-muted rs__lead">
      <NIcon :component="ShieldCheck" :size="16" aria-hidden="true" />
      {{ t('rs.lead', { pct: data.cap_pct }) }}
    </p>
    <ul class="rs__list">
      <li v-for="l in data.listings" :key="l.id" class="rs__item" data-test="resale-item">
        <div class="rs__what">
          <strong>{{ l.tier_name || t('rs.ticket') }}</strong>
          <span v-if="l.seat_label" class="a-muted">{{ l.seat_label }}</span>
        </div>
        <div class="rs__price">
          <strong>{{ rp(l.buyer_pays) }}</strong>
          <small class="a-muted"
            >{{ t('rs.breakdown', { price: rp(l.price), fee: rp(l.buyer_fee) }) }}
            <template v-if="l.face_price"> · {{ t('rs.face', { n: rp(l.face_price) }) }}</template>
          </small>
        </div>
        <button
          type="button"
          class="a-pill a-pill--solid"
          :aria-busy="busy === l.id"
          :disabled="!!busy"
          data-test="resale-buy"
          @click="buy(l.id)"
        >
          {{ t('rs.buy') }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.rs__lead {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 14px;
}
.rs__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.rs__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
}
.rs__what,
.rs__price {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.rs__price {
  text-align: right;
}
@media (max-width: 560px) {
  .rs__item {
    grid-template-columns: 1fr;
    justify-items: start;
  }
  .rs__price {
    text-align: left;
  }
}
</style>
