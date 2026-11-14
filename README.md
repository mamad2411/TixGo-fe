# TixGo — Frontend

Vue 3 + TypeScript + Vite + Naive UI. Repo ini TERPISAH dari `../backend`; kontrak hanya `../backend/api/openapi.yaml`.
Dokumen: `../docs/` (mulai `00-INDEX.md`; identitas UI: `16-UI-IDENTITY.md`). Status: **setup saja** (docs/18) — belum ada fitur.

## Versi (terverifikasi 2026-10-04)

Node 26.8.1 · pnpm 12.3.4 · vite 8.3 · vue 3.5 · naive-ui 2.45 · pinia 4 · vue-router 5 · vue-i18n 11 · vitest 5 · openapi-typescript 7.13
Font: Anton (display), Inter Variable (body), Space Mono (data) — semua OFL-1.1.
Ditambahkan per modul (bukan setup): echarts, qrcode, html5-qrcode, vite-plugin-pwa, exceljs, jspdf.

## Jalankan

```
cp .env.example .env
pnpm install
pnpm dev          # http://localhost:5174 (strictPort; 5173 dipakai proyek lain)
```

Proxy dev: `/api` dan `/ws` -> `VITE_DEV_PROXY_TARGET` (default `http://localhost:8081`).
Halaman tinjau tema (dev-only, tidak ada di build produksi): `/_kit`.

## Cek

`pnpm build` (vue-tsc + vite) · `pnpm test` · `pnpm api:gen` (tipe dari OpenAPI)
Kontras palet: `python3 ../docs/references/contrast.py`
