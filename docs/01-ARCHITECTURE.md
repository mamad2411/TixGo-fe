# 01 — Arsitektur Frontend

## Tiga "aplikasi" dalam satu codebase

Publik/Pembeli · Organizer · Gate (PWA), plus `/admin`. Dipisah lewat **route group + layout**, bukan build terpisah.

```
main.ts ─► App.vue (NConfigProvider + Message/Dialog provider) ─► RouterView
                              │
                 router/ ─► layouts/ (Public | Account | Organizer | Gate) ─► pages/
                              │
        stores/ (Pinia) ◄─► composables/ (useWs, useCountdown, useQueue, useHold) ◄─► api/ (axios + tipe OpenAPI)
```

## Struktur `src/`

| Folder         | Isi                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------- |
| `api/`         | `client.ts` (axios), `generated/schema.d.ts` (hasil `pnpm api:gen`; **jangan edit manual**) |
| `components/`  | UI umum (SeatMap, QueueCard, TicketCard, …) — per modul                                     |
| `composables/` | logika reaktif berulang                                                                     |
| `layouts/`     | cangkang halaman per aplikasi                                                               |
| `pages/`       | satu komponen per route                                                                     |
| `router/`      | definisi route + guard (auth/role/admission)                                                |
| `stores/`      | Pinia: auth, hold/cart, queue, ui                                                           |
| `i18n/`        | `id.json`, `en.json` (id default)                                                           |
| `styles/`      | `tokens.css` (token KARCIS)                                                                 |
| `theme.ts`     | `themeOverrides` Naive UI                                                                   |

## Status implementasi (setup)

| Bagian                                    | Status                                                           |
| ----------------------------------------- | ---------------------------------------------------------------- |
| Vite + Vue 3 + TS strict, alias `@`       | ada                                                              |
| Tema KARCIS (`tokens.css`, `theme.ts`)    | ada, kontras terukur                                             |
| `App.vue` providers, router, i18n, Pinia  | ada                                                              |
| `PublicLayout`                            | ada (header sederhana); Account/Organizer/Gate = cangkang kosong |
| `HomePage`, `KitPage` (`/_kit`, dev-only) | ada                                                              |
| Klien axios + tipe OpenAPI                | ada (path `/healthz`, `/readyz` saja)                            |
| Tes                                       | 1 smoke test                                                     |
| Halaman bisnis                            | belum — per modul (`../docs/14-AGENT-PLAYBOOK.md` §4)            |

## Area halaman Pro-Core (rancangan; `../../docs/05-STRUKTUR.md` §5, `../../docs/20-MODUL-PRO.md`)

Legal & statis (`/legal/:kind`, `/status`), bantuan & support (`/help`, `/support`), privasi & keamanan akun (`/account/privacy`, `/account/security`), pemulihan akun (`/auth/*`), organizer pro (`/organizer/finance|attendees|promos|kyb`), finance (`/finance`), CMS & ops (`/admin`). Banner cookie dan halaman error (404/500/429/503/offline) global di `App`/router.

## `/_kit`

Hanya didaftarkan saat `import.meta.env.DEV`; terverifikasi **tidak ada** di bundle produksi.

## Sumber

`src/**`, `vite.config.ts`, `../docs/05-STRUKTUR.md` §4–§5.
