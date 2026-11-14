# `src/assets/illustrations/`

Aset vektor buatan sendiri (gaya KARCIS). Pipeline, aturan gaya, dan daftar aset: `../../../../docs/25-PIPELINE-ASET-VEKTOR.md`.
Dibangkitkan oleh `../../../scripts/assets/gen_pilot.py` (deterministik) — **ubah skripnya, bukan SVG-nya**.

| Berkas | Pembuat | Tanggal | Alat | Lisensi | Ukuran (gzip) |
|---|---|---|---|---|---|
| `scene/scene-panggung-malam.svg` | skrip kode (Claude) | 2026-11-10 | Python → SVG | milik TixGo | 11,8 KB (2,6 KB) |
| `object/object-karcis-lunas.svg` | skrip kode (Claude) | 2026-11-10 | Python → SVG | milik TixGo | 4,8 KB (1,0 KB) |
| `object/object-cap-hadir.svg` | skrip kode (Claude) | 2026-11-10 | Python → SVG | milik TixGo | 0,9 KB (0,5 KB) |

Pakai **inline** (komponen/`?raw`) agar warna mengikuti token (`var(--merah-karcis)`); lewat `<img>` warna jatuh ke nilai fallback.
Bukti visual: `../../../../docs/references/assets-pilot-proof.png`. Status svgo: belum dijalankan.

## `landing/` (sinematik, hanya untuk `/`)
Dibangkitkan `../../../scripts/assets/gen_landing.py`. Pengecualian terdokumentasi: boleh gradien/blur (lapis sinematik), app lain tetap datar.
| Berkas | Dipakai | Ukuran (gzip) |
|---|---|---|
| `landing-stage-scene.svg` | hero (adegan layar penuh + jendela portal statis) | 19,5 KB (3,9 KB) |
| `landing-portal-frame.svg` | bingkai arch emas + tirai merah | 3,1 KB (0,9 KB) |
| `landing-haze.svg` | kabut transisi ke krem | 2,5 KB (0,8 KB) |
| `landing-ticket-hero.svg` | karcis hitam-emas (disisipkan **inline** agar memakai font halaman) | 3,7 KB (1,1 KB) |
| `landing-venue-plan.svg` | denah arena (bagian spesifikasi) | 5,5 KB (1,8 KB) |
| `landing-crowd-phones.svg` | foto bagian detail | 10,7 KB (2,4 KB) |
| `landing-disco-ball.svg` | bola disko bagian Kota | 20,4 KB (3,5 KB) |
Pembuat: skrip kode (Claude), 2026-11-10; lisensi: milik TixGo; tanpa aset pihak lain. svgo belum dijalankan.
