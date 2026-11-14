<script setup lang="ts">
import {
  AdjustmentsHorizontal,
  ArrowsSort,
  CalendarEvent,
  Cash,
  FilterOff,
  LayoutGrid,
  MapPin,
  Search,
  Ticket,
  X,
} from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SelectPill from '@/components/app/SelectPill.vue'
import { activeCount, EMPTY_FILTERS, type Filters } from '@/utils/filters'
import SuggestPanel from '@/components/app/SuggestPanel.vue'
import { rememberSearch, useSearchSuggest } from '@/composables/useSearchSuggest'
import { formatEventDate } from '@/utils/format'
import { genreIcon } from '@/utils/icons'

const props = defineProps<{
  modelValue: Filters
  cities: { name: string; count: number }[]
  genres: { name: string; count: number }[]
}>()
const emit = defineEmits<{ 'update:modelValue': [Filters] }>()
const { t, locale } = useI18n()

const sg = useSearchSuggest('f', {
  inEvents: (term) => t('sg.search', { q: term }),
  date: (e) =>
    `${formatEventDate(e.starts_at, e.tz, locale.value === 'en' ? 'en-GB' : 'id-ID')} · ${e.venue_name}`,
})
const draft = sg.term
draft.value = props.modelValue.q
watch(
  () => props.modelValue.q,
  (v) => (draft.value = v),
)
const panelOpen = ref(false)

function patch(p: Partial<Filters>): void {
  emit('update:modelValue', { ...props.modelValue, ...p })
}
function setKey<K extends keyof Filters>(k: K, v: string): void {
  patch({ [k]: v } as Partial<Filters>)
}
function submit(): void {
  sg.open.value = false
  if (draft.value.trim()) rememberSearch(draft.value)
  // blur tanpa perubahan tidak boleh memicu navigasi (bisa menghapus tombol yang sedang diklik)
  if (draft.value.trim() === props.modelValue.q) return
  patch({ q: draft.value.trim() })
}
function clearAll(): void {
  draft.value = ''
  emit('update:modelValue', { ...EMPTY_FILTERS, sort: props.modelValue.sort })
}

const n = computed(() => activeCount(props.modelValue))
const cityOpts = computed(() =>
  props.cities.map((c) => ({ value: c.name, label: `${c.name} (${c.count})` })),
)
const whenOpts = computed(() =>
  (['7d', '30d', '90d', 'weekend'] as const).map((v) => ({
    value: v,
    label: t(`filters.when.${v}`),
  })),
)
const priceOpts = computed(() =>
  (['lt200', '200-500', 'gt500'] as const).map((v) => ({
    value: v,
    label: t(`filters.price.${v}`),
  })),
)
const statusOpts = computed(() =>
  (['onsale', 'upcoming', 'soldout'] as const).map((v) => ({
    value: v,
    label: t(`filters.statusOpt.${v}`),
  })),
)
const sortOpts = computed(() =>
  (['new', 'popular'] as const).map((v) => ({ value: v, label: t(`filters.sortOpt.${v}`) })),
)

// Chip filter aktif yang bisa dihapus satu per satu.
const chips = computed(() => {
  const f = props.modelValue
  const out: { key: keyof Filters; label: string }[] = []
  if (f.q) out.push({ key: 'q', label: `“${f.q}”` })
  if (f.city) out.push({ key: 'city', label: f.city })
  if (f.genre) out.push({ key: 'genre', label: f.genre })
  if (f.when) out.push({ key: 'when', label: t(`filters.when.${f.when}`) })
  if (f.price) out.push({ key: 'price', label: t(`filters.price.${f.price}`) })
  if (f.status) out.push({ key: 'status', label: t(`filters.statusOpt.${f.status}`) })
  return out
})
</script>

