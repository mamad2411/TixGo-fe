# 06 — Runbook Lokal

## Prasyarat (terdeteksi 2026-10-04)

Node 26.8.1 · pnpm 12.3.4

## Mulai

```
cp .env.example .env
pnpm install
pnpm dev                     # http://localhost:5174  (halaman tema: /_kit)
pnpm build && pnpm preview
pnpm api:gen                 # tipe dari ../backend/api/openapi.yaml
```

Backend perlu hidup di `:8081` bila memanggil `/api` (`make -C .. dev-be`).

## Troubleshooting

| Gejala                         | Tindakan                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `Port 5174 is already in use`  | `strictPort` aktif; hentikan proses lain atau ubah port **sadar** (dan `CORS_ORIGINS` backend) |
| `/api` 502/ECONNREFUSED        | backend belum jalan atau `VITE_DEV_PROXY_TARGET` salah                                         |
| Respons API bukan `{"data":…}` | proxy menuju proses lain (mis. voralens di :8080) — cek target                                 |
| `pnpm api:gen` gagal           | `openapi.yaml` backend tidak valid; perbaiki di repo backend                                   |
| Build gagal TS5101/TS5090      | lihat `docs/03-THEME-KARCIS.md` jebakan tsconfig                                               |
| `.env` terlacak git            | seharusnya di-ignore; hanya `.env.example` yang di-commit                                      |

## Sumber

`package.json`, `vite.config.ts`, pengalaman setup 2026-10-04.
