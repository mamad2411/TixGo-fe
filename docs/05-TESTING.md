# 05 — Testing Frontend

## Perintah

```
pnpm test        # vitest run (jsdom)
pnpm build       # vue-tsc -b && vite build  (tipe harus hijau)
make -C .. preflight
```

## Konfigurasi

`vite.config.ts` → `test: { environment: 'jsdom', include: ['tests/**/*.spec.ts'] }`; `tests/` ikut di `tsconfig.app.json`.

## Yang ada

| Tes                 | Cakupan                                                                         |
| ------------------- | ------------------------------------------------------------------------------- |
| `tests/app.spec.ts` | mount `App` dengan Pinia + router + i18n; beranda memuat "TixGo" dan "SETUP OK" |

## Aturan

- Komponen yang memakai Naive UI di-mount dengan provider yang diperlukan (lihat `App.vue`).
- Uji perilaku (store, composable `useQueue`/`useHold`/`useWs`, komponen SeatMap), bukan snapshot besar.
- Jangan memanggil backend sungguhan di unit test; mock `http` (axios).
- E2E belum dipilih (`../docs/18-SETUP-GUIDE.md` S3); alur beli sandbox masuk fase F3.
- Verifikasi visual tema: `/_kit` + `../docs/references/contrast.py`.

## Sumber

`tests/`, `vite.config.ts`, `../docs/13-CONFIG-DEPLOY-TESTING.md` §4.
