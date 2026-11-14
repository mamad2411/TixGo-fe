<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { joinSquad } from '@/api/squad'
import BackLink from '@/components/app/BackLink.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import { useApiMessage } from '@/composables/useApiMessage'

// Tujuan tautan undangan /squad/:code. Bergabung adalah aksi eksplisit (bukan efek samping membuka tautan):
// kursimu ikut ditahan dan ada tenggat bayar, jadi pengguna harus tahu dan setuju dulu.
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const apiMessage = useApiMessage()
useHead({ title: computed(() => t('sq.joinTitle')) })
const code = computed(() => String(route.params.code ?? '').toUpperCase())
const busy = ref(false)
const err = ref('')

async function join(): Promise<void> {
  busy.value = true
  err.value = ''
  try {
    const s = await joinSquad(code.value)
    await router.replace({ name: 'squad', params: { id: s.id } })
  } catch (e) {
    err.value = apiMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ToneLight class="tone-page">
    <div class="sj">
      <BackLink plain class="pg-back" />
      <p class="a-caps">{{ t('sq.kicker') }}</p>
      <h1 class="a-serif">{{ t('sq.joinTitle') }}</h1>
      <p class="a-muted">{{ t('sq.joinLead') }}</p>
      <code class="sj__code" data-test="join-code">{{ code }}</code>
      <p v-if="err" class="sj__err" role="alert" data-test="join-err">{{ err }}</p>
      <button
        type="button"
        class="a-pill a-pill--solid"
        :aria-busy="busy"
        :disabled="busy"
        data-test="join-btn"
        @click="join"
      >
        {{ t('sq.joinBtn') }}
      </button>
    </div>
  </ToneLight>
</template>

<style scoped>
.sj {
  max-width: 520px;
  margin: 0 auto;
  padding: 40px var(--a-pad) 80px;
  display: grid;
  justify-items: start;
  gap: 14px;
}
.sj h1 {
  font-size: clamp(30px, 5vw, 44px);
  color: var(--a-cream);
  margin: 0;
}
.sj__code {
  padding: 10px 18px;
  border-radius: 14px;
  background: var(--a-bg3);
  font-size: 26px;
  letter-spacing: 0.2em;
  font-weight: 700;
}
.sj__err {
  margin: 0;
  color: var(--a-danger, #b3261e);
}
</style>
