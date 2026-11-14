# 11 — Rencana ronde 5 (handoff untuk sesi bersih)

Dibuat 2026-11-11. Permintaan pengguna: (1) denah 2D masih kurang, pakai alat desain profesional; (2) beli 2 tiket dalam 1 pembayaran harus mudah; (3) riset kebutuhan di komunitas/medsos; (4) halaman events/login/register jangan gelap semua: header, filter, footer perlu varian terang seperti landing.

## Yang sudah benar (jangan dibangun ulang)
- 1 pembayaran untuk banyak tiket SUDAH didukung BE: satu `hold` berisi banyak item -> satu `POST /orders/quote` -> satu order. FE sudah memilih banyak kursi (peta, "Pilih otomatis N orang") atau jumlah (festival), lalu 1 checkout.
- Aset 3D Blender + MCP `tixgo-venue` ada di `frontend/tools/venue-3d` (lihat README).
- Ada sesi lain yang menambah `lightPalette` di `src/theme.app.ts` dan transisi halaman: BACA ULANG `AuthLayout.vue`, `AppShell.vue`, `AppHeader.vue`, `theme.app.ts`, `styles/app.css` sebelum mengedit.

## Paket kerja (urut)
1. **Riset dulu (bukti, bukan ingatan):** Baymard Institute (seat selection & checkout), Reddit r/UXDesign + r/webdev, Dribbble/Behance "seat map" & "ticket booking", pola Ticketmaster/SeatGeek/DICE/Tiket.com/Loket. Simpan temuan + tautan di `docs/references/` (tanpa gambar di sesi).
2. **Beli 2+ tiket mudah (quantity-first):** langkah "Berapa tiket?" (stepper 1-6) di atas denah/kategori; "Pilih otomatis" langsung memakai jumlah itu; ringkasan bernomor per tiket; di checkout: ubah jumlah/lepas satu kursi, nama pemilik per tiket (`attendees` di `CreateOrderReq`), opsi bagi bayar lewat squad (`POST /events/{slug}/squads`). Uji e2e: 2 kursi berdampingan -> 1 total -> voucher.
3. **Denah 2D pro:** buat lapisan dasar venue dengan alat profesional: render ORTOGRAF dari Blender (aset sudah ada) atau SVG dari Inkscape/Figma (instal bila belum ada), dipasang sebagai alas; lapisan kursi/zona tetap dari API (interaktif). Tambah: lorong berlabel, penanda pintu/toilet, heatmap harga, mini-peta navigasi, sudut pandang panggung per zona.
4. **Tema terang bergaya landing:** pola landing = hero gelap + bagian krem. Terapkan: header terang saat di atas bagian terang, bar filter + footer + kartu auth bisa terang; pakai `lightPalette` (kontras >= 4,5:1), skema per-section (`.app--light`/`data-tone`), bukan sakelar global. Uji axe + dcheck di kedua tema.
5. Setelah itu: pembayaran (`POST /orders` + Midtrans/fake) dan antre adil.

## Catatan teknis
- Jalankan BE: API :8081 + worker (email) + `CORS_ORIGINS` memuat :5180; FE `pnpm dev --port 5180`.
- E2E: `E2E_BASE_URL=http://localhost:5180 E2E_BE_LOG=<api.log>,<worker.log> pnpm exec playwright test --workers=2`; mesin sibuk bikin flaky, ulangi serial (`--workers=1`) sebelum menyimpulkan bug.

## Status (2026-11-11, sesi lanjutan)
- **Paket 4 SELESAI (tema terang per-section):** token `.tone-light` di `src/styles/app.css` (+ `--a-glass/--a-panel/--a-shadow`), `lightPalette`/`lightThemeOverrides` di `src/theme.app.ts`, komponen `ToneLight.vue` (token CSS + NConfigProvider terang), `useHeaderTone` (header terang saat hasil terfilter tanpa hero). Diterapkan: band hasil Events + FilterBar, footer, sisi kanan auth + kartu tiket. Kartu berfoto tetap gelap lewat `.on-dark`. Kontras diukur: ink 15,0 · muted 6,3 · gold 5,2 · danger 5,9 · ok 5,3 · on-gold 5,75.
- Bukti: `pnpm check` hijau (37 tes), dcheck LULUS di /masuk, /daftar, /events, /events?genre=Rock (hanya peringatan spacing-grid), e2e serial 90 lulus / 4 skip.
- Catatan: rute login = `/masuk`, bukan `/login` (dcheck pada URL salah tetap "lulus" pada halaman kosong — cek `0 elemen terlihat` di notes.md).
- Sisa: paket 1 (riset), 2 (quantity-first), 3 (denah 2D pro), 5 (pembayaran + antre).

## Status lanjutan (2026-11-11): mode gelap/terang + denah + latar
- **Mode gelap/terang**: `useThemeMode` (localStorage `tixgo.mode`, bawaan terang), `ModeToggle.vue` di header & halaman auth. Terang = gaya landing (hero gelap, bagian krem, detail/checkout terang); gelap = semua gelap (`.app.is-dark .tone-light` mengembalikan token gelap). Kartu/hero foto tetap gelap via `.on-dark`.
- **Denah festival**: gradien zona, berkas lampu + truss, tooltip hover (harga + sisa), zoom/geser (tombol + seret). **Dropdown zona** (`data-test=zone-select`).
- **Bernomor**: pencari kursi bertingkat Kategori → Bagian → Kursi (`find-*`) selain klik peta.
- **Latar katalog**: `ConcertBackdrop.vue` (lampu panggung, siluet penonton, not & tiket).
- Bukti: pnpm check hijau, e2e 98 lulus/4 skip (spec baru `e2e/mode-finder.spec.ts`), dcheck lulus.
- Belum: denah dari render ortografi Blender (butuh Blender terpasang), nama pemilik per tiket, bagi bayar squad, riset Baymard.
