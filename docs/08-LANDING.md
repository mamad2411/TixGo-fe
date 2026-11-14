# 08 — Landing Page (sinematik, ala Aerive, tema konser)

Desain/riset: `../../docs/23-REFERENSI-ANIMASI-LANDING.md`; aset: `../../docs/25-PIPELINE-ASET-VEKTOR.md`. Dokumen ini = cara kerja di kode + jebakan nyata. Dibuat 2026-11-10.

## Berkas
| Berkas | Peran |
|---|---|
| `src/pages/LandingPage.vue` | rute `/` (tanpa `PublicLayout`); memilih mode, memuat motion, delegasi klik anchor |
| `src/components/landing/Landing{Nav,Hero,Flagship,Specs,Details,Cities,Cta,Footer}.vue` | bagian halaman; atribut `data-m="…"` = pegangan GSAP, `data-reveal` = reveal HP |
| `src/components/landing/landing.css` | semua gaya (`.l-*`), token `--l-*`; layout **statis lengkap**, mode sinematik = `.is-cinematic` |
| `src/composables/useLandingMotion.ts` | `buildCinematic` (pin+scrub+Lenis), `buildLight` (reveal HP), deteksi mode |
| `src/assets/photos/*.webp` | 6 foto CC0 bergrading (`fetch_photos.py` → `grade_photos.py`), kredit di `CREDITS.md` |
| `src/assets/illustrations/landing/*.svg` + `components/landing/TicketArt.vue` | objek grafis buatan sendiri (bingkai portal, kabut, karcis, denah), dibangkitkan `gen_landing.py` |
| `src/i18n/{id,en}.json` → `landing.*` | seluruh teks (id lengkap, en lengkap) |
| `tests/landing.spec.ts`, `e2e/landing.spec.ts` | unit (landmark, alt, akordeon) + e2e (axe, overflow, reduced-motion, pin) |

## Tiga mode (diputuskan SEBELUM render pertama)
| Mode | Kondisi | Perilaku |
|---|---|---|
| sinematik | lebar ≥ 768 px **dan** tanpa `prefers-reduced-motion` | hero ter-pin 3800 px + scrub, Lenis, animasi tiap bagian |
| ringan | HP, gerak diizinkan | tata letak statis + reveal sekali saat masuk viewport |
| statis | `prefers-reduced-motion: reduce` | tidak mengimpor GSAP/Lenis sama sekali |
GSAP, ScrollTrigger, Lenis dimuat **dinamis** (chunk terpisah ±50 KB gzip) setelah halaman terbaca. Bila impor gagal: `console.error` + kembali ke statis (tidak diam-diam).

## Cara hero bekerja
1. Adegan layar penuh (`data-m=scene`) dibungkus `data-m=clip` (klip **tidak boleh** di elemen yang di-scale, karena klip ikut ter-scale).
2. `proxy.s` (1 → `sEnd`) menggerakkan dua hal sekaligus: `scale` bingkai dan `clip-path: inset(… round r r 0 0)` adegan, dihitung dari geometri bukaan bingkai (`OPEN` di composable = fraksi bukaan pada viewBox 600×900). Hasilnya: tepi klip selalu menempel pada tepi dalam bingkai saat zoom-through.
3. Urutan timeline (unit ≈ 11,2 → 3800 px): judul keluar → bingkai membesar/pudar → wordmark → manifesto per kata → lockup + 4 kolom → kabut naik → lapisan krem.
4. Nav memakai `data-tone="dark|light"` agar terbaca di atas krem.

## Parallax kedalaman (v3)
Hero = **dua lapisan** (`plate-bg` panggung bersih, `plate-fg` siluet penonton ber-alpha) + `glow`; `docs/25 §11` menjelaskan pembuatannya di PhotoCraft. Scroll: siluet 1.7→1.0 (menerjang kamera) lalu hanyut, latar 1.14→1.0; pointer: `gsap.quickTo` siluet ±54 px, latar ∓16 px (hanya `pointer: fine`). Detail: tiap butir = latar + siluet, hanyut mengikuti `--p`.

## Gerak (v2)
hero: huruf judul tersebar (SplitText), kamera mendorong (skala+miring), debu paralaks, zoom-through portal, wordmark, manifesto per kata, kolom, kabut → krem · flagship: huruf naik dari topeng + karcis 3D melayang · spesifikasi: denah tersapu · **detail: ter-pin 2600 px, scroll memajukan akordeon dan foto (event `landing-step`)** · kota: kata besar, foto bola disko paralaks, nama kota bergantian, karcis geser · CTA: baris naik dari topeng · progress bar + grain film. Lenis `lerp 0.085`, hero `scrub 1.2`, `end +=4200`.

