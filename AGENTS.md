# AGENTS.md — TixGo Frontend

Vue 3 + TypeScript + Vite + Naive UI + Pinia. Repo **terpisah** dari `../backend`; kontrak hanya `../backend/api/openapi.yaml`.

## Baca dulu

1. `docs/00-INDEX.md` (dokumen repo ini) dan `docs/03-THEME-KARCIS.md`
2. `../docs/16-UI-IDENTITY.md` (identitas) + `../docs/07-DESIGN-UI.md` (wireframe) + `../docs/06-FRD.md` (AC)
3. `../docs/14-AGENT-PLAYBOOK.md`

## Aturan inti

- Tipe API dari `pnpm api:gen`; harga/total dari server.
- Warna hanya dari token; ubah warna → `contrast.py` harus lulus.
- Teks via i18n; tanpa emoji; ikon `@vicons/tabler`; `v-html` hanya dengan DOMPurify.
- Wajib state loading/kosong/error; hormati `prefers-reduced-motion`.
- Access token di memori, bukan localStorage.
- Selesai = `pnpm check` + `pnpm e2e` hijau + AC FRD + checklist anti-slop (16 §11). Tools: `docs/07-TOOLING.md`.

## Skill (`.claude/skills` → `../skills`)

tixgo-vue-page · tixgo-karcis-ui · tixgo-realtime · tixgo-ticket-gate · tixgo-testing · tixgo-seo-content · tixgo-privacy-legal · tixgo-qa-check
