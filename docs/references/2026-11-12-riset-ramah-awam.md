# Riset UI ramah orang awam (2026-11-12)

Pemicu: pengguna minta UI "paling bagus, unik, ramah, mudah untuk orang awam", tombol kembali di semua halaman, dan fitur kebutuhan yang masih kurang.

## Referensi (dibaca dengan `dref`, tangkapan dibuka satu per satu)
| Situs | Yang dipelajari | Dipakai di TixGo |
|---|---|---|
| Luma (`lu.ma`) | Satu aksi utama per layar, judul besar berbahasa sehari-hari, banyak ruang kosong, poster sebagai objek dengan bayangan lembut. | Ringkasan akun: satu kartu "Konser berikutnya" dengan satu tombol utama. |
| Traveloka (`traveloka.com`) | Kupon pengguna baru tampil dengan kode + tombol salin; masuk lewat akun sosial; "Lanjutkan sebagai tamu"; ikon + label teks untuk setiap kategori. | Voucher disalin sekali ketuk; ubin aksi cepat berlabel jelas. |
| Partiful (`partiful.com`) | Satu ide per bagian, tulisan tebal pendek, langkah bernomor ("satu tautan, semua masuk"). | Daftar "Lengkapi akunmu" bernomor dengan bilah progres. |
| DICE, Eventbrite (riset 2026-11-11) | Kartu jelas, harga di depan, status satu badge. | Sudah diterapkan di katalog. |

## Prinsip (skill `designing-user-experience`, `design-anti-slop`)
1. **Rancang state, bukan layar:** kosong, memuat, galat, sebagian ada untuk tiap bagian.
2. **Satu langkah berikutnya:** pengguna baru selalu tahu "apa selanjutnya" (checklist, kartu konser berikutnya).
3. **Bahasa sehari-hari:** "Menunggu pembayaran, bayar sebelum 14.30" bukan "pending_payment".
4. **Tindakan penting terlihat besar:** buka tiket, bayar, tukar voucher. Jarang dipakai disembunyikan.
5. **Di pintu masuk:** QR besar layar penuh, layar tidak mati, petunjuk kecerahan.

## Kontrak desain (token tetap; tanpa warna baru)
- Kartu bersudut 18-20 px, panel di atas bg, garis tipis; aksen emas hanya untuk aksi utama dan progres.
- Teks dasar >= 15 px, target sentuh >= 44 px, kontras mengikuti token (>= 4.5:1).
- Gerak: bilah progres dan hitung mundur saja; hormati `prefers-reduced-motion`.

## Sumber
`~/.agents/refs/{lu.ma,traveloka.com,partiful.com,ra.co}`, skill `designing-user-experience`, `docs/10-UX-BACKLOG.md`, `docs/12-AKUN-GAP-AUDIT.md`.