## Jebakan yang sudah ditemui (jangan diulang)
| Gejala | Penyebab | Solusi |
|---|---|---|
| judul hero tidak tampil | GSAP membaca nilai awal dari animasi CSS intro yang sedang berjalan (opacity 0,001) dan menguncinya inline | pakai `fromTo` dengan nilai awal eksplisit; animasi CSS pakai `backwards` (bukan `both`) |
| gambar kabut tampil di mode statis | `.landing img {display:block}` (0,1,1) mengalahkan `.l-hero__haze {display:none}` | reset memakai `:where(.landing img)`; aturan sembunyi diberi prefiks `.landing` |
| teks tombol emas pucat (kontras 1,5:1) | `.landing a {color:inherit}` mengalahkan `.l-pill--solid` | `:where(.landing a)` (spesifisitas 0) |
| ruang kosong besar di sekitar denah/bola disko (HP) | atribut `height` gambar tetap walau `width` diubah CSS | `height:auto` pada gambar berukuran CSS |
| spasi antar kata manifesto hilang | `<span>` inline-block tanpa spasi teks | `margin-right` pada `.w` di semua mode |
| axe gagal acak | axe membaca opasitas saat animasi intro berjalan | tes menunggu `document.getAnimations()` selesai |
| `clip-path` ikut membesar | klip di elemen yang punya `transform: scale` | pembungkus `data-m=clip` terpisah dari `<img>` yang di-scale |
| axe `aria-prohibited-attr` pada `<p>`/`<span>` | SplitText menambah `aria-label` otomatis | `aria:'none'` untuk elemen tanpa role; nama aksesibel di `<h2 aria-label>` |
| tes e2e menggantung | `document.getAnimations()` memuat animasi grain `infinite` yang tak pernah `finished` | filter `iterations !== Infinity` |
| foto akordeon tidak tampil | `figure` hanya berisi `<img>` absolut → lebar grid 0 | `width:100%; max-width` eksplisit |
| baji abu bertepi tajam | "berkas cahaya" poligon di atas foto terlihat palsu | dibuang |
| e2e menguji aplikasi lain | port dev 5174 dipakai proyek lain (React) | `E2E_BASE_URL=http://localhost:4173 pnpm e2e` setelah `pnpm build && pnpm preview` |

## Perintah
```
pnpm dev                                   # :5174 (strictPort; bila dipakai proyek lain → gagal keras)
pnpm build && pnpm preview &               # :4173 — uji build produksi
E2E_BASE_URL=http://localhost:4173 pnpm e2e
dcheck http://localhost:4173/              # gerbang desain (overflow, kontras, alt, LCP, CLS, …)
python3 scripts/assets/gen_landing.py      # bangkitkan ulang aset (ubah skrip, bukan SVG)
```

## Hasil verifikasi (2026-11-10, build produksi lokal, lab)
(v2) `pnpm check` exit 0 · e2e 18 lulus, 3 run berturut-turut · foto 120–165 KB (hanya hero eager) · LCP 340 ms · v1: `pnpm check` exit 0 (typecheck, eslint, prettier, 5 tes unit) · e2e 18 lulus, 4 run berturut-turut stabil · `dcheck` LULUS: overflow OK di 4 lebar, 0 kontras gagal, 0 gambar tanpa alt, LCP 276 ms, CLS 0 (2 peringatan: 10 ukuran tipe > batas 8, 62 % spasi kelipatan 4 px) · axe 0 pelanggaran · JS awal rute `/` ≈ 122 KB gzip (gate ≤ 150) + chunk gerak ≈ 51 KB gzip.

