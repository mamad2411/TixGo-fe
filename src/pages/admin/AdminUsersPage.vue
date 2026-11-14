<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Search, Users } from '@vicons/tabler'
import { watchDebounced } from '@vueuse/core'
import { NIcon, NInput, useMessage } from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  blockUser,
  getUser,
  searchUsers,
  setUserRole,
  unblockUser,
  userSignals,
  type AdminUser,
  type RiskSignal,
} from '@/api/admin'
import EmptyState from '@/components/app/EmptyState.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import Chip from '@/components/dash/Chip.vue'
import PageHeader from '@/components/dash/PageHeader.vue'
import SideSheet from '@/components/dash/SideSheet.vue'
import { useApiMessage } from '@/composables/useApiMessage'
import { useAuthStore } from '@/stores/auth'
import '@/components/dash/dashList.css'

// Pencarian pengguna + blokir/buka blokir + ubah peran staf. Peran organizer/gate dikelola dari sisi organizer, bukan di sini.
const { t, locale } = useI18n()
useHead({ title: computed(() => t('dash.nav.admin-users')) })
const route = useRoute()
const router = useRouter()
const message = useMessage()
const apiMessage = useApiMessage()
const auth = useAuthStore()
const bcp = computed(() => (locale.value === 'en' ? 'en-GB' : 'id-ID'))
const when = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat(bcp.value, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(iso))
    : ''

const q = ref(String(route.query.q ?? ''))
const role = computed(() => String(route.query.role ?? ''))
const status = computed(() => String(route.query.status ?? ''))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
function setQuery(patch: Record<string, string | undefined>): void {
  const next: Record<string, unknown> = { ...route.query, ...patch }
  for (const k of Object.keys(next)) if (!next[k]) delete next[k]
  void router.replace({ query: next as Record<string, string> })
}
watchDebounced(q, (v) => setQuery({ q: v.trim() || undefined, page: undefined }), { debounce: 300 })
const filters = computed(() => [q.value.trim(), role.value, status.value].filter(Boolean).length)
function clearAll(): void {
  q.value = ''
  void router.replace({ query: {} })
}

const ROLES = [
  'customer',
  'organizer',
  'organizer_member',
  'gate_staff',
  'support',
  'finance',
  'editor',
  'admin',
] as const
const STAFF = ['customer', 'support', 'finance', 'editor'] as const

const rows = ref<AdminUser[]>([])
const hasMore = ref(false)
const state = ref<'loading' | 'ok' | 'error'>('loading')
const err = ref('')
let seq = 0
async function load(): Promise<void> {
  const my = ++seq
  state.value = 'loading'
  try {
    const r = await searchUsers(
      { q: String(route.query.q ?? ''), role: role.value, status: status.value },
      page.value,
    )
    if (my !== seq) return
    rows.value = r.data
    hasMore.value = r.hasMore
    state.value = 'ok'
  } catch (e) {
    if (my !== seq) return
    err.value = apiMessage(e)
    state.value = 'error'
  }
}
watch(() => route.fullPath, load, { immediate: true })
onBeforeUnmount(() => seq++)

const riskKind = (n: number): 'idle' | 'wait' | 'bad' =>
  n >= 70 ? 'bad' : n >= 30 ? 'wait' : 'idle'

// ---- detail ----
const open = ref(false)
const cur = ref<AdminUser | null>(null)
const signals = ref<RiskSignal[]>([])
const mode = ref<'' | 'block' | 'role'>('')
const reason = ref('')
const newRole = ref('')
const busy = ref(false)
const isSelf = computed(() => cur.value?.id === auth.user?.id)
const canChangeRole = computed(
  () => !!cur.value && (STAFF as readonly string[]).includes(cur.value.role) && !isSelf.value,
)

