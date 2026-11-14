import { createRouter, createWebHistory } from 'vue-router'

import { homeFor, isOrganizer, isStaff } from '@/utils/roles'

import { safeNext } from './next'

// Layout dimuat malas: hanya rute aplikasi/auth yang butuh, landing tidak ikut mengunduh Naive UI.
const AppShell = () => import('@/layouts/AppShell.vue')
const AuthLayout = () => import('@/layouts/AuthLayout.vue')
const PublicLayout = () => import('@/layouts/PublicLayout.vue')

declare module 'vue-router' {
  interface RouteMeta {
    /** Wajib login; tamu dialihkan ke /masuk?next=. */
    requiresAuth?: boolean
    /** Wajib email + HP terverifikasi (antre/hold/checkout). */
    requiresVerified?: boolean
    /** Hanya tamu; yang sudah masuk dialihkan ke `next`/beranda katalog. */
    guestOnly?: boolean
    /** Rute satu kelompok berbagi cangkang layout: transisi halaman tidak memasang ulang cangkangnya. */
    group?: string
    /** Halaman sudah punya tombol kembali sendiri; cangkang tidak menambah satu lagi. */
    ownBack?: boolean
    /** Peran yang boleh masuk (selain itu dialihkan ke katalog). BE tetap memeriksa tiap permintaan. */
    requiresOrganizer?: boolean
    /** Hanya staf internal (admin/finance/support/editor); selain itu dialihkan ke katalog. */
    requiresStaff?: boolean
    /** Cangkang dashboard (organizer | admin): judul halaman diambil dari sini. */
    dash?: 'organizer' | 'admin'
    /** Kunci i18n judul halaman. */
    title?: string
    /** Salinan panel samping layout auth (kunci i18n auth.side.<key>). */
    authKey?: string
  }
}

// Posisi scroll terakhir per halaman. Dicatat sendiri karena angka dari vue-router sudah terpotong
// saat daftar menyusut jadi skeleton ketika rute ditinggalkan.
const lastScroll = new Map<string, number>()

