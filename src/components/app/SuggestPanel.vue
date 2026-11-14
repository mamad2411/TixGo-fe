<script setup lang="ts">
import { Building, History, MapPin, Microphone2, Music, Search, Ticket, X } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { clearRecent, type SearchSuggest, type SuggestItem } from '@/composables/useSearchSuggest'

import EventThumb from './EventThumb.vue'

const props = defineProps<{ sg: SearchSuggest }>()
const { t } = useI18n()

const ICON = {
  event: Ticket,
  artist: Microphone2,
  venue: Building,
  city: MapPin,
  genre: Music,
  query: Search,
  recent: History,
} as const
const GROUP_ORDER = ['recent', 'event', 'artist', 'venue', 'city', 'genre', 'query'] as const
// Kelompok berurutan: judul kelompok muncul sekali di item pertamanya.
const rows = computed(() => {
  const seen = new Set<string>()
  return props.sg.items.value.map((it, i) => {
    const first = !seen.has(it.kind)
    seen.add(it.kind)
    return { it, i, first }
  })
})
const showEmpty = computed(
  () =>
    props.sg.term.value.trim().length >= 2 &&
    !props.sg.loading.value &&
    props.sg.items.value.length === 1,
)
const parts = (it: SuggestItem): { text: string; hit: boolean }[] => {
  const q = props.sg.term.value.trim()
  if (!q || it.kind === 'query' || it.kind === 'recent') return [{ text: it.label, hit: false }]
  const at = it.label.toLocaleLowerCase('id-ID').indexOf(q.toLocaleLowerCase('id-ID'))
  if (at < 0) return [{ text: it.label, hit: false }]
  return [
    { text: it.label.slice(0, at), hit: false },
    { text: it.label.slice(at, at + q.length), hit: true },
    { text: it.label.slice(at + q.length), hit: false },
  ]
}
void GROUP_ORDER
</script>

<template>
  <div
    v-if="sg.open.value && (sg.items.value.length || sg.loading.value)"
    class="sg"
    data-test="suggest"
  >
    <ul :id="sg.listId" class="sg__list" role="listbox" :aria-label="t('sg.label')">
      <template v-for="r in rows" :key="r.it.id">
        <li v-if="r.first" class="sg__head" role="presentation">
          <span>{{ t(`sg.kind.${r.it.kind}`) }}</span>
          <button
            v-if="r.it.kind === 'recent'"
            type="button"
            class="sg__clear"
            @mousedown.prevent="clearRecent()"
          >
            <NIcon :component="X" :size="14" aria-hidden="true" /> {{ t('sg.clearRecent') }}
          </button>
        </li>
        <li
          :id="sg.optId(r.i)"
          role="option"
          class="sg__opt"
          :class="{ 'is-active': sg.active.value === r.i }"
          :aria-selected="sg.active.value === r.i"
          data-test="suggest-item"
          :data-kind="r.it.kind"
          @mousedown.prevent="sg.pick(r.it)"
          @mousemove="sg.setActive(r.i)"
        >
          <EventThumb
            v-if="r.it.img"
            :src="r.it.img"
            :title="r.it.label"
            :w="40"
            :h="40"
            class="sg__img"
          />
          <span v-else class="sg__ic"
            ><NIcon :component="ICON[r.it.kind]" :size="18" aria-hidden="true"
          /></span>
          <span class="sg__txt">
            <span class="sg__label"
              ><template v-for="(p, k) in parts(r.it)" :key="k"
                ><b v-if="p.hit">{{ p.text }}</b
                ><template v-else>{{ p.text }}</template></template
              ></span
            >
            <small v-if="r.it.sub" class="sg__sub">{{ r.it.sub }}</small>
          </span>
        </li>
      </template>
    </ul>
    <p v-if="sg.loading.value" class="sg__note" role="status">{{ t('common.loading') }}</p>
    <p v-else-if="sg.failed.value" class="sg__note" role="alert">{{ t('sg.failed') }}</p>
    <p v-else-if="showEmpty" class="sg__note">{{ t('sg.none') }}</p>
  </div>
</template>

<style scoped>
.sg {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 70;
  max-height: min(70vh, 520px);
  overflow: auto;
  border-radius: 18px;
  border: 1px solid var(--a-line);
  background: var(--a-panel, #fff);
  color: var(--a-ink);
  box-shadow: 0 18px 48px rgb(0 0 0 / 0.22);
  padding: 6px;
}
.sg__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.sg__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px 4px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--a-muted);
}
.sg__clear {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  background: none;
  border: 0;
  color: var(--a-gold-d, var(--a-gold));
  font: inherit;
  font-size: 12px;
  text-transform: none;
  letter-spacing: 0;
  cursor: pointer;
}
.sg__opt {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 52px;
  padding: 6px 12px;
  border-radius: 12px;
  cursor: pointer;
}
.sg__opt.is-active {
  background: rgb(217 185 121 / 0.2);
}
.sg__img {
  border-radius: 10px !important;
  flex: none;
}
.sg__ic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgb(217 185 121 / 0.16);
  color: var(--a-gold-d, var(--a-gold));
  flex: none;
}
.sg__txt {
  display: grid;
  min-width: 0;
}
.sg__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sg__label b {
  color: var(--a-gold-d, var(--a-gold));
}
.sg__sub {
  color: var(--a-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sg__note {
  margin: 0;
  padding: 10px 14px;
  color: var(--a-muted);
  font-size: 14px;
}
</style>
