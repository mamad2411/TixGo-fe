<script setup lang="ts">
import '@fontsource/cormorant-garamond/300.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource-variable/manrope'
import '@/components/landing/landing.css'

import { useHead } from '@unhead/vue'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import LandingCities from '@/components/landing/LandingCities.vue'
import LandingCta from '@/components/landing/LandingCta.vue'
import LandingDetails from '@/components/landing/LandingDetails.vue'
import LandingFlagship from '@/components/landing/LandingFlagship.vue'
import LandingFooter from '@/components/landing/LandingFooter.vue'
import LandingHero from '@/components/landing/LandingHero.vue'
import LandingNav from '@/components/landing/LandingNav.vue'
import LandingSpecs from '@/components/landing/LandingSpecs.vue'
import { useSurface } from '@/composables/useSurface'
import {
  buildCinematic,
  buildLight,
  hasMatchMedia,
  isCinematic,
  Q_CINEMATIC,
  type MotionHandle,
} from '@/composables/useLandingMotion'

const { t } = useI18n()
useSurface('dark')
useHead({
  title: 'Tiket Konser',
  meta: [
    {
      name: 'description',
      content: 'Beli tiket konser dengan antrean adil, harga jujur, dan e-ticket yang aman.',
    },
  ],
})

const root = ref<HTMLElement | null>(null)
// Dihitung SEBELUM render pertama agar kelas sinematik langsung terpasang (tanpa kilatan konten).
const cinematic = ref(isCinematic())
let handle: MotionHandle | null = null
let mq: MediaQueryList | null = null

async function setup() {
  handle?.destroy()
  handle = null
  if (!root.value) return
  try {
    handle = cinematic.value ? await buildCinematic(root.value) : await buildLight(root.value)
  } catch (err) {
    // Gagal keras terlihat di konsol; halaman tetap utuh dalam tata letak statis.
    console.error('[landing] gerak gagal dimuat, memakai tata letak statis', err)
    cinematic.value = false
  }
}

async function onModeChange() {
  cinematic.value = isCinematic()
  await nextTick()
  await setup()
}

function go(hash: string) {
  const el = hash === '#top' ? root.value : root.value?.querySelector<HTMLElement>(hash)
  if (!el) return
  if (handle) handle.scrollTo(hash === '#top' ? 0 : el)
  else el.scrollIntoView({ behavior: 'auto' })
}

function onClick(ev: MouseEvent) {
  const a = (ev.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
  if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return
  const hash = a.getAttribute('href') ?? ''
  if (hash === '#konten') return // lompat-ke-konten: biarkan perilaku asli (fokus ke <main>)
  ev.preventDefault()
  go(hash)
}

onMounted(() => {
  if (hasMatchMedia()) {
    mq = window.matchMedia(Q_CINEMATIC)
    mq.addEventListener('change', onModeChange)
  }
  void setup()
})
onBeforeUnmount(() => {
  mq?.removeEventListener('change', onModeChange)
  handle?.destroy()
})
</script>

<template>
  <div id="top" ref="root" class="landing" :class="{ 'is-cinematic': cinematic }" @click="onClick">
    <div class="l-progress" data-m="progress" aria-hidden="true" />
    <a class="l-skip" href="#konten">{{ t('landing.skip') }}</a>
    <LandingNav />
    <main id="konten" tabindex="-1">
      <LandingHero />
      <div data-m="creamwrap">
        <LandingFlagship />
        <LandingSpecs />
        <LandingDetails />
      </div>
      <LandingCities />
      <LandingCta />
    </main>
    <LandingFooter @top="go('#top')" />
  </div>
</template>
