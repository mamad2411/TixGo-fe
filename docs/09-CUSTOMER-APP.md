# 09 — Aplikasi Pelanggan (rencana build lengkap, tema = landing)

Dibuat 2026-11-11. Sumber: `../../docs/06-FRD.md` (M1–M9, M14–M18, M20), `../../docs/07-DESIGN-UI.md` (wireframe), `../../docs/16-UI-IDENTITY.md`, `../../docs/22-KEPUTUSAN-PEMBAYARAN-REFUND.md`, `../../docs/references/API-ROUTES.md` (346 operasi; ±120 untuk pelanggan), `backend/api/openapi.yaml`. BE sudah selesai (lihat memori progres BE); FE baru: landing + `/_kit`.

## Keputusan (rekomendasi, bisa diubah)
| Soal | Keputusan | Alasan |
|---|---|---|
| Harus login? | **Jelajah bebas tanpa login** (beranda, katalog, detail, artis, venue, denah, bantuan). **Login + HP terverifikasi wajib** untuk antre, hold kursi, checkout (FRD M5-F1, M1-F1). Favorit/ingatkan → minta login lalu kembali ke halaman semula | mengikuti FRD; pola Ticketmaster/Tiket.com |
| Tema | Landing: gelap `#0c0a09` + krem `#f2ead8`, emas `#d9b979`, Cormorant Garamond (judul) + Manrope (UI). Halaman transaksi (denah, checkout, tiket) = **zona tenang**: tanpa parallax/animasi dekoratif (docs/16 prinsip 4); animasi ≤ 300 ms, `prefers-reduced-motion` dihormati | konsisten dengan landing, tidak mengganggu alur beli |
| Gateway | Midtrans Snap (dev: `PAYMENT_GATEWAY=fake` + `/dev/payments/settle`); halaman bayar = ringkasan + pilih metode + kebijakan refund + tombol bayar; hasil via WS lalu poll | docs/22, FRD M7 |
| Token auth | access JWT di memori (Pinia), refresh httpOnly cookie, rotasi; axios interceptor refresh sekali lalu ulang. Petunjuk `tixgo.sess` di localStorage hanya menandai "mungkin ada sesi" supaya tamu tidak menembak `/auth/refresh` (401 di konsol tiap muat halaman). Sesi yang putus di tengah jalan → toast + alihkan ke `/masuk?next=` | AGENTS.md FE |
| Teks | semua via i18n (id lengkap, en lengkap) | aturan proyek |

## Peta halaman (rute → API)
**Publik**
- `/events` katalog: filter kota/genre/tanggal/harga/status, cari, urut, paginasi, query-string, tampilan daftar|kalender — `GET /events`, `/calendar`
- `/events/:slug` detail: hero + countdown, tab Info/Lineup/Lokasi/Syarat/FAQ/Ulasan, tier harga, kebijakan refund, CTA sesuai status (Ingatkan · Kode presale · Gabung antrean · Pilih tiket · Sold out+Waitlist), favorit/ikuti/bagikan/tambah ke kalender — `/events/{slug}`, `/availability`, `/reviews`, `/photos`, `/reminders`, `/waitlist`, `/calendar.ics`, `/me/favorites`
- `/artists`, `/artists/:slug`; `/venues/:slug` (peta lokasi, denah) 
- `/help` (bantuan + cari), `/legal/:kind`, `/c/:kind/:slug` (CMS), banner/koleksi
**Auth**: `/masuk`, `/daftar`, verifikasi email, OTP HP, `/lupa-sandi`, `/atur-ulang-sandi` — `/auth/*`
**Alur beli** (butuh login)
1. `/events/:slug/antre` waiting room: posisi, ETA, progres, WS + poll 5 dtk, aturan, jendela admit + hitung mundur — `/queue/join|status|proof`, DELETE
2. `/events/:slug/pilih` denah SVG zoom/pan (`@panzoom/panzoom`), status kursi warna+pola, keyboard (panah+Enter), best-available, GA stepper, keranjang + timer, legenda, kursi diambil → sorot + saran — `/seatmap`, `/seatmap.svg`, `/seats/suggest`, `/holds`, `/holds/auto`, `/holds/{id}` (+extend, DELETE), WS `seat.updated`
3. `/checkout/:holdId` stepper Data → Bayar → Selesai: data pemilik tiket per kursi (validasi klien), kode promo, ringkasan harga dari server, kebijakan refund (wajib terlihat sebelum bayar), `Idempotency-Key`, metode bayar — `/orders`, `/orders/{id}/pay`
4. `/pesanan/:id/status` menunggu pembayaran (WS + poll), sukses/gagal/kedaluwarsa, unduh invoice
**Squad/Waitlist/Presale**: `/squad/:kode` gabung & bayar bagian; kode presale; registrasi fans.
**Akun** (`AccountLayout`): Tiket Saya (daftar, filter), `/tiket/:id` e-ticket QR berputar TOTP 30 dtk + cincin hitung mundur + offline, transfer (klaim `/claims/{token}`), resale, refund (formulir rekening), Pesanan & invoice, Favorit/Ikuti, Notifikasi + preferensi, Profil (nama, foto, email, sandi), Perangkat aktif, MFA TOTP, Privasi (ekspor/hapus akun/persetujuan), Passport (poin, badge), Dukungan (tiket bantuan), Concierge.