<template>
  <section class="fb" :aria-label="t('filters.label')">
    <div class="fb__top">
      <form class="fb__search" role="search" @submit.prevent="submit">
        <SuggestPanel :sg="sg" />
        <label class="a-sr" for="fb-q">{{ t('nav.searchLabel') }}</label>
        <NIcon :component="Search" :size="20" aria-hidden="true" />
        <input
          id="fb-q"
          v-model="draft"
          type="search"
          maxlength="100"
          autocomplete="off"
          :placeholder="t('filters.searchPlaceholder')"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="sg.open.value"
          :aria-controls="sg.listId"
          :aria-activedescendant="sg.active.value >= 0 ? sg.optId(sg.active.value) : undefined"
          data-test="search-input"
          @focus="sg.open.value = true"
          @input="sg.open.value = true"
          @keydown="sg.onKey($event)"
          @blur="((sg.open.value = false), submit())"
        />
        <button
          v-if="draft"
          type="button"
          class="fb__x"
          :aria-label="t('filters.clearSearch')"
          @click="((draft = ''), submit())"
        >
          <NIcon :component="X" :size="18" aria-hidden="true" />
        </button>
        <button type="submit" class="fb__go">{{ t('nav.searchSubmit') }}</button>
      </form>
      <button
        type="button"
        class="fb__toggle"
        :aria-expanded="panelOpen"
        aria-controls="fb-panel"
        @click="panelOpen = !panelOpen"
      >
        <NIcon :component="AdjustmentsHorizontal" :size="20" aria-hidden="true" />
        {{ t('filters.title') }}
        <span v-if="n" class="fb__badge" aria-hidden="true">{{ n }}</span>
        <span v-if="n" class="a-sr">{{ t('filters.activeN', { n }) }}</span>
      </button>
    </div>

    <div class="fb__genres" role="group" :aria-label="t('filters.genre')">
      <button
        type="button"
        class="gt"
        :aria-pressed="!modelValue.genre"
        data-test="chip-genre-all"
        @click="setKey('genre', '')"
      >
        <span class="gt__ic"><NIcon :component="LayoutGrid" :size="22" aria-hidden="true" /></span>
        <span class="gt__t">{{ t('filters.all') }}</span>
      </button>
      <button
        v-for="g in genres"
        :key="g.name"
        type="button"
        class="gt"
        :aria-pressed="modelValue.genre === g.name"
        data-test="chip-genre"
        @click="setKey('genre', modelValue.genre === g.name ? '' : g.name)"
      >
        <span class="gt__ic"
          ><NIcon :component="genreIcon(g.name)" :size="22" aria-hidden="true"
        /></span>
        <span class="gt__t">{{ g.name }}</span>
        <small class="gt__n">{{ g.count }}</small>
      </button>
    </div>

    <div id="fb-panel" class="fb__panel" :class="{ 'is-open': panelOpen }">
      <SelectPill
        :model-value="modelValue.city"
        :label="t('filters.city')"
        :icon="MapPin"
        :options="cityOpts"
        :all-label="t('filters.allCities')"
        @update:model-value="setKey('city', $event)"
      />
      <SelectPill
        :model-value="modelValue.when"
        :label="t('filters.when.label')"
        :icon="CalendarEvent"
        :options="whenOpts"
        :all-label="t('filters.anytime')"
        @update:model-value="setKey('when', $event)"
      />
      <SelectPill
        :model-value="modelValue.price"
        :label="t('filters.price.label')"
        :icon="Cash"
        :options="priceOpts"
        :all-label="t('filters.anyPrice')"
        @update:model-value="setKey('price', $event)"
      />
      <SelectPill
        :model-value="modelValue.status"
        :label="t('filters.statusCap')"
        :icon="Ticket"
        :options="statusOpts"
        :all-label="t('filters.anyStatus')"
        @update:model-value="setKey('status', $event)"
      />
      <SelectPill
        :model-value="modelValue.sort"
        :label="t('filters.sort')"
        :icon="ArrowsSort"
        :options="sortOpts"
        :all-label="t('filters.sortOpt.date')"
        @update:model-value="setKey('sort', $event)"
      />
    </div>

    <div v-if="chips.length" class="fb__chips" data-test="active-filters">
      <span class="a-caps">{{ t('filters.active') }}</span>
      <button
        v-for="c in chips"
        :key="c.key"
        type="button"
        class="ac"
        :aria-label="t('filters.remove', { name: c.label })"
        @click="c.key === 'q' ? ((draft = ''), setKey('q', '')) : setKey(c.key, '')"
      >
        {{ c.label }} <NIcon :component="X" :size="14" aria-hidden="true" />
      </button>
      <button type="button" class="fb__clear" data-test="clear-filters" @click="clearAll">
        <NIcon :component="FilterOff" :size="16" aria-hidden="true" /> {{ t('filters.clearAll') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.fb {
  display: grid;
  grid-template-columns: minmax(0, 1fr); /* anak ber-scroll tidak boleh melebarkan kartu */
  min-width: 0;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--a-line);
  border-radius: 28px;
  background: var(--a-panel);
  backdrop-filter: blur(16px);
  box-shadow: var(--a-shadow);
}
.fb__top {
  display: flex;
  gap: 10px;
}
.fb__search {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 6px 0 20px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: var(--a-bg);
  color: var(--a-gold);
}
.fb__search:focus-within {
  border-color: var(--a-gold);
  box-shadow: 0 0 0 3px rgb(217 185 121 / 0.18);
}
.fb__search input {
  flex: 1;
  min-width: 0;
  min-height: 52px;
  border: 0;
  background: transparent;
  color: var(--a-ink);
  font: inherit;
  font-size: 16px;
}
.fb__search input:focus-visible {
  outline: none;
}
.fb__x {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--a-muted);
  cursor: pointer;
}
.fb__go {
  min-height: 44px;
  padding: 0 22px;
  border: 0;
  border-radius: 999px;
  background: var(--a-gold);
  color: var(--a-on-gold);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}
