<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { usePendingStore } from '@/stores/pending'

// Sesi bisa habis di tengah kunjungan: token dicabut, refresh ditolak, atau cookie kedaluwarsa.
// Halaman yang sedang terbuka tidak boleh menampilkan galat "Unauthorized" mentah — bersihkan
// penanda, beri tahu sekali, lalu alihkan ke halaman masuk dengan tujuan semula.
const { t } = useI18n()
const auth = useAuthStore()
const pending = usePendingStore()
const route = useRoute()
const router = useRouter()
const message = useMessage()

watch(
  () => auth.sessionLost,
  (lost) => {
    if (!lost) return
    pending.clear()
    if (route.meta.requiresAuth || route.meta.requiresVerified) {
      // Toast tidak ditampilkan di sini: layout ini dilepas saat pindah ke halaman masuk, jadi
      // pesannya akan ikut hilang. Halaman masuk yang membacanya (flag dibiarkan menyala).
      void router.replace({ name: 'login', query: { next: route.fullPath } })
      return
    }
    auth.ackSessionLost()
    message.warning(t('auth.sessionExpired'))
  },
)
</script>

<template>
  <span hidden />
</template>
