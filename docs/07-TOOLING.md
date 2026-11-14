# 07 — Tooling Frontend

Rincian lengkap & bukti: `../../docs/21-TOOLING.md`.

| Kebutuhan | Perintah | Catatan |
|---|---|---|
| Cek penuh | `pnpm check` | typecheck + lint + format + unit |
| Lint / format | `pnpm lint` · `pnpm format` | ESLint 10 flat config, Prettier (md tidak diformat) |
| Unit + cakupan | `pnpm test` · `pnpm test:cov` | vitest, `tests/` |
| E2E + aksesibilitas | `pnpm e2e` | Playwright; sekali: `pnpm e2e:install`; axe WCAG 2.2 AA |
| Kontrak | `pnpm api:lint` · `pnpm api:gen` | redocly (config di `../backend/redocly.yaml`), openapi-typescript |
| Bundle | `pnpm analyze` | `dist/stats.html` |
| Performa/SEO | `pnpm perf:lighthouse` (butuh `pnpm preview` di :4173) atau `make perf-lh` | baseline: P98 / A100 / BP100 / SEO91 |
| Image | `make docker-build` | `deploy/Dockerfile` + nginx (header keamanan, gzip, cache) |
| Hooks | `make hooks` | `lefthook.yml` |

## Aturan
- **PWA mati** sampai M42; aktifkan sadar-sadar dengan `VITE_ENABLE_PWA=1` (service worker prematur bisa menyajikan halaman basi).
- Meta per halaman lewat `useHead` (`@unhead/vue`); default ada di `index.html`. Meta untuk crawler/pratinjau tautan disuntik server (Q11) dan harus **identik** dengan yang tampil.
- nginx: `add_header` di `location` menimpa header server → pakai `include security-headers.conf` di tiap location. Upstream di-resolve saat request.
- Paket baru: `pnpm view <paket>` (versi, lisensi), lalu tambahkan ke tabel 21 §3. Jangan baca `node_modules`.
- `pnpm audit --audit-level=high` harus bersih (advisory moderate dicatat di 21 §7).

## Sumber
`../../docs/21-TOOLING.md`, `package.json`, `vite.config.ts`, `playwright.config.ts`, `deploy/`.
