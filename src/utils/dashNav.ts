import {
  BuildingStore,
  Calendar,
  Cash,
  ChartBar,
  Dashboard,
  MapPin,
  Microphone2,
  ShieldCheck,
  Users,
} from '@vicons/tabler'
import type { Component } from 'vue'

// Peta menu dashboard. `roles` kosong = semua peran yang boleh masuk area itu.
// Menu yang tidak berhak TIDAK ditampilkan; rute tetap dijaga guard + BE (docs/12 RBAC).
export interface DashItem {
  /** nama rute; label i18n = dash.nav.<name> */
  name: string
  icon: Component
  roles?: readonly string[]
  /** awalan nama rute lain yang tetap menandai item ini aktif (mis. halaman detail) */
  also?: readonly string[]
}
export interface DashGroup {
  /** kunci i18n dash.group.<key> */
  key: string
  items: DashItem[]
}

export const ORG_NAV: DashGroup[] = [
  {
    key: 'work',
    items: [
      { name: 'org-home', icon: Dashboard },
      { name: 'org-events', icon: Calendar, also: ['org-event'] },
    ],
  },
  {
    key: 'master',
    items: [
      { name: 'org-venues', icon: MapPin },
      { name: 'org-artists', icon: Microphone2 },
    ],
  },
]

export const ADMIN_NAV: DashGroup[] = [
  {
    key: 'overview',
    items: [{ name: 'admin-home', icon: ChartBar }],
  },
  {
    key: 'review',
    items: [
      { name: 'admin-events', icon: ShieldCheck, roles: ['admin'] },
      { name: 'admin-organizers', icon: BuildingStore, roles: ['admin'] },
    ],
  },
  {
    key: 'people',
    items: [{ name: 'admin-users', icon: Users, roles: ['admin'] }],
  },
  {
    key: 'money',
    items: [{ name: 'admin-payouts', icon: Cash, roles: ['admin', 'finance'] }],
  },
]

/** Hanya item yang boleh dilihat peran ini; grup kosong dibuang. */
export function visibleNav(groups: DashGroup[], role?: string): DashGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.roles || (!!role && i.roles.includes(role))),
    }))
    .filter((g) => g.items.length > 0)
}
