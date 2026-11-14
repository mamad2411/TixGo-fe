<script setup lang="ts">
import { NButton, NCard, NInput, NProgress, NSelect, NSpace, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const options = [
  { label: 'Jakarta', value: 'jkt' },
  { label: 'Bandung', value: 'bdg' },
]
</script>

<template>
  <section>
    <h1 class="t-display" style="font-size: 56px; margin: 0 0 8px">{{ t('kit.title') }}</h1>
    <p>{{ t('kit.hint') }}</p>
    <NSpace vertical :size="16">
      <NSpace>
        <NButton type="primary">{{ t('kit.primary') }}</NButton>
        <NButton>{{ t('kit.secondary') }}</NButton>
        <NButton disabled>Disabled</NButton>
      </NSpace>
      <NSpace>
        <NTag>BARU</NTag>
        <NTag type="warning">PRESALE</NTag>
        <NTag type="info">TINGGAL 12</NTag>
      </NSpace>
      <NInput placeholder="Cari artis atau venue" />
      <NSelect :options="options" placeholder="Pilih kota" />
      <NProgress type="line" :percentage="38" aria-label="Posisi antrean 38 persen" />
      <NCard>
        <!-- Jangan pakai NCard title/header: Naive UI memberi role="heading" tanpa aria-level (axe: aria-required-attr). -->
        <h2 class="t-data" style="margin: 0 0 8px">NO. 001284</h2>
        <span class="t-data">BLOK C / BARIS 12 / KURSI 05</span>
      </NCard>
    </NSpace>
  </section>
</template>
