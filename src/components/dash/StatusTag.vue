<script setup lang="ts">
import {
  Speakerphone,
  CircleCheck,
  CircleX,
  Flag,
  Hourglass,
  PlayerPause,
  Pencil,
} from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// Status event = kata + ikon + warna (bukan warna saja; WCAG 1.4.1). Kata dari i18n org.status.*.
const props = defineProps<{ status: string }>()
const { t } = useI18n()

const META: Record<string, { icon: typeof Pencil; kind: 'idle' | 'wait' | 'ok' | 'bad' }> = {
  draft: { icon: Pencil, kind: 'idle' },
  in_review: { icon: Hourglass, kind: 'wait' },
  approved: { icon: CircleCheck, kind: 'wait' },
  published: { icon: Speakerphone, kind: 'ok' },
  paused: { icon: PlayerPause, kind: 'wait' },
  cancelled: { icon: CircleX, kind: 'bad' },
  finished: { icon: Flag, kind: 'idle' },
}
const meta = computed(() => META[props.status] ?? { icon: Flag, kind: 'idle' as const })
</script>

<template>
  <span class="st" :class="`is-${meta.kind}`" :data-status="status">
    <NIcon :component="meta.icon" :size="14" aria-hidden="true" />
    {{ t(`org.status.${status}`, status) }}
  </span>
</template>

<style scoped>
.st {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--a-line);
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 650;
  white-space: nowrap;
  color: var(--a-muted);
}
.st.is-ok {
  border-color: color-mix(in srgb, var(--a-ok) 55%, transparent);
  color: var(--a-ok);
}
.st.is-wait {
  border-color: color-mix(in srgb, var(--a-gold) 55%, transparent);
  color: var(--a-gold);
}
.st.is-bad {
  border-color: color-mix(in srgb, var(--a-danger) 55%, transparent);
  color: var(--a-danger);
}
</style>