async function show(u: AdminUser): Promise<void> {
  cur.value = u
  signals.value = []
  mode.value = ''
  reason.value = ''
  newRole.value = u.role
  open.value = true
  try {
    const [full, sig] = await Promise.all([getUser(u.id), userSignals(u.id)])
    cur.value = full
    signals.value = sig
  } catch (e) {
    message.error(apiMessage(e))
  }
}
async function doBlock(): Promise<void> {
  if (!cur.value || reason.value.trim().length < 3 || busy.value) return
  busy.value = true
  try {
    await blockUser(cur.value.id, reason.value.trim())
    message.success(t('dash.users.done.block'))
    open.value = false
    await load()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
async function doUnblock(): Promise<void> {
  if (!cur.value || busy.value) return
  busy.value = true
  try {
    await unblockUser(cur.value.id)
    message.success(t('dash.users.done.unblock'))
    open.value = false
    await load()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
async function doRole(): Promise<void> {
  if (!cur.value || !newRole.value || newRole.value === cur.value.role || busy.value) return
  busy.value = true
  try {
    await setUserRole(cur.value.id, newRole.value)
    message.success(t('dash.users.done.role'))
    open.value = false
    await load()
  } catch (e) {
    message.error(apiMessage(e))
  } finally {
    busy.value = false
  }
}
const sigLabel = (s: RiskSignal): string => String(s.kind ?? s.signal ?? '-')
</script>

<template>
  <div data-test="admin-users">
    <PageHeader :title="t('dash.nav.admin-users')" :lead="t('dash.users.lead')" />

    <div class="dl-toolbar" role="search">
      <label class="dl-search">
        <NIcon :component="Search" :size="18" aria-hidden="true" />
        <span class="a-sr">{{ t('dash.users.search') }}</span>
        <input
          v-model="q"
          type="search"
          :placeholder="t('dash.users.search')"
          data-test="user-search"
        />
      </label>
      <select
        class="a-select"
        :value="role"
        :aria-label="t('dash.users.role')"
        data-test="user-role"
        @change="
          setQuery({
            role: ($event.target as HTMLSelectElement).value || undefined,
            page: undefined,
          })
        "
      >
        <option value="">{{ t('dash.users.allRoles') }}</option>
        <option v-for="r in ROLES" :key="r" :value="r">{{ t(`dash.role.${r}`) }}</option>
      </select>
      <select
        class="a-select"
        :value="status"
        :aria-label="t('dash.users.status')"
        data-test="user-status"
        @change="
          setQuery({
            status: ($event.target as HTMLSelectElement).value || undefined,
            page: undefined,
          })
        "
      >
        <option value="">{{ t('dash.users.allStatus') }}</option>
        <option value="active">{{ t('dash.users.st.active') }}</option>
        <option value="blocked">{{ t('dash.users.st.blocked') }}</option>
      </select>
    </div>
    <p class="a-muted count" aria-live="polite">
      {{ t('dash.users.count', { n: rows.length }) }}
      <template v-if="filters">
        ·
        <button type="button" class="link" @click="clearAll">
          {{ t('dash.event.att.clear') }} ({{ filters }})
        </button></template
      >
    </p>

    <div
      v-if="state === 'loading'"
      class="a-sk dl-sk"
      role="status"
      :aria-label="t('common.loading')"
    />
    <ErrorState v-else-if="state === 'error'" :message="err" @retry="load" />
    <EmptyState
      v-else-if="!rows.length"
      :icon="Users"
      :title="t('dash.users.emptyT')"
      :body="t('dash.users.emptyB')"
    >
      <button v-if="filters" type="button" class="a-pill" @click="clearAll">
        {{ t('dash.event.att.clear') }}
      </button>
    </EmptyState>
    <template v-else>
      <ul class="dl-list" data-test="user-list">
        <li v-for="u in rows" :key="u.id" class="dl-row">
          <div class="dl-row__m">
            <strong>{{ u.name || u.email }}</strong>
            <small class="a-muted"
              >{{ u.name ? u.email : ''
              }}<template v-if="u.last_login_at">
                · {{ t('dash.users.lastLogin', { d: when(u.last_login_at) }) }}</template
              ></small
            >
          </div>
          <div class="dl-row__tags">
            <Chip>{{ t(`dash.role.${u.role}`, u.role) }}</Chip>
            <Chip :kind="u.status === 'blocked' ? 'bad' : 'ok'">{{
              t(`dash.users.st.${u.status}`, u.status)
            }}</Chip>
            <Chip :kind="riskKind(u.risk_score)">{{
              t('dash.users.risk', { n: u.risk_score })
            }}</Chip>
          </div>
          <button
            type="button"
            class="a-pill a-pill--sm dl-row__go"
            data-test="user-open"
            @click="show(u)"
          >
            {{ t('dash.users.open') }}
          </button>
        </li>
      </ul>
      <nav v-if="page > 1 || hasMore" class="dl-pager" :aria-label="t('events.pager')">
        <button
          type="button"
          class="a-pill a-pill--sm"
          :disabled="page <= 1"
          @click="setQuery({ page: page - 1 > 1 ? String(page - 1) : undefined })"
        >
          {{ t('common.prev') }}
        </button>
        <span class="a-muted">{{ t('dash.users.pageN', { p: page }) }}</span>
        <button
          type="button"
          class="a-pill a-pill--sm"
          :disabled="!hasMore"
          @click="setQuery({ page: String(page + 1) })"
        >
          {{ t('common.next') }}
        </button>
      </nav>
    </template>

    <SideSheet v-model:show="open" :title="cur ? cur.name || cur.email : ''">
      <div v-if="cur" class="sh" data-test="user-sheet">
        <dl class="dl-facts">
          <div>
            <dt>{{ t('dash.users.email') }}</dt>
            <dd>{{ cur.email }}</dd>
          </div>
          <div>
            <dt>{{ t('dash.users.role') }}</dt>
            <dd>{{ t(`dash.role.${cur.role}`, cur.role) }}</dd>
          </div>
          <div>
            <dt>{{ t('dash.users.status') }}</dt>
            <dd>{{ t(`dash.users.st.${cur.status}`, cur.status) }}</dd>
          </div>
          <div>
            <dt>{{ t('dash.users.mfa') }}</dt>
            <dd>{{ cur.mfa_enabled ? t('dash.users.mfaOn') : t('dash.users.mfaOff') }}</dd>
          </div>
          <div>
            <dt>{{ t('dash.users.joined') }}</dt>
            <dd>{{ when(cur.created_at) }}</dd>
          </div>
          <div v-if="cur.orders !== undefined">
            <dt>{{ t('dash.users.activity') }}</dt>
            <dd>{{ t('dash.users.activityV', { o: cur.orders ?? 0, t: cur.tickets ?? 0 }) }}</dd>
          </div>
        </dl>

        <h3 class="dl-sec">
          {{ t('dash.users.signals') }} ·
          <Chip :kind="riskKind(cur.risk_score)">{{
            t('dash.users.risk', { n: cur.risk_score })
          }}</Chip>
        </h3>
        <p v-if="!signals.length" class="dl-note">{{ t('dash.users.noSignals') }}</p>
        <ul v-else class="sig">
          <li v-for="(s, i) in signals" :key="s.id ?? i">
            <strong>{{ sigLabel(s) }}</strong>
            <span class="a-muted"
              >+{{ s.score ?? 0 }} · {{ s.created_at ? when(s.created_at) : '' }}</span
            >
          </li>
        </ul>

        <template v-if="mode === 'block'">
          <label class="dl-field" for="bl-reason">{{ t('dash.users.reasonBlock') }}</label>
          <NInput
            id="bl-reason"
            v-model:value="reason"
            type="textarea"
            :maxlength="300"
            show-count
            :autosize="{ minRows: 2, maxRows: 5 }"
            data-test="block-reason"
          />
          <small class="a-muted">{{ t('dash.users.reasonBlockHint') }}</small>
        </template>
        <template v-else-if="mode === 'role'">
          <label class="dl-field" for="rl-sel">{{ t('dash.users.newRole') }}</label>
          <select id="rl-sel" v-model="newRole" class="a-select" data-test="role-select">
            <option v-for="r in STAFF" :key="r" :value="r">{{ t(`dash.role.${r}`) }}</option>
          </select>
          <p class="dl-note">{{ t('dash.users.roleNote') }}</p>
        </template>
        <p v-if="isSelf" class="dl-note">{{ t('dash.users.self') }}</p>
      </div>
      <template v-if="cur && !isSelf" #footer>
        <div class="dl-btns">
          <template v-if="!mode">
            <button
              v-if="cur.status === 'blocked'"
              type="button"
              class="a-pill a-pill--solid"
              :disabled="busy"
              :aria-busy="busy"
              data-test="user-unblock"
              @click="doUnblock"
            >
              {{ t('dash.users.unblock') }}
            </button>
            <button
              v-else
              type="button"
              class="a-pill"
              :disabled="busy"
              data-test="user-block"
              @click="mode = 'block'"
            >
              {{ t('dash.users.block') }}
            </button>
            <button
              v-if="canChangeRole"
              type="button"
              class="a-pill"
              :disabled="busy"
              data-test="user-role-start"
              @click="mode = 'role'"
            >
              {{ t('dash.users.changeRole') }}
            </button>
          </template>
          <template v-else-if="mode === 'block'">
            <button
              type="button"
              class="a-pill a-pill--solid"
              :disabled="busy || reason.trim().length < 3"
              :aria-busy="busy"
              data-test="block-confirm"
              @click="doBlock"
            >
              {{ t('dash.users.blockGo') }}
            </button>
            <button type="button" class="a-pill" :disabled="busy" @click="mode = ''">
              {{ t('org.cancel') }}
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="a-pill a-pill--solid"
              :disabled="busy || newRole === cur.role"
              :aria-busy="busy"
              data-test="role-confirm"
              @click="doRole"
            >
              {{ t('dash.users.roleGo') }}
            </button>
            <button type="button" class="a-pill" :disabled="busy" @click="mode = ''">
              {{ t('org.cancel') }}
            </button>
          </template>
        </div>
      </template>
    </SideSheet>
  </div>
</template>

<style scoped>
.count {
  margin: 0 2px 14px;
  font-size: 14px;
}
.link {
  border: 0;
  background: none;
  padding: 0;
  color: var(--a-gold);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}
.sh {
  display: grid;
  gap: 12px;
}
.sig {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.sig li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--a-line);
  border-radius: 12px;
  font-size: 14px;
}
</style>
