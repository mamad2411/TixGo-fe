<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { nextTick, ref } from 'vue'

import UserAvatar from '@/components/app/UserAvatar.vue'

// Menu disclosure aksesibel (WAI-ARIA menu button): role=menu/menuitem, panah/Home/End/Esc, fokus kembali ke pemicu.
defineProps<{
  label: string
  avatarKey?: string | null
  items: { key: string; label: string }[]
}>()
const emit = defineEmits<{ select: [key: string] }>()

const open = ref(false)
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const list = ref<HTMLElement>()

onClickOutside(root, () => (open.value = false))

function entries(): HTMLButtonElement[] {
  return Array.from(list.value?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? [])
}
async function show(focus: 'first' | 'last' = 'first'): Promise<void> {
  open.value = true
  await nextTick()
  const els = entries()
  ;(focus === 'first' ? els[0] : els[els.length - 1])?.focus()
}
function close(refocus: boolean): void {
  open.value = false
  if (refocus) trigger.value?.focus()
}
function onTriggerClick(): void {
  if (open.value) close(false)
  else void show('first')
}
function onKey(e: KeyboardEvent): void {
  const els = entries()
  const i = els.indexOf(document.activeElement as HTMLButtonElement)
  if (e.key === 'ArrowDown') els[(i + 1) % els.length]?.focus()
  else if (e.key === 'ArrowUp') els[(i - 1 + els.length) % els.length]?.focus()
  else if (e.key === 'Home') els[0]?.focus()
  else if (e.key === 'End') els[els.length - 1]?.focus()
  else if (e.key === 'Escape') close(true)
  else if (e.key === 'Tab') close(false)
  else return
  if (e.key !== 'Tab') e.preventDefault()
}
function pick(key: string): void {
  close(false)
  emit('select', key)
}
</script>

<template>
  <div ref="root" class="am">
    <button
      ref="trigger"
      type="button"
      class="a-pill"
      data-test="acct"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-controls="acct-menu"
      @click="onTriggerClick"
      @keydown.down.prevent="show('first')"
      @keydown.up.prevent="show('last')"
    >
      <UserAvatar :name="label" :avatar-key="avatarKey" :size="28" data-test="head-avatar" />
      <span class="am__name">{{ label }}</span>
    </button>
    <ul v-if="open" id="acct-menu" ref="list" class="am__list" role="menu" @keydown="onKey">
      <li v-for="it in items" :key="it.key" role="none">
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          class="am__item"
          :data-key="it.key"
          @click="pick(it.key)"
        >
          {{ it.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.am {
  position: relative;
}
.am__name {
  max-width: 14ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: none;
  letter-spacing: 0.02em;
}
.am__list {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 30;
  min-width: 220px;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: var(--a-bg2);
  border: 1px solid var(--a-line-strong);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgb(0 0 0 / 0.5);
}
.am__item {
  display: flex;
  width: 100%;
  align-items: center;
  min-height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--a-ink);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.am__item:hover,
.am__item:focus-visible {
  background: var(--a-bg3);
  color: var(--a-gold);
}
</style>
