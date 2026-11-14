# 03 — Tema KARCIS

Sumber desain: `../docs/16-UI-IDENTITY.md`. Dokumen ini = cara kerjanya di kode + jebakan nyata.

## File

| File                    | Peran                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/styles/tokens.css` | CSS variable (light + `:root[data-theme='dark']`), kelas `.t-display` / `.t-data`, bayangan keras tombol, border card |
| `src/theme.ts`          | `palette` + `themeOverrides` untuk `NConfigProvider`                                                                  |
| `src/main.ts`           | memuat font: Inter Variable, Anton, Space Mono 400/700                                                                |

## Token (final, lulus WCAG AA — `../docs/references/CONTRAST.md`)

`--kertas #F2EAD8` · `--kertas-2 #E8DEC6` · `--tinta #121110` · `--merah-karcis #E32620` (fill/tombol, teks putih 4.6:1) · `--merah-teks #BF1A15` (merah **sebagai teks**) · `--kuning-spidol #FFD23F` · `--biru-riso #2447F5` · `--hijau-stabilo #7BE495` · `--abu-fotokopi #5F5B52`.
Dark (“Malam Gig”): kertas `#1A1815`, kertas-2 `#26231F`, tinta `#F2EAD8`, abu `#A39D8F`, merah-teks `#EA5D59`.

## Mengubah warna

1. Ubah di `tokens.css` **dan** `theme.ts` (dua cermin).
2. Samakan nilai di `docs/references/contrast.py`, jalankan `python3 ../docs/references/contrast.py --write`.
3. Harus mencetak `GAGAL: tidak ada`. Perbarui `../docs/16-UI-IDENTITY.md` §3.

## Jebakan yang sudah ditemui (jangan ulangi)

| Gejala                                        | Penyebab                                                | Solusi                                                                              |
| --------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Tag warna aneh/transparan, teks tak terbaca   | Tag ber-border memakai `colorBordered*`, bukan `color*` | override `colorBordered`, `colorBorderedWarning/Info/Success` (sudah di `theme.ts`) |
| Border button terbaca `0px` di computed style | Naive UI menggambar border lewat elemen terpisah        | itu normal; verifikasi visual, bukan `getComputedStyle(root).border`                |
| Card border tetap 1px                         | selektor `.n-card` kalah spesifik                       | gunakan `.n-card.n-card--bordered` (sudah di `tokens.css`)                          |
| axe `aria-required-attr` pada `NCard` | `NCard title`/header memberi `role="heading"` tanpa `aria-level` | jangan pakai `title`/header Naive; letakkan `<h2>` sendiri di dalam kartu |
| axe `aria-progressbar-name` | `NProgress` tanpa nama aksesibel | beri `aria-label` |
| `vue-tsc` error TS5101 `baseUrl` deprecated   | TS 6                                                    | jangan pakai `baseUrl`; `paths` dengan awalan `./` (`"@/*": ["./src/*"]`)           |
| Merah `#E5322D` gagal AA                      | putih di atasnya 4.35; sebagai teks di kertas 3.63      | `--merah-karcis` untuk fill saja, `--merah-teks` untuk teks                         |
| Abu `#8B867B` gagal AA                        | 3.03 di kertas                                          | diganti `#5F5B52`                                                                   |

## Tinjau visual

`pnpm dev` → `http://localhost:5174/_kit` (tombol primer/sekunder/disabled, tag, input, select, progress, card nomor karcis).

## Sumber

`src/theme.ts`, `src/styles/tokens.css`, `../docs/references/CONTRAST.md`, pengalaman setup 2026-10-04.