## Fase (urut, tiap fase ditutup `pnpm check` + e2e + `dcheck` + tangkapan layar)
| Fase | Isi | Selesai bila |
|---|---|---|
| F0 fondasi | tokens app (turunan landing), `AppShell` (header: logo, cari, kota, masuk/akun; footer), klien API + auth store + guard `meta.requiresAuth` (redirect `?next=`), toast/error global, i18n kunci umum, komponen dasar (Button, Field, EventCard, Countdown, Skeleton, EmptyState, ErrorState) | rute `/events` memuat data nyata dari BE dev |
| F1 auth | semua halaman auth + OTP + lupa sandi + persistensi sesi + logout | alur daftar→verifikasi→masuk→keluar teruji e2e |
| F2 katalog | `/events`, detail, artis, venue, kalender, favorit, ingatkan, bagikan | filter via query-string, state kosong/error/loading |
| F3 antre+denah | waiting room, seat map interaktif, hold + timer, GA | 0 oversell dari sisi UI (kursi diambil → pesan jelas), keyboard + a11y |
| F4 checkout+bayar | form, promo, ringkasan, gateway (fake di dev), status, invoice | order `paid` → tiket muncul tanpa reload |
| F5 tiket | Tiket Saya, e-ticket QR TOTP, transfer, resale, refund | QR berganti 30 dtk, tiket `used/void` tanpa QR aktif |
| F6 akun lengkap | profil, perangkat, MFA, privasi, notifikasi, passport, dukungan, favorit | semua tombol berfungsi, tidak ada tautan mati |
| F7 poles | SEO (`@unhead`), 404/500, PWA ringan, performa, i18n en, uji e2e penuh, audit axe | `project-forge verify` exit 0 |

## Status build (diperbarui 2026-11-11)
| Fase | Status | Bukti |
|---|---|---|
| F0 fondasi | selesai | `/events` memuat 3 konser nyata dari BE dev; `pnpm check` hijau (28 tes unit); axe + `dcheck` lulus di `/events`, `/masuk`, `/daftar` |
| F1 auth | selesai | e2e `e2e/auth.spec.ts` 24/24 (desktop + mobile 375): daftar → verifikasi email → OTP HP (salah lalu benar) → sesi bertahan setelah reload → keluar → masuk, `?next=` internal diikuti & eksternal ditolak, lupa/atur ulang sandi (tautan sekali pakai) |
| F2 katalog (sebagian) | UI v2 selesai 2026-11-11 | `/events` (hero spotlight, dock filter via query-string, rail, grid bento berfoto, favorit) dan `/events/:slug` (hero foto, lineup berfoto, panel tiket lengket, bagikan, kalender .ics, ingatkan, waitlist, bilah beli ponsel). e2e `catalog.spec.ts` 26/26; seluruh suite 66/66; axe + dcheck lulus; CLS 0,002 |
| F2 sisa | belum | halaman artis/venue, favorit di Akun, kalender bulanan, filter tanggal/harga |
| F3–F7 | belum | tombol "Beli tiket/Gabung antrean" saat ini memeriksa login + email + HP lalu membuka dialog "segera dibuka" (alur antre/hold/checkout = F3/F4) |

**Berkas F0/F1** — `src/api/{client,errors,auth,events}.ts` (interceptor refresh sekali, single-flight) · `src/stores/auth.ts` (token di memori) · `src/router/{index,next}.ts` (guard `requiresAuth|requiresVerified|guestOnly`, `safeNext`) · `src/layouts/{AppShell,AuthLayout}.vue` · `src/components/app/*` · `src/pages/auth/*` · `src/pages/app/EventsPage.vue` · `src/styles/app.css` + `src/theme.app.ts` (tema gelap landing, di-scope `.app`; landing & `/_kit` tidak berubah).

**Rute auth mengikuti tautan email BE** (`service.link`): `/auth/verify-email`, `/auth/reset-password` (alias `/verifikasi-email`, `/atur-ulang-sandi`). Skema OpenAPI auth masih `additionalProperties: true`, jadi tipe ditulis di `src/api/auth.ts` mengikuti handler BE; ganti ke tipe generate bila BE mengetik skemanya.