// Rute bisnis ditambahkan per modul (docs/05 §5).
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Landing = halaman penuh tanpa layout (navigasi & footer milik landing sendiri; docs/23).
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/LandingPage.vue'),
    },

    // Aplikasi pelanggan: AppShell (header + footer).
    {
      path: '/',
      component: AppShell,
      children: [
        {
          path: 'events',
          name: 'events',
          component: () => import('@/pages/app/EventsPage.vue'),
          meta: { title: 'events.title' },
        },
        {
          path: 'checkout/:holdId',
          name: 'checkout',
          component: () => import('@/pages/app/CheckoutPage.vue'),
          meta: { requiresVerified: true, title: 'checkout.title' },
        },
        {
          path: '',
          component: () => import('@/layouts/AccountLayout.vue'),
          meta: { requiresAuth: true, group: 'account' },
          children: [
            {
              path: 'ringkasan',
              name: 'overview',
              component: () => import('@/pages/account/OverviewPage.vue'),
              meta: { requiresAuth: true, title: 'ov.title' },
            },
            {
              path: 'tiket',
              name: 'tickets',
              component: () => import('@/pages/account/TicketsPage.vue'),
              meta: { requiresAuth: true, title: 'acct.tickets' },
            },
            {
              path: 'tiket/:id',
              name: 'ticket',
              component: () => import('@/pages/account/TicketDetailPage.vue'),
              meta: { requiresAuth: true, title: 'tk.title', ownBack: true },
            },
            {
              path: 'pesanan',
              name: 'orders',
              component: () => import('@/pages/account/OrdersPage.vue'),
              meta: { requiresAuth: true, title: 'acct.orders' },
            },
            {
              path: 'refund',
              name: 'refunds',
              component: () => import('@/pages/account/RefundsPage.vue'),
              meta: { requiresAuth: true, title: 'acct.nav_.refunds' },
            },
            {
              path: 'voucher',
              name: 'vouchers',
              component: () => import('@/pages/account/VouchersPage.vue'),
              meta: { requiresAuth: true, title: 'acct.nav_.vouchers' },
            },
            {
              path: 'favorit',
              name: 'favorites',
              component: () => import('@/pages/account/FavoritesPage.vue'),
              meta: { requiresAuth: true, title: 'acct.favorites' },
            },
            {
              path: 'diikuti',
              name: 'following',
              component: () => import('@/pages/account/FollowingPage.vue'),
              meta: { requiresAuth: true, title: 'fol.title' },
            },
            {
              path: 'squad-saya',
              name: 'squads',
              component: () => import('@/pages/account/SquadsPage.vue'),
              meta: { requiresAuth: true, title: 'sq.listTitle' },
            },
            {
              path: 'jual-beli',
              name: 'resale',
              component: () => import('@/pages/account/ResalePage.vue'),
              meta: { requiresAuth: true, title: 'rs.pageTitle' },
            },
            {
              path: 'waitlist',
              name: 'waitlists',
              component: () => import('@/pages/account/WaitlistPage.vue'),
              meta: { requiresAuth: true, title: 'wl.title' },
            },
            {
              path: 'notifikasi',
              name: 'notifications',
              component: () => import('@/pages/account/NotificationsPage.vue'),
              meta: { requiresAuth: true, title: 'acct.nav_.notifications' },
            },
            {
              path: 'keamanan',
              name: 'security',
              component: () => import('@/pages/account/SecurityPage.vue'),
              meta: { requiresAuth: true, title: 'acct.nav_.security' },
            },
            {
              path: 'privasi',
              name: 'privacy',
              component: () => import('@/pages/account/PrivacyPage.vue'),
              meta: { requiresAuth: true, title: 'acct.nav_.privacy' },
            },
            {
              path: 'bantuan',
              name: 'help',
              component: () => import('@/pages/account/HelpPage.vue'),
              meta: { requiresAuth: true, title: 'acct.nav_.help' },
            },
            {
              path: 'bantuan/:id',
              name: 'support-thread',
              component: () => import('@/pages/account/SupportThreadPage.vue'),
              meta: { requiresAuth: true, title: 'hp.thread', ownBack: true },
            },
            {
              path: 'akun',
              name: 'profile',
              component: () => import('@/pages/account/ProfilePage.vue'),
              meta: { requiresAuth: true, title: 'acct.profile' },
            },
          ],
        },
        {
          path: 'pesanan/:id',
          name: 'order',
          component: () => import('@/pages/app/OrderPage.vue'),
          meta: { requiresAuth: true, title: 'order.title' },
        },
        {
          path: 'pesanan/:id/refund',
          name: 'order-refund',
          component: () => import('@/pages/app/RefundPage.vue'),
          meta: { requiresAuth: true, title: 'refund.title' },
        },
        {
          path: 'pesanan/:id/bayar',
          name: 'order-pay',
          component: () => import('@/pages/app/OrderPage.vue'),
          meta: { requiresAuth: true, title: 'order.title' },
        },
        {
          path: 'squad/:code',
          name: 'squad-join',
          component: () => import('@/pages/app/SquadJoinPage.vue'),
          meta: { requiresAuth: true, title: 'sq.joinTitle' },
        },
        {
          path: 'squads/:id',
          name: 'squad',
          component: () => import('@/pages/app/SquadPage.vue'),
          meta: { requiresAuth: true, title: 'sq.title' },
        },
        {
          path: 'artis',
          name: 'artists',
          component: () => import('@/pages/app/ArtistsPage.vue'),
          meta: { title: 'art.title' },
        },
        {
          path: 'kalender',
          name: 'calendar',
          component: () => import('@/pages/app/CalendarPage.vue'),
          meta: { title: 'cal.title' },
        },
        {
          path: 'venue',
          name: 'venues',
          component: () => import('@/pages/app/VenuesPage.vue'),
          meta: { title: 'ven.title' },
        },
        {
          path: 'venue/:id',
          name: 'venue',
          component: () => import('@/pages/app/VenuePage.vue'),
        },
        {
          path: 'artis/:slug',
          name: 'artist',
          component: () => import('@/pages/app/ArtistPage.vue'),
        },
        {
          path: 'events/:slug/antre',
          name: 'queue',
          component: () => import('@/pages/app/QueuePage.vue'),
          meta: { requiresVerified: true, title: 'wr.title' },
        },
        {
          path: 'claim/:token',
          name: 'claim',
          component: () => import('@/pages/account/ClaimPage.vue'),
          meta: { requiresAuth: true, title: 'claim.title' },
        },
        {
          path: 'pengaduan-privasi',
          name: 'privacy-complaint',
          component: () => import('@/pages/ComplaintPage.vue'),
          meta: { title: 'pc.title' },
        },
        {
          path: 'legal/:kind',
          name: 'legal',
          component: () => import('@/pages/LegalPage.vue'),
          meta: { title: 'legal.title' },
        },
        {
          path: 'events/:slug',
          name: 'event',
          component: () => import('@/pages/app/EventDetailPage.vue'),
        },
      ],
    },

    // Auth: tata letak terpusat (tanpa header penuh).
    {
      path: '/',
      component: AuthLayout,
      children: [
        {
          path: 'masuk',
          name: 'login',
          component: () => import('@/pages/auth/LoginPage.vue'),
          meta: { guestOnly: true, title: 'auth.login.title', authKey: 'login' },
        },
        {
          path: 'daftar',
          name: 'register',
          component: () => import('@/pages/auth/RegisterPage.vue'),
          meta: { guestOnly: true, title: 'auth.register.title', authKey: 'register' },
        },
        {
          path: 'lupa-sandi',
          name: 'forgot',
          component: () => import('@/pages/auth/ForgotPage.vue'),
          meta: { guestOnly: true, title: 'auth.forgot.title', authKey: 'forgot' },
        },
        {
          path: 'verifikasi-hp',
          name: 'verify-phone',
          component: () => import('@/pages/auth/VerifyPhonePage.vue'),
          meta: { requiresAuth: true, title: 'auth.phone.title', authKey: 'verify' },
        },
        // Tautan email dari BE: /auth/verify-email & /auth/reset-password (service.link). Alias = nama di rencana.
        {
          path: 'auth/reset-password',
          alias: '/atur-ulang-sandi',
          name: 'reset',
          component: () => import('@/pages/auth/ResetPage.vue'),
          meta: { title: 'auth.reset.title', authKey: 'forgot' },
        },
        {
          path: 'auth/confirm-email-change',
          name: 'confirm-email-change',
          component: () => import('@/pages/auth/ConfirmEmailChangePage.vue'),
          meta: { title: 'auth.emailChange.title', authKey: 'verify' },
        },
        {
          path: 'auth/verify-email',
          alias: '/verifikasi-email',
          name: 'verify-email',
          component: () => import('@/pages/auth/VerifyEmailPage.vue'),
          meta: { title: 'auth.email.title', authKey: 'verify' },
        },
      ],
    },

    // Dashboard organizer & panel admin: cangkang sendiri (DashShell), bukan header/footer pelanggan.
    {
      path: '/organizer',
      component: () => import('@/layouts/DashShell.vue'),
      meta: { requiresAuth: true, requiresOrganizer: true, dash: 'organizer' },
      children: [
        { path: '', redirect: { name: 'org-home' } },
        {
          path: 'beranda',
          name: 'org-home',
          component: () => import('@/pages/org/OrgHomePage.vue'),
          meta: { title: 'dash.nav.org-home' },
        },
        {
          path: 'events',
          name: 'org-events',
          component: () => import('@/pages/org/OrgEventsPage.vue'),
          meta: { title: 'org.nav_.org-events' },
        },
        {
          path: 'events/new',
          name: 'org-event-new',
          component: () => import('@/pages/org/OrgEventEditPage.vue'),
          meta: { title: 'org.event.new' },
        },
        {
          path: 'events/:id',
          component: () => import('@/pages/org/OrgEventLayout.vue'),
          children: [
            {
              path: '',
              name: 'org-event',
              component: () => import('@/pages/org/OrgEventEditPage.vue'),
              meta: { title: 'org.event.edit' },
            },
            {
              path: 'penjualan',
              name: 'org-event-sales',
              component: () => import('@/pages/org/OrgSalesPage.vue'),
              meta: { title: 'dash.event.tab.sales' },
            },
            {
              path: 'peserta',
              name: 'org-event-attendees',
              component: () => import('@/pages/org/OrgAttendeesPage.vue'),
              meta: { title: 'dash.event.tab.attendees' },
            },
            {
              path: 'promo',
              name: 'org-event-promo',
              component: () => import('@/pages/org/OrgPromoPage.vue'),
              meta: { title: 'dash.event.tab.promo' },
            },
            {
              path: 'kontrol',
              name: 'org-event-control',
              component: () => import('@/pages/org/OrgControlPage.vue'),
              meta: { title: 'dash.event.tab.control' },
            },
          ],
        },
        {
          path: 'venues',
          name: 'org-venues',
          component: () => import('@/pages/org/OrgVenuesPage.vue'),
          meta: { title: 'org.nav_.org-venues' },
        },
        {
          path: 'artists',
          name: 'org-artists',
          component: () => import('@/pages/org/OrgArtistsPage.vue'),
          meta: { title: 'org.nav_.org-artists' },
        },
      ],
    },
    {
      path: '/admin',
      component: () => import('@/layouts/DashShell.vue'),
      meta: { requiresAuth: true, requiresStaff: true, dash: 'admin' },
      children: [
        { path: '', redirect: { name: 'admin-home' } },
        {
          path: 'beranda',
          name: 'admin-home',
          component: () => import('@/pages/admin/AdminHomePage.vue'),
          meta: { title: 'dash.nav.admin-home' },
        },
        {
          path: 'events',
          name: 'admin-events',
          component: () => import('@/pages/admin/AdminEventsPage.vue'),
          meta: { title: 'dash.nav.admin-events' },
        },
        {
          path: 'organizer',
          name: 'admin-organizers',
          component: () => import('@/pages/admin/AdminOrganizersPage.vue'),
          meta: { title: 'dash.nav.admin-organizers' },
        },
        {
          path: 'pengguna',
          name: 'admin-users',
          component: () => import('@/pages/admin/AdminUsersPage.vue'),
          meta: { title: 'dash.nav.admin-users' },
        },
        {
          path: 'pencairan',
          name: 'admin-payouts',
          component: () => import('@/pages/admin/AdminPayoutsPage.vue'),
          meta: { title: 'dash.nav.admin-payouts' },
        },
      ],
    },

    // /_kit hanya ada di dev; dibuang dari build produksi (docs/18 §7).
    ...(import.meta.env.DEV
      ? [
          {
            path: '/',
            component: PublicLayout,
            children: [
              { path: '_kit', name: 'kit', component: () => import('@/pages/KitPage.vue') },
            ],
          },
        ]
      : []),
    // Tangkap-semua: URL tak dikenal tampil halaman 404 (bukan layar kosong).
    {
      path: '/:pathMatch(.*)*',
      component: AppShell,
      children: [
        {
          path: '',
          name: 'not-found',
          component: () => import('@/pages/NotFoundPage.vue'),
          meta: { title: 'nf.title' },
        },
      ],
    },
  ],
  // Pindah halaman = mulai dari section paling atas (bukan posisi scroll halaman sebelumnya).
  // Kembali/maju browser tetap memulihkan posisi lama; tautan jangkar (#...) digulir ke elemennya.
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) {
      // Halaman daftar memuat ulang data (skeleton lebih pendek dari daftar), jadi posisi lama baru
      // diterapkan setelah dokumen cukup tinggi; kalau tidak, browser memotongnya ke tinggi skeleton.
      return new Promise((resolve) => {
        const target = lastScroll.get(to.fullPath) ?? savedPosition.top
        let tries = 0
        const apply = () => {
          const room = document.documentElement.scrollHeight - window.innerHeight
          if (room >= target - 4 || tries++ >= 20) return resolve({ left: 0, top: target })
          setTimeout(apply, 50)
        }
        setTimeout(apply, 50)
      })
    }
    if (to.hash) return { el: to.hash, top: 96, behavior: 'auto' }
    return { top: 0, behavior: 'auto' }
  },
})

