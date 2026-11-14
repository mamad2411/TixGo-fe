# 04 — Environment Frontend

Hanya variabel `VITE_*` (tertanam di bundle → **publik**; tidak boleh ada secret).

| Variabel                   | Default `.env.example`   | Fungsi                                                                |
| -------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `VITE_API_BASE_URL`        | `/api/v1`                | baseURL axios (lewat proxy dev)                                       |
| `VITE_WS_URL`              | `ws://localhost:5174/ws` | endpoint WebSocket (lewat proxy dev)                                  |
| `VITE_MIDTRANS_CLIENT_KEY` | kosong                   | client key Snap (boleh publik)                                        |
| `VITE_MIDTRANS_ENV`        | `sandbox`                | sandbox/production                                                    |
| `VITE_DEFAULT_LOCALE`      | `id`                     | locale awal                                                           |
| `VITE_DEV_PROXY_TARGET`    | `http://localhost:8081`  | target proxy `/api` dan `/ws` (dibaca `vite.config.ts`, bukan bundle) |

## Port & proxy

`vite.config.ts`: `server.port = 5174`, `strictPort: true` (gagal keras bila terpakai, tidak lompat diam-diam). 5173 dipakai voralens-v2 di mesin yang sama.
Proxy: `/api` → backend; `/ws` → backend (websocket).

## Produksi

`VITE_API_BASE_URL` dan `VITE_WS_URL` diisi URL absolut; CORS di backend (`CORS_ORIGINS`) harus memuat origin FE.

## Sumber

`.env.example`, `vite.config.ts`, `../docs/13-CONFIG-DEPLOY-TESTING.md` §2.
