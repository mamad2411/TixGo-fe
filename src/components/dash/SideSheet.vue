<script setup lang="ts">
import { X } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

// Panel samping untuk detail/keputusan di dashboard. Dirender di dalam cangkang (.ds), bukan di <body>,
// supaya token tema (--a-*) dan gaya tombol (.a-pill) ikut berlaku di terang maupun gelap.
// Dialog modal: fokus masuk ke panel, Tab berputar di dalamnya, Esc/klik latar menutup, fokus kembali ke pemicu.
const props = defineProps<{ show: boolean; title: string }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()
const { t } = useI18n()

const panel = ref<HTMLElement>()
let opener: HTMLElement | null = null

function close(): void {
  emit('update:show', false)
}
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
function onKey(e: KeyboardEvent): void {
  if (!props.show) return
  if (e.key === 'Escape') {
    e.stopPropagation()
    close()
    return
  }
  if (e.key !== 'Tab' || !panel.value) return
  const els = Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null,
  )
  if (!els.length) return
  const first = els[0]!
  const last = els[els.length - 1]!
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === panel.value)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(
  () => props.show,
  async (v) => {
    if (v) {
      opener = document.activeElement as HTMLElement | null
      document.documentElement.style.overflow = 'hidden'
      window.addEventListener('keydown', onKey, true)
      await nextTick()
      panel.value?.focus()
    } else {
      document.documentElement.style.overflow = ''
      window.removeEventListener('keydown', onKey, true)
      opener?.focus?.()
    }
  },
)
onBeforeUnmount(() => {
  document.documentElement.style.overflow = ''
  window.removeEventListener('keydown', onKey, true)
})
</script>

<template>
  <Teleport to=".ds" defer>
    <Transition name="ss">
      <div v-if="show" class="ss" data-test="sidesheet">
        <div class="ss__scrim" aria-hidden="true" @click="close" />
        <section
          ref="panel"
          class="ss__panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
        >
          <header class="ss__head">
            <h2 class="ss__t">{{ title }}</h2>
            <button type="button" class="ss__x" :aria-label="t('common.close')" @click="close">
              <NIcon :component="X" :size="20" />
            </button>
          </header>
          <div class="ss__body"><slot /></div>
          <footer v-if="$slots.footer" class="ss__foot"><slot name="footer" /></footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ss {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  justify-content: flex-end;
}
.ss__scrim {
  position: absolute;
  inset: 0;
  background: rgb(10 8 6 / 0.55);
}
.ss__panel {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(520px, 100vw);
  height: 100%;
  background: var(--a-bg2);
  color: var(--a-ink);
  box-shadow: var(--a-shadow);
}
.ss__panel:focus {
  outline: none;
}
.ss__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px 14px 20px;
  border-bottom: 1px solid var(--a-line);
}
.ss__t {
  flex: 1;
  margin: 0;
  font-size: 18px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.ss__x {
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--a-muted);
  cursor: pointer;
}
.ss__x:hover,
.ss__x:focus-visible {
  background: var(--a-bg3);
  color: var(--a-ink);
}
.ss__body {
  padding: 18px 20px;
  overflow-y: auto;
}
.ss__foot {
  padding: 14px 20px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--a-line);
  background: var(--a-bg2);
}
.ss-enter-active,
.ss-leave-active {
  transition: opacity 0.2s ease;
}
.ss-enter-active .ss__panel,
.ss-leave-active .ss__panel {
  transition: transform 0.24s ease;
}
.ss-enter-from,
.ss-leave-to {
  opacity: 0;
}
.ss-enter-from .ss__panel,
.ss-leave-to .ss__panel {
  transform: translateX(32px);
}
@media (prefers-reduced-motion: reduce) {
  .ss-enter-active,
  .ss-leave-active,
  .ss-enter-active .ss__panel,
  .ss-leave-active .ss__panel {
    transition: none;
  }
}
</style>