**Cara menjalankan lokal (semua perlu, urut):**
```
make infra                      # pg, redis, minio
make migrate-up                 # sekali
cd backend && set -a && . ./.env && set +a && go run ./cmd/seed   # sekali (make seed saja gagal: tidak memuat .env)
make dev-be                     # API :8081
make dev-worker                 # WAJIB: email (verifikasi/reset) dikirim worker, bukan API
cd frontend && pnpm dev --port 5180
```
E2E: `E2E_BASE_URL=http://localhost:5180 E2E_BE_LOG=<log-api>,<log-worker> pnpm e2e` (tautan email dibaca dari log worker, kode OTP dari log API; tanpa `E2E_BE_LOG` tes alur lengkap DILEWATI).

## UI v4 (ronde 3): lihat `10-UX-BACKLOG.md`
Tombol Kembali, auth terbelah (panel konser nyata + stepper + kekuatan sandi), denah profesional (teater/arena/festival) 2D + 3D, hold + checkout + voucher. Voucher demo & akun: `bimo@tixgo.local` / `Demo-Pass-123!`.

## UI v3 (2026-11-11, putaran kedua)
Filter diganti toolbar: pencarian + tab genre berikon + 5 kontrol (Kota, Kapan, Harga, Status, Urutkan; `<select>` native berkulit pil) + chip aktif yang bisa dihapus satu-satu; di ponsel kontrol ada di balik tombol "Filter". Semua di query-string (`src/utils/filters.ts`, nilai liar dibuang). Detail: tab section sticky (scrollspy), **denah kursi dari API** (`/seatmap` + `/availability`, zoom/pan) untuk acara bernomor, **peta zona** dari tier untuk acara berdiri (ilustrasi, dinyatakan di UI), kartu venue (kapasitas, zona waktu venue, rute), ikon konsisten (`src/utils/icons.ts`), footer jelajah per kota/genre dari katalog nyata. Total e2e 84/84.
Catatan BE: permintaan yang dibatalkan klien (AbortController) dicatat BE sebagai 500 "context canceled" (bising di log; sebaiknya dipetakan ke 499/diabaikan).

## Data demo & gambar (2026-11-11)
`backend/cmd/seed-demo` (jalankan setelah `cmd/seed`): 6 venue, 14 artis, 14 konser (status bervariasi: hampir habis, sold out, segera dibuka, wajib antre), gambar diunggah lewat `MediaService.Upload` (varian 400/800/1600, disajikan `/api/v1/media/:id/:w.jpg`). Foto = 16 foto CC0 Wikimedia Commons (`frontend/scripts/assets/fetch_concert_photos.py` -> `design-src/originals/concerts/` + `meta.json` berisi kredit penulis; berkas asli tidak di-commit). Perintah: `cd backend && set -a && . ./.env && set +a && go run ./cmd/seed-demo -photos ../frontend/design-src/originals/concerts`. Akun demo `rani@tixgo.local` / `Demo-Pass-123!` (email+HP terverifikasi).
**Kredit foto wajib ditampilkan** sebelum rilis publik (halaman Tentang/kredit) walau CC0 tidak mewajibkan.

## Referensi desain (dref, 2026-11-11)
DICE, Live Nation, Ticketmaster: foto sebagai pusat kartu, hero unggulan, bar cari + chip, rail horizontal, tipografi besar. Prinsip diambil; tanpa menyalin aset/teks/brand.

## Jebakan dev yang sudah ditemui
| Gejala | Penyebab | Solusi |
|---|---|---|
| semua `POST /auth/refresh` 403, sesi hilang saat reload | `csrfOK` BE menolak Origin yang tidak ada di `CORS_ORIGINS` (proxy Vite mengubah Host) | `backend/.env`: `CORS_ORIGINS=http://localhost:5174,http://localhost:5180,http://localhost:4173` lalu restart API |
| email verifikasi/reset tidak pernah muncul di log | notifikasi diantrekan asynq, hanya `cmd/worker` yang mengirim | jalankan `make dev-worker` |
| `GET /events` 500 `relation "events" does not exist` | migrasi belum dijalankan | `make migrate-up` lalu seed |
| daftar mengembalikan 429 saat e2e diulang | limiter registrasi 20/jam/IP (Redis `rate:rl:reg:*`) | tunggu, atau `redis-cli del 'rate:rl:reg:::1' 'rate:rl:register:ip:::1'` (hanya dev) |
| tes e2e timeout di register/login | hash kata sandi mahal, 2–8 dtk saat mesin sibuk | batas tunggu e2e sudah 15 dtk (`playwright.config.ts`) |
| template `@click="a; b"` rusak setelah prettier, `vue-tsc` tidak menangkap | prettier memecah dua pernyataan menjadi baris baru | pakai fungsi bernama; verifikasi dengan render nyata |
| gambar `loading=lazy` kosong di tangkapan layar full-page | belum di-scroll | uji dengan `scrollIntoView` per gambar (lihat `imagesLoaded` di catalog.spec) |
| placeholder "Please Input" muncul | default bahasa Inggris Naive UI | `placeholder=""` eksplisit (label sudah ada) |