.fb__go:hover {
  background: var(--a-cream);
}
.fb__toggle {
  display: none;
  align-items: center;
  gap: 8px;
  min-height: 54px;
  padding: 0 18px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  background: var(--a-bg2);
  color: var(--a-gold);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.fb__badge {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--a-gold);
  color: var(--a-on-gold);
  font-size: 12px;
  font-weight: 800;
}

/* tab genre bergaya kategori: ikon bulat + label */
.fb__genres {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 2px 2px 8px;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}
.gt {
  flex: none;
  display: grid;
  justify-items: center;
  gap: 6px;
  min-width: 84px;
  padding: 8px 8px 6px;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: var(--a-muted);
  font: inherit;
  cursor: pointer;
  position: relative;
  scroll-snap-align: start;
  transition: color 0.18s;
}
.gt__ic {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border: 1px solid var(--a-line-strong);
  border-radius: 50%;
  background: var(--a-bg2);
  transition:
    background 0.18s,
    color 0.18s,
    transform 0.18s;
}
.gt__t {
  font-size: 13px;
  font-weight: 600;
}
.gt__n {
  position: absolute;
  top: 4px;
  right: 14px;
  min-width: 20px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--a-bg);
  border: 1px solid var(--a-line);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  color: var(--a-muted);
}
.gt:hover {
  color: var(--a-ink);
}
.gt:hover .gt__ic {
  transform: translateY(-2px);
  color: var(--a-gold);
}
.gt[aria-pressed='true'] {
  color: var(--a-gold);
}
.gt[aria-pressed='true'] .gt__ic {
  background: var(--a-gold);
  border-color: var(--a-gold);
  color: var(--a-on-gold);
}

.fb__panel {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.fb__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px dashed var(--a-line-strong);
}
.ac {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px 0 14px;
  border: 1px solid var(--a-gold);
  border-radius: 999px;
  background: rgb(217 185 121 / 0.12);
  color: var(--a-cream);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.ac:hover {
  background: rgb(217 185 121 / 0.24);
}
.fb__clear {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  margin-left: auto;
  padding: 0 8px;
  border: 0;
  background: none;
  color: var(--a-gold);
  font: inherit;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}

/* 5 kolom baru muat di atas 1120px; di bawahnya label filter mulai terpotong */
@media (max-width: 1120px) {
  .fb__panel {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 720px) {
  .fb {
    padding: 14px;
    border-radius: 22px;
  }
  .fb__toggle {
    display: inline-flex;
  }
  .fb__go {
    display: none; /* Enter di papan ketik ponsel mengirim */
  }
  .fb__panel {
    display: none;
    grid-template-columns: 1fr 1fr;
  }
  .fb__panel.is-open {
    display: grid;
  }
  .fb__clear {
    margin-left: 0;
  }
}
/* ponsel sempit: 2 kolom memotong label ("Semua har..."), pakai satu kolom penuh */
@media (max-width: 480px) {
  .fb__panel {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
