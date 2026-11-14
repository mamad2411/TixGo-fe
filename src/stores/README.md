# `src/stores/`

Store Pinia: `auth`, `pending`, `favorites`.

- `auth` — sesi pelanggan. Access token hanya di memori; pemulihan lewat cookie refresh (`restore()`),
  dijaga `sessionLost` bila sesi putus di tengah jalan. Jembatan interceptor dipasang di sini (`bindAuth`).
- `pending` — pesanan menunggu bayar untuk penanda di header. Satu permintaan dipakai bersama
  (single-flight + segar 15 dtk); halaman pesanan menyerahkan daftarnya lewat `set()`.
- `favorites` — daftar favorit untuk tombol hati di kartu & detail.

- **Dokumen**: `../../docs/09-CUSTOMER-APP.md`, `../../docs/06-FRD.md`