router.beforeEach((_to, from) => {
  if (from.fullPath) lastScroll.set(from.fullPath, window.scrollY)
})

router.beforeEach(async (to) => {
  const needsSession = to.meta.requiresAuth || to.meta.requiresVerified || to.meta.guestOnly
  if (!needsSession) return true // halaman publik tidak menunggu jaringan

  // Impor malas: store auth menarik axios + modul API, tidak perlu ikut di bundel awal landing.
  const { useAuthStore } = await import('@/stores/auth')
  const auth = useAuthStore()
  if (!auth.ready) await auth.restore()

  if (to.meta.guestOnly && auth.isAuthed) return safeNext(to.query.next, homeFor(auth.user?.role))

  if ((to.meta.requiresAuth || to.meta.requiresVerified) && !auth.isAuthed) {
    return { name: 'login', query: { next: to.fullPath } }
  }
  if (to.meta.requiresOrganizer && !isOrganizer(auth.user?.role)) return { name: 'events' }
  if (to.meta.requiresStaff && !isStaff(auth.user?.role)) return { name: 'events' }
  if (to.meta.requiresVerified && !auth.isVerified) {
    const name = auth.emailVerified ? 'verify-phone' : 'verify-email'
    return { name, query: { next: to.fullPath } }
  }
  return true
})