## v4 (2026-11-10/11) — berbasis pengukuran
- Aerive diukur per 100 px scroll: `../../docs/references/aerive-trace.md` (angka) + `aerive-trace-raw.json`. Zoom jendela = power2.in dari ≈300 px s/d ≈1400 px, latar zoom linear 1→1,15, tanpa miring; sudah dipasang di `useLandingMotion.ts` (hero tetap `+=4200`, 1 unit ≈ 328 px).
- Teks terpotong: topeng SplitText diperluas `padding-block/margin-block ±0,2em` di helper `split()`; sebaran huruf judul dipersempit (±6–36 px) agar tidak keluar layar. Detektor: scroll tiap 300 px, bandingkan kotak glyph vs ancestor ber-overflow → 0 temuan di 1440, 1 sisa di 1024 (huruf "M" saat tersebar, sementara).
- Parallax: bg & fg kini bergeser lateral berlawanan arah (−2,5 % / +2 %) selain zoom/gerak vertikal. Masih 2 lapis foto; lapis ketiga/keempat BELUM ada.
- Aset: foto hero 3200 px q84 (+ varian 1600 px untuk `srcset`), foto lain 2400 px q80, vignette proporsional, WebP method 6. Hero bg 601 KB + fg 196 KB (varian kecil 126+37 KB).
- Verifikasi: `pnpm typecheck`, `lint`, `build` exit 0; `pnpm test` 5 lulus; e2e 18 lulus (percobaan pertama 3 timeout saat mesin sibuk, ulang bersih).
- Batas jujur: sumber `front-row` memang foto bokeh/tidak fokus, jadi resolusi lebih tinggi tidak membuatnya tajam; tepi siluet depan (hasil PhotoCraft) bergerigi di sekitar y≈590 px layar. Perlu foto sumber yang tajam atau potongan ulang.

### v4.1 (2026-11-11)
- **Intro otomatis** (`useLandingMotion.ts`, blok "INTRO"): saat load, adegan menyala dengan rack-focus (latar fokus dulu, siluet menyusul), huruf judul naik, nav muncul (~2,5 dtk); Lenis di-`stop()` sampai selesai (pengaman 4,5 dtk), lalu scroll aktif. `root.dataset.intro` = `run` → `done`; CSS menyembunyikan adegan sebelum JS menyala (tanpa kilatan). Dilewati bila halaman sudah ter-scroll (>40 px). Hanya memakai properti yang tidak disentuh timeline scrub (filter, yPercent, autoAlpha); skala siluet berakhir di 1,7 agar sambung ke scrub.
- `line-height` `.l-serif` 1,02 → 1,08; judul detail diberi `margin-bottom` pengganti margin negatif topeng.
- Bukti: e2e 18 lulus; frame intro 0,3/1,7/2,7/4,2 dtk diperiksa; wheel setelah intro menggerakkan scroll (600 px).

### v4.2 (2026-11-11) — nada nav adaptif + kinerja
- **Nada nav** (`sampleTone` di `useLandingMotion.ts`): geometri deterministik — blok krem memegang titik tengah nav (y=36) atau overlay krem hero >0,5 dan hero masih terlihat → `data-tone=light` (teks gelap); selain itu `dark`. Pemicu lama tidak pernah membalik nada di bagian kota/CTA/footer (kontras 1,04). Hit-test `elementsFromPoint` TIDAK dipakai: mengabaikan overlay `pointer-events:none`. `.l-nav::before` = gradasi pelindung selaras nada (teks tetap terbaca di atas judul raksasa/foto). Ukur: 138 posisi scroll × tiap teks nav → 18 titik <4,5:1 jadi 1 (momen tengah transisi).
- **Kinerja** (CPU throttle 4×, headless): p50 frame 50 ms → 16,7 ms; frame >50 ms 153 → ±50. Perubahan: blur filter dibuang dari tween scroll (manifesto, kolom, tanda), `letterSpacing` (memicu layout) → `scale`, grain: SVG feTurbulence pada lapisan 340 % layar → tile WebP 160 px (`photos/grain.webp`) pada lapisan +12 %, scrub hero 1,2 → 0,6, Lenis lerp 0,085 → 0,1, debu 22 → 12.
- Alat ukur ada di sesi (perf: rAF delta saat wheel; kontras nav: tangkapan layar per elemen); belum dijadikan skrip repo.

## Belum / keterbatasan
- Tautan **`/events`** (tombol "Lihat konser") belum punya halaman (katalog belum dibangun) → saat ini 404 di sisi router.
- Skala tipe dan grid spasi landing belum dirapikan ke token (peringatan `dcheck`).
- Perilaku di Safari/Firefox dan HP asli (scroll sentuh) **belum diuji**; hanya Chromium (Playwright) + emulasi.
- GSAP berlisensi "Standard no charge" (menurut npm) — konfirmasi hukum sebelum rilis. Font Cormorant Garamond dan Manrope (OFL via @fontsource).
- Ilustrasi tangan penonton masih berbentuk sederhana (batang + bulat); bisa dipoles.

## Sumber
`src/**` landing, `scripts/assets/gen_landing.py`, hasil `dcheck`/`dref`/Playwright 2026-11-10, `../../docs/23`, `../../docs/25`.
