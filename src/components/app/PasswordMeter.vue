<script setup lang="ts">
import { Check, X } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// Umpan balik kekuatan sandi. Aturan wajib = cermin BE (>=12, huruf+angka); sisanya hanya bonus kekuatan.
const props = defineProps<{ password: string }>()
const { t } = useI18n()

const rules = computed(() => [
  { key: 'len', ok: props.password.length >= 12 },
  { key: 'mix', ok: /\p{L}/u.test(props.password) && /\d/.test(props.password) },
  { key: 'sym', ok: /[^\p{L}\d\s]/u.test(props.password), bonus: true },
])
const score = computed(() => {
  const p = props.password
  if (!p) return 0
  let s = 0
  if (p.length >= 12) s++
  if (/\p{L}/u.test(p) && /\d/.test(p)) s++
  if (/[^\p{L}\d\s]/u.test(p)) s++
  if (p.length >= 16 || (/\p{Lu}/u.test(p) && /\p{Ll}/u.test(p) && p.length >= 12)) s++
  if (/(.)\1{3,}|0123|1234|abcd|qwer|password|sandi/i.test(p)) s = Math.max(0, s - 2)
  return Math.min(4, s)
})
const labels = ['', 'weak', 'fair', 'good', 'strong'] as const
</script>

<template>
  <div v-if="password" class="pm" data-test="pw-meter">
    <div
      class="pm__bars"
      role="img"
      :aria-label="t('auth.meter.aria', { l: t(`auth.meter.${labels[score] || 'weak'}`) })"
    >
      <i v-for="n in 4" :key="n" :class="{ on: n <= score }" :data-s="score" />
    </div>
    <p class="pm__lab" :data-s="score">{{ t(`auth.meter.${labels[score] || 'weak'}`) }}</p>
    <ul class="pm__rules">
      <li v-for="r in rules" :key="r.key" :class="{ ok: r.ok }">
        <NIcon :component="r.ok ? Check : X" :size="14" aria-hidden="true" />
        {{ t(`auth.meter.rule.${r.key}`)
        }}<small v-if="r.bonus"> ({{ t('auth.meter.optional') }})</small>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pm {
  display: grid;
  gap: 6px;
  margin-top: 4px;
}
.pm__bars {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}
.pm__bars i {
  height: 4px;
  border-radius: 4px;
  background: rgb(239 229 207 / 0.16);
  transition: background 0.2s;
}
.pm__bars i.on[data-s='1'] {
  background: #e0705a;
}
.pm__bars i.on[data-s='2'] {
  background: #e6c85a;
}
.pm__bars i.on[data-s='3'],
.pm__bars i.on[data-s='4'] {
  background: var(--a-ok);
}
.pm__lab {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--a-muted);
}
.pm__rules {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--a-muted);
}
.pm__rules li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pm__rules li.ok {
  color: var(--a-ok);
}
</style>
