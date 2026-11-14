<script setup lang="ts">
import {
  ArrowLeft,
  Bell,
  Clock,
  Discount2,
  Friends,
  Heart,
  Home2,
  Lifebuoy,
  Lock,
  Receipt,
  ReceiptRefund,
  ShieldLock,
  Tag,
  Ticket,
  User,
  Users,
} from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { useMediaQuery } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import BackLink from '@/components/app/BackLink.vue'
import ToneLight from '@/components/app/ToneLight.vue'
import UserAvatar from '@/components/app/UserAvatar.vue'
import { useHeaderTone } from '@/composables/useHeaderTone'
import { useAuthStore } from '@/stores/auth'
import '@/pages/account/accountStyle.css'

// Cangkang area akun: kepala profil + navigasi samping (desktop) / tab geser (HP) + isi halaman.
const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const compact = useMediaQuery('(max-width: 820px)')
// Halaman puncak akun kembali ke daftar tiket; dari tiket sendiri kembali ke katalog.
const backTo = computed(() => ({ name: route.name === 'overview' ? 'events' : 'overview' }))
useHeaderTone(computed(() => 'light'))

const nav = [
  { name: 'overview', icon: Home2 },
  { name: 'tickets', icon: Ticket },
  { name: 'orders', icon: Receipt },
  { name: 'refunds', icon: ReceiptRefund },
  { name: 'vouchers', icon: Discount2 },
  { name: 'favorites', icon: Heart },
  { name: 'following', icon: Users },
  { name: 'waitlists', icon: Clock },
  { name: 'squads', icon: Friends },
  { name: 'resale', icon: Tag },
  { name: 'notifications', icon: Bell },
  { name: 'profile', icon: User },
  { name: 'security', icon: ShieldLock },
  { name: 'privacy', icon: Lock },
  { name: 'help', icon: Lifebuoy },
] as const
</script>

<template>
  <ToneLight class="acs-band"
    ><div class="acs">
      <header class="acs__head">
        <UserAvatar
          :name="auth.user?.name ?? ''"
          :avatar-key="auth.user?.avatar_key"
          :size="compact ? 48 : 64"
        />
        <div class="acs__who">
          <strong class="a-serif">{{ auth.user?.name }}</strong>
          <small class="a-muted">{{ auth.user?.email }}</small>
          <span class="acs__chips">
            <span class="ac__badge" :class="auth.user?.email_verified ? 'is-paid' : 'is-pending'">
              {{ t('acct.chipEmail') }}
            </span>
            <span class="ac__badge" :class="auth.user?.phone_verified ? 'is-paid' : 'is-pending'">
              {{ t('acct.chipPhone') }}
            </span>
          </span>
        </div>
        <!-- Jalan pulang ke katalog: di layar HP tautan "Konser" di header disembunyikan,
             jadi halaman akun butuh pintunya sendiri. -->
        <RouterLink class="acs__explore" :to="{ name: 'events' }" data-test="back-events">
          <NIcon :component="ArrowLeft" :size="16" aria-hidden="true" />
          {{ t('acct.explore') }}
        </RouterLink>
      </header>
      <nav class="acs__nav" :aria-label="t('acct.nav')">
        <RouterLink v-for="n in nav" :key="n.name" :to="{ name: n.name }" class="acs__link">
          <NIcon :component="n.icon" :size="18" aria-hidden="true" />
          <span>{{ t(`acct.nav_.${n.name}`) }}</span>
        </RouterLink>
      </nav>
      <main class="acs__main">
        <BackLink v-if="!route.meta.ownBack" plain class="acs__back" :fallback="backTo" />
        <RouterView v-slot="{ Component, route: r }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="r.path" />
          </Transition>
        </RouterView>
      </main></div
  ></ToneLight>
</template>

<style scoped>
.acs-band {
  min-height: calc(100vh - 66px);
}
.acs {
  max-width: 1120px;
  margin: 0 auto;
  padding: 28px var(--a-pad) 0;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  grid-template-areas:
    'head head'
    'nav main';
  gap: 20px 32px;
  align-items: start;
}
.acs__head {
  grid-area: head;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid var(--a-line);
  border-radius: 18px;
  background: var(--a-panel);
}
.acs__who {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.acs__who strong {
  font-size: 22px;
  color: var(--a-cream);
  overflow-wrap: anywhere;
}
.acs__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.acs__explore {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  color: var(--a-ink);
  text-decoration: none;
  font-size: 14px;
  white-space: nowrap;
}
.acs__explore:hover {
  border-color: var(--a-gold);
  color: var(--a-gold);
}
.acs__nav {
  grid-area: nav;
  display: grid;
  gap: 4px;
  position: sticky;
  top: 88px;
}
.acs__link {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border-radius: 12px;
  color: var(--a-ink);
  text-decoration: none;
  font-size: 15px;
}
.acs__link:hover {
  background: var(--a-bg3);
}
.acs__link.router-link-active {
  background: var(--a-gold);
  color: var(--a-on-gold, var(--a-bg));
  font-weight: 600;
}
.acs__back {
  margin-bottom: 14px;
}
.acs__main {
  grid-area: main;
  min-width: 0;
}
@media (max-width: 820px) {
  .acs__head {
    padding: 12px 14px;
    gap: 12px;
  }
  .acs__who strong {
    font-size: 18px;
  }
  .acs__who small {
    display: none;
  }
  .acs__chips {
    margin-top: 2px;
  }
  .acs__explore {
    margin-left: auto;
    min-height: 40px;
    padding: 0 12px;
    font-size: 13px;
  }
}
@media (max-width: 820px) {
  .acs {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'head'
      'nav'
      'main';
  }
  .acs__nav {
    position: static;
    display: flex;
    overflow-x: auto;
    gap: 8px;
    scrollbar-width: none;
    margin: 0 calc(var(--a-pad) * -1);
    padding: 0 var(--a-pad);
  }
  .acs__link {
    flex: none;
    border: 1px solid var(--a-line);
    border-radius: 999px;
  }
}
</style>