## Ronde 14 (2026-11-12): fitur customer yang tersisa + tombol Kembali + sistem tombol
| Fitur | Rute / tempat | Catatan |
|---|---|---|
| Tombol Kembali di semua halaman | artis, venue, kalender, koleksi, organizer, squad, jual-beli, pengaduan | `BackLink.vue`; tes `back-buttons.spec.ts` menjaga "tepat satu per halaman" |
| Sistem tombol `a-pill` | `styles/app.css` | solid (utama) / garis (sekunder) / `--ghost` / `--sm`; fokus, tekan, nonaktif, `aria-busy`; referensi Luma + DICE |
| Waitlist saya | `/waitlist` | tawaran 10 menit + hitung mundur, keluar antrean |
| Ulasan | section `#ulasan` di event; form di detail tiket terpakai | rata-rata hanya bila BE kirim (>=5 ulasan); laporkan butuh login |
| Jual-beli ulang | section di event; `/jual-beli` | beli -> `/pesanan/:id/bayar`; rekening pencairan diisi di `/jual-beli` |
| Squad | tombol di panel tiket; `/squad/:code`, `/squads/:id`, `/squad-saya` | gabung = aksi eksplisit; konfirmasi usia saat bayar; BE menambah `event_title/event_slug` di SquadView |
| Pra-jual & fans | `PresaleBox` di panel tiket | status "terdaftar fans" disimpan per akun di peramban (tak ada endpoint baca) |
| Notifikasi perangkat (Web Push) | kartu di `/notifikasi`, `public/sw.js` | butuh VAPID di BE; tanpa kunci kartu menjelaskan "belum tersedia" |
| Verifikasi berlapis (OTP email/SMS + TOTP + kode pemulihan) | kartu di `/keamanan`; kotak kode di login, reset sandi, ganti sandi/email, hapus akun | faktor kedua = sifat akun (berlaku di semua perangkat); reset sandi butuh kode, bukan hanya tautan; layar Ganti kata sandi baru |
| Pengaduan privasi + riwayat versi legal | `/pengaduan-privasi`; `/legal/:kind` | pengaduan terbuka untuk tamu; draf yang belum terbit tidak ditampilkan |

Jebakan: teks i18n berisi `@` memicu sintaks linked-message vue-i18n dan merusak render (tulis `{'@'}`); klik Playwright pada elemen di bawah header menempel butuh `scroll-margin-top`.

## Belum / keputusan tertunda
- Teks persetujuan di daftar belum bertaut ke halaman Syarat & Privasi (halaman legal = F7; sengaja tanpa tautan mati).
- Pemilih kota di header menunggu data venue (F2).
- OTP SMS: dev hanya tercatat di log API; penyedia SMS belum dipilih.

## Gate kualitas (per halaman)
state loading/kosong/error/sukses · fokus terlihat · kontras ≥ 4,5:1 · target sentuh ≥ 44 px (≥ 24 minimum) · tanpa emoji (ikon `@vicons/tabler`) · harga/total dari server · tidak ada secret/PII di log · tidak ada tombol tanpa aksi (tes e2e menelusuri semua `button/a`).

## Risiko / butuh keputusan pengguna
- Midtrans sandbox nyata belum diuji (butuh kunci); dev memakai gateway palsu.
- Penyedia SMS/WhatsApp untuk OTP HP belum dipilih (dev: kode OTP tampil di log BE).
- Login sosial, peta lokasi (penyedia tile/geocoder), tinjauan hukum/pajak: menunggu.
- Pemisahan `backend/` dan `frontend/` = dua repo; kontrak hanya `openapi.yaml` (jalankan `pnpm api:gen` setelah BE berubah).

## Sumber
`../../docs/06,07,16,22`, `../../docs/references/API-ROUTES.md`, struktur `frontend/src` (2026-11-11), `package.json` (dependensi sudah ada: naive-ui, pinia, vue-router, vue-i18n, axios, zod, @panzoom/panzoom, qrcode, @unhead/vue, echarts, @vueuse/core).
