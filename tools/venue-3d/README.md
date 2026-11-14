# tools/venue-3d — aset 3D venue (Blender headless) + MCP `tixgo-venue`

Sumber kebenaran aset 3D denah (panggung, truss, LED wall, line array, moving head, kursi, barikade, menara, FOH, tenda bar/P3K/merch, toilet, gerbang, figur penonton). Dibangun **dari kode** (`build_assets.py`, bpy) agar bisa direproduksi, lalu diekspor GLB ke `public/models/` dan dimuat three.js (`src/components/venue/kit3d.ts` -> `Venue3D.vue`).

## Perintah
```
# bangun ulang semua aset (+ render pratinjau EEVEE ke design-src/renders/showcase.png)
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P tools/venue-3d/build_assets.py -- --render design-src/renders
# sebagian saja
... -P tools/venue-3d/build_assets.py -- --only stage,seat_lo
```
Konvensi: satuan = satuan peta FE; panggung menghadap -Y Blender (= +Z glTF, ke penonton); kursi menghadap +Y Blender (= -Z glTF, ke panggung); aset berpusat di (0,0) dan berdiri di z=0. `seat_lo`/`person` low-poly untuk instancing (1.500 kursi); `seat` detail dipakai untuk kursi terpilih.

## MCP `tixgo-venue` (buatan sendiri, stdio)
Alat: `venue_list_assets`, `venue_inspect_glb` (segitiga/material/ukuran, tanpa Blender), `venue_build_assets`, `venue_render_preview`.
```
claude mcp add tixgo-venue -- uv run --with 'mcp<2' python $(pwd)/tools/venue-3d/mcp_server.py
uv run --with 'mcp<2' python tools/venue-3d/mcp_selftest.py   # uji dengan klien MCP sungguhan
```
Pin `mcp<2`: SDK 2.x mengganti `FastMCP` menjadi `MCPServer`. Env `BLENDER` menimpa lokasi Blender. Nyalakan hanya saat dipakai (aturan maks 2 MCP aktif).

## Skill/riset yang dipakai
`blender-procedural-workflow` (kontrak generator, instancing, validasi), `blender-scripting`; referensi Dribbble "seat map"/"concert login", SeatGeek, DICE (`dref`). Tidak ada GLB hasil unduhan pihak ketiga: semua dimodelkan di sini (tanpa isu lisensi).
