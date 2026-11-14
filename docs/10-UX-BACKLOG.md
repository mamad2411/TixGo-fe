# 10 — Audit UX & Backlog Desain (pelanggan)

Dibuat 2026-11-11 setelah umpan balik pengguna ronde 3. Peran: product designer + developer. Skala: **P0** = merusak kepercayaan/alur, **P1** = terasa tidak profesional, **P2** = poles.

## Temuan audit (dari tangkapan layar pengguna + pemeriksaan kode)
| # | Temuan | Akar | Sev | Status |
|---|---|---|---|---|
| 1 | Detail event & halaman auth tanpa tombol kembali | rute dibuat tanpa pola navigasi balik | P0 | SELESAI (g1) |
| 2 | Kontrol hero (jeda + thumbnail) menempel/tertimpa filter bar | `margin-top:-64px` filter bar tanpa ruang aman | P1 | SELESAI (g1) |
| 3 | Urutan "Terbaru/Terlaris" menghilangkan hero + thumbnail | `hasFilters` menganggap `sort` = mode terfilter (hero disembunyikan) | P0 | SELESAI (g1) |
| 4 | Denah zona festival = 2 kotak berwarna ("AI slop"): tanpa pit, barikade, FOH, menara, bar, toilet, pintu, akses disabilitas | digambar generik dari tier | P0 | SELESAI (g3) |
| 5 | Denah kursi = grid titik tanpa seksi, lorong, huruf baris, kemiringan; tak bisa dipilih; tak ada kursi terisi | seed hanya 1 seksi 8x12; API tak punya status per kursi | P0 | SELESAI (g3) |
| 6 | Tidak ada pratinjau 3D / sudut pandang panggung | belum dibangun | P1 | SELESAI (g3) |
| 7 | Tidak ada voucher/promo; ringkasan harga tidak jujur-rinci | alur hold/quote belum disambung ke FE | P0 | SELESAI (g4) |
| 8 | Login/Daftar/Lupa sandi monoton: kartu polos di atas gradien, tanpa konteks nilai, tanpa kekuatan sandi | satu `AuthLayout` generik | P1 | SELESAI (g2) |
| 9 | Beli tiket berujung dialog "segera dibuka" | F3/F4 belum | P0 | hold+checkout+voucher SELESAI (g4); pembayaran Midtrans = berikutnya |
| 10 | Teks persetujuan tak bertaut ke Syarat/Privasi | halaman legal belum ada | P1 | backlog |
| 11 | Tidak ada halaman artis/venue/favorit/tiket saya | F2 sisa, F5, F6 | P1 | backlog |
| 12 | Tidak ada mode terang/pilihan bahasa di UI | belum | P2 | backlog |

## Gelombang
1. **Navigasi & hero (cepat):** tombol Kembali (riwayat → fallback `/events`), jarak aman hero↔filter, hero konsisten untuk semua urutan, urutan hanya memengaruhi grid.
2. **Auth v2:** tata letak terbelah (panel foto sinematik + nilai produk + konser unggulan nyata | form), kekuatan sandi, stepper daftar, tautan kembali.
3. **Denah profesional:** layout per jenis tempat (teater lengkung, arena berundak, festival berdiri: pit/barikade/FOH/menara/bar/toilet/pintu/akses), seksi + lorong + huruf baris, status kursi nyata (endpoint baru `GET /events/:slug/seats/status`), pilih kursi, pratinjau 3D (three.js, data dari API), sudut pandang.
4. **Hold + Checkout + Voucher:** `POST holds` (kursi/kuota), `/checkout/:holdId` dengan timer, voucher via `POST /orders/quote` (diskon dihitung server), rincian harga jujur, lepas tiket. Pembayaran = F4 lanjut.
5. **Backlog:** halaman legal, artis/venue, akun (favorit, tiket), antre adil (X-Admission-Token), PWA, i18n en, mode terang.

## Keputusan teknis
- **3D:** `three` di browser, model dibangkitkan dari data API (kursi/zona) — bisa diperbarui langsung saat ketersediaan berubah. Blender (terpasang di mesin ini) dipakai bila nanti butuh aset panggung berkualitas render (GLB statis); bukan syarat pratinjau.
- **Status kursi:** endpoint baru BE read-only (kontrak: edit dokumen + openapi di commit yang sama).
- **Voucher:** tidak ada daftar voucher publik di BE; voucher dimasukkan manual dan divalidasi server lewat `quote`.

## Sumber
Tangkapan layar pengguna (2026-11-11), `backend/internal/service/{hold,order,pricing,seatmap}.go`, `backend/internal/handler/{commerce,catalog}.go`, `frontend/docs/09-CUSTOMER-APP.md`.

## Status 2026-11-11 (akhir ronde 3)
Gelombang 1-4 selesai dan terbukti (e2e 92/92 sebelum perbaikan terakhir; lihat laporan sesi). Fakta implementasi:
- BE: `GET /events/{slug}/seats/status` (publik, kursi held/sold/blocked; openapi + API-ROUTES diregenerasi, `TestOpenAPIMatchesRouter` hijau). `cmd/seed-demo -layouts` membuat denah teater/aula/arena (646/392/1.505 kursi) + voucher demo (NEON25, KIRANA50K, POP15 min Rp500rb, JAZZ10, BEAT20, VINYL15K, HEMAT10).
- FE: `components/venue/{SeatMap2D,Venue3D,FestivalPlan2D,VenueExplorer}.vue`, `utils/{venue,festival}.ts`, `pages/app/CheckoutPage.vue`, `api/orders.ts`. three.js dimuat lazy (chunk terpisah). Peta kursi: seksi, lorong, huruf baris, kursi menghadap panggung, terjual/ditahan, kursi disabilitas, tooltip, zoom/pan, papan ketik (panah/Enter), pilih otomatis via `/seats/suggest`, penyegaran status tiap 15 dtk.
- Sisa: pembayaran (`POST /orders` + Midtrans/fake), antre adil (X-Admission-Token), WS `seat.updated` menggantikan polling, halaman legal, artis/venue, akun/tiket saya, model Blender untuk aset panggung (Blender terpasang; MCP belum dipakai).

## Ronde 4 (2026-11-11): riset -> alat -> hasil
Keluhan: 2D/3D "masih jelek", auth "monoton". Dilakukan: riset referensi (Dribbble concert login/seat map/ticket booking, SeatGeek, Vercel/Linear/Spotify login) -> pola: login = foto/poster layar penuh + form minimal + motif tiket; denah = pengungkapan bertahap (zona dulu, kursi saat zoom) + tampilan miring/isometrik.
- **3D:** pipeline Blender headless (`tools/venue-3d`, 12 aset GLB ±1,9 MB) + MCP `tixgo-venue`; `Venue3D` memuat GLB dengan PBR (RoomEnvironment), ACES, bayangan lembut, figur penonton instancing, kursi detail saat dipilih.
- **2D:** sektor cincin per seksi x kategori (chip nama/harga/sisa), kursi muncul saat zoom >= 1,7x, mode "Miring", papan ketik.
- **Auth:** dinding poster konser nyata bergulir (PosterWall) + kartu tiket (ADMIT ONE, perforasi, barcode) + stepper + meter sandi.
- Bug nyata ditemukan: blur input mencabut tombol "Hapus pencarian" saat diklik; i18n dengan `@`.
