# 02 — Konvensi Frontend

| Topik         | Aturan                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Komponen      | `<script setup lang="ts">`, Composition API; satu komponen satu tanggung jawab                                       |
| Tipe          | TS strict; tipe API **dari** `src/api/generated` (bukan ditulis manual); tanpa `any` tanpa alasan                    |
| Impor         | alias `@/…`; Naive UI diimpor per komponen (`import { NButton } from 'naive-ui'`)                                    |
| State         | Pinia untuk state lintas halaman; state lokal tetap di komponen                                                      |
| Data server   | selalu dari API; **harga/total dihitung server**, FE hanya menampilkan                                               |
| Token         | access token di memori (store), refresh via cookie `HttpOnly`; **bukan** `localStorage`                              |
| HTML          | `v-html` hanya dengan `dompurify`; konten organizer dianggap tidak tepercaya                                         |
| i18n          | semua teks lewat `vue-i18n` (`id` default, `en`); tidak ada string UI hard-coded di komponen bisnis                  |
| Ikon          | `@vicons/tabler`; **tanpa emoji** di kode                                                                            |
| Gaya          | pakai CSS variable dari `tokens.css`; hindari warna hex di komponen                                                  |
| State wajib   | loading (skeleton), kosong, error (kode error → pesan ramah), WS putus                                               |
| Aksesibilitas | fokus terlihat, keyboard di seat map, label teks untuk status kursi, target sentuh ≥ 44 px, `prefers-reduced-motion` |
| Real-time     | `useWs` + resync REST setelah reconnect; fallback polling harus terlihat di UI                                       |
| Idempotensi   | request pembuat order/bayar mengirim `Idempotency-Key` (UUID/ULID per aksi pengguna)                                 |
| Commit tipe   | `pnpm build` (vue-tsc) harus hijau sebelum merge                                                                     |

## Menambah halaman

Lihat `../skills/tixgo-vue-page/SKILL.md` dan, untuk visual, `../skills/tixgo-karcis-ui/SKILL.md`.

## Sumber

`../docs/07-DESIGN-UI.md`, `../docs/12-RBAC-SECURITY.md` §3, §5, `../docs/16-UI-IDENTITY.md`.
