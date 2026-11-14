# 12 — Spesifikasi FE Pelanggan Lengkap (form, tombol, aksi, state)

Menutup 65 celah audit (endpoint terpakai 28 dari 170). Tiap halaman: rute, data, field, tombol, aksi, state, validasi, a11y, tes.
Konvensi di semua halaman: 4 state wajib (loading skeleton, kosong, galat + "Coba lagi", sukses), token `--a-*`, i18n id/en, ikon `@vicons/tabler`, tanpa emoji, target sentuh ≥44px, fokus terlihat, `aria-live` untuk status.
Mutasi POST order/bayar/refund wajib `Idempotency-Key` (UUID dibuat saat form dibuka, dipakai ulang saat ulang kirim).

Fase = urutan kerja. Tiap fase selesai bila: `pnpm check` hijau, dcheck lulus, e2e fase itu hijau, screenshot diperiksa.

## FASE A — Alur beli ujung ke ujung (BLOCKER, #1–8, 57–59)

**Status 2026-11-11:** A1 (form pemegang tiket, persetujuan, umur, POST /orders, tangani `CONSENT_REQUIRED` via POST /me/consents) + A2/A3 (halaman `/pesanan/:id[/bayar]`: bayar via Snap `redirect_url`, polling status, batalkan, sukses) SELESAI, e2e `order-flow.spec.ts`. Catatan: metode bayar dipilih di halaman Snap (bukan radio di FE; `PayResult` hanya memberi `snap_token`/`redirect_url`). Belum: stepper jumlah, add-on, ubah kursi (A1), waiting room (A4), squad (A5). Menjalankan e2e: `E2E_BASE_URL=http://localhost:5180 pnpm exec playwright test --workers=1` (dua proyek berbagi akun demo, jangan paralel).

### A1. Checkout `/checkout/:slug` (sudah ada, dilengkapi)
| Blok | Isi |
|---|---|
| Ringkasan hold | daftar kursi/tier, harga satuan, countdown (`expires_in`), tombol **Perpanjang** (jika `can_extend`, POST extend), tombol **Lepas** per baris (kursi) dan **Lepas semua** |
| Ubah jumlah | stepper − / + per tier GA (min 1, maks batas tier dari server); kursi bernomor: ikon hapus per kursi |
| Data pemegang tiket | satu kartu per tiket: **Nama lengkap** (wajib, 2–60), **Email** (wajib, format email, untuk pengiriman tiket); tombol **Salin dari pemesan** (isi semua dari akun), **Sama dengan tiket 1**; kursi ditampilkan di judul kartu. Dikirim sebagai `attendees[{name,email,seat_id}]` |
| Add-on | kartu add-on (`addons`) dengan stepper qty, subtotal live dari quote |
| Verifikasi umur | checkbox "Saya berusia ≥ N tahun" muncul bila event memerlukannya -> `age_confirmed` |
| Voucher | input kode + **Pakai**; chip kode aktif + **Hapus**; pesan galat spesifik (kedaluwarsa/habis/tidak berlaku) |
| Rincian harga | subtotal, add-on, diskon, biaya layanan, pajak, **Total** (semua dari quote server) |
| Persetujuan | checkbox wajib "Saya setuju S&K dan Kebijakan Refund" (tautan buka drawer berisi `/legal/terms` dan `/legal/refund`); tombol bayar disabled sampai tercentang + form valid |
| Aksi utama | **Lanjut ke pembayaran** -> POST `/orders` (Idempotency-Key) -> navigasi `/pesanan/:id/bayar` |
| Galat | 409 kursi diambil orang -> dialog "Kursi tidak lagi tersedia" + kembali ke denah; 422 -> galat per field; hold habis -> dialog + tombol "Pilih lagi" |
Validasi fokus: submit gagal -> fokus ke field pertama yang salah, ringkasan galat di atas form (`role=alert`).

### A2. Bayar `/pesanan/:id/bayar`
- Header: event, ringkasan, total, countdown `expires_at`.
- **Pilih metode** (kartu radio): QRIS, Virtual Account (BCA/BNI/BRI/Mandiri/Permata), E-wallet (GoPay/ShopeePay), Kartu. Ikon + estimasi biaya. Pilihan diingat (localStorage).
- Tombol **Bayar sekarang** -> POST `/orders/{id}/pay` -> buka Snap (`snap_token`, `client_key`) atau `redirect_url`; `reused=true` boleh melanjutkan percobaan sama.
- Setelah kembali: polling GET `/orders/{id}` tiap 3 dtk (maks 5 menit, backoff) -> status: menunggu / dibayar / gagal / kedaluwarsa. Teks `aria-live`.
- Tombol sekunder: **Batalkan pesanan** (konfirmasi -> POST cancel), **Ganti metode**.
- State: expired (CTA kembali ke event), gagal (tombol coba lagi), pending lama (instruksi VA + salin nomor + tombol "Cek status").

### A3. Sukses `/pesanan/:id`
Animasi tanda centang statis (tanpa gerak berlebih), nomor invoice, ringkasan, **Lihat tiket** (-> `/tiket`), **Unduh invoice** (`invoice.pdf`), **Tambah ke kalender**, **Bagikan** (Web Share), rencana Hari-H singkat. Bila status masih pending: tampilan menunggu + polling.

### A4. Waiting room `/antre/:slug` (#5–6, 59, 44)
- Masuk dari tombol beli bila `queue_required`. Kartu: posisi (angka besar), perkiraan tunggu, jumlah di belakang, progres, status koneksi.
- **Gabung antrean** (POST join) -> poll/WS status. Tombol **Keluar antrean** (DELETE, konfirmasi).
- Saat giliran: banner "Giliran kamu" + hitung mundur token admit -> **Masuk pilih tiket**.
- Panel **Bukti keadilan** (`queue/proof`, `/pixels`): hash komitmen, seed, tombol **Verifikasi**, salin.
- Edge: tab ditutup (peringatan `beforeunload`), koneksi putus (banner + reconnect), antrean ditutup/penuh.

### A5. Squad checkout (#45) `/squad/:id`
Buat squad (nama, jumlah anggota 2–N), tautan undangan + **Salin**/**Bagikan**, daftar anggota + status bayar masing-masing, tombol **Bayar bagianku**, **Perpanjang waktu**, **Bubarkan** (pemilik), gabung via `/squad/gabung/:kode`.

## FASE B — Pasca-beli (#9–17)
| Rute | Isi dan aksi |
|---|---|
| `/tiket` | tab Mendatang / Lampau / Dijual; kartu tiket; filter event |
| `/tiket/:id` | QR dinamis (refresh otomatis, hitung mundur, tombol kecerahan penuh, **Simpan ke Wallet**), seat, pintu, rencana Hari-H (`/plan`); aksi: **Transfer**, **Jual lagi**, **Ulas** (setelah acara) |
| Transfer | dialog: email/HP penerima, pesan, konfirmasi; status menunggu klaim + **Batalkan transfer**; penerima: `/klaim/:token` (lihat, **Terima**) |
| Resale | form harga (batas atas server), biaya & pendapatan bersih live, **Pasang**/**Tarik**; halaman `/event/:slug/resale` daftar + **Beli**; `/akun/penjualan` listing + payout |
| `/pesanan` | daftar order, filter status, cari invoice; baris -> detail |
| `/pesanan/:id` | detail + **Invoice PDF**, **Batalkan** (bila boleh), **Ajukan refund** |
| Refund | cek kelayakan (alasan, nominal, tenggat), pilih alasan (radio) + catatan, rekening tujuan (bank, no, nama; **Simpan**), lacak status (stepper), `PUT /refunds/{id}/account` |
| Ulasan | bintang 1–5 (keyboard), judul, isi (maks 1000), foto opsional; di detail event: ringkasan rating, daftar, **Laporkan** (alasan) |

## FASE C — Akun `/akun/*` (#18–28, 64)
Layout dua kolom (menu kiri; di ponsel daftar bergulir). Menu header diperluas: Tiket, Pesanan, Favorit, Notifikasi, Akun, Keluar.
| Sub-rute | Field dan tombol |
|---|---|
| `profil` | foto (unggah, potong, **Hapus**), nama, kota (select), tanggal lahir; **Simpan** (disabled bila tidak berubah), **Batal** |
| `keamanan` | ganti sandi (lama, baru + meter kekuatan, ulang), ganti email (email baru -> kode), 2FA TOTP (QR + kode 6 digit + 10 kode pemulihan: **Salin**/**Unduh**/**Buat ulang**), perangkat (tabel + **Keluarkan**, **Keluar semua**) |
| `favorit` | kisi event favorit, tombol hati untuk cabut; kosong -> CTA jelajah |
| `ikuti` | artis/venue diikuti + **Berhenti mengikuti** |
| `notifikasi` | inbox (tandai dibaca, hapus), preferensi (matriks kanal x jenis: email, push, WA), **Aktifkan push** (izin browser) |
| `privasi` | ekspor data (**Minta ekspor**, daftar + unduh), riwayat permintaan, **Hapus akun** (ketik "HAPUS", sandi), persetujuan (toggle), pengaduan (form) |
| `passport` | stempel konser, aktifkan/nonaktif, tebus kode |
| `daftar-tunggu` | daftar + **Keluar** |
Bell notifikasi di header: badge hitung, popover 5 terbaru, "Lihat semua".

## FASE D — Kepercayaan, legal, bantuan (#29–33)
- Footer diperluas: Syarat, Privasi, Refund, Kontak, Bantuan, Status.
- `/legal/:kind` (terms/privacy/refund): judul, versi + tanggal berlaku, daftar isi, pilih versi lama.
- Banner cookie: Terima semua / Tolak / Atur (toggle analitik, fungsional), `PUT /cookie-consent`.
- `/bantuan`: pencarian (debounce, sorot hasil), kategori, artikel `/bantuan/:slug` + "Apakah membantu?".
- `/bantuan/tiket` (support): daftar tiket, **Buat** (subjek, kategori, order terkait, pesan, lampiran), balas, **Tutup**.
- `/status`: status layanan + pengumuman (juga banner global bila ada).

## FASE E — Discovery (#34–42, 60–63)
Halaman `/artis`, `/artis/:slug`, `/venue`, `/venue/:id` (denah + konser mendatang), koleksi `/koleksi/:slug`, banner beranda, FilterBar dari `/meta/filters` + filter harga (rentang) dan tanggal (rentang), "Muat lagi" menggantikan pagination, rekomendasi "Untukmu", presale code (input di panel tiket), fan registration (form), galeri foto + unggah, ulasan di detail event, sisa tiket live per tier.

## FASE F — Inovatif (#43–48)
Latihan War Tiket (`/latihan/:slug`: simulasi antre + skor), Concierge AI (panel mengambang: input, saran pertanyaan, jawaban + sumber, **Salin**, umpan balik), preferensi event.

## FASE G — Teknis (#49–56, 65)
Halaman 404/500/maintenance/offline; WS `useWs` (kursi & sisa tiket live, fallback polling dengan banner); JSON-LD Event; `sitemap.xml`/`robots.txt`; PWA manifest + SW (cache shell, banner offline); kalender `.ics`; toast global jaringan.

## Pemeta endpoint -> fase
Order/pay/queue/squad = A; tickets/orders/refunds/transfer/resale/reviews = B; `/me/*` = C; legal/content/support/status = D; artists/venues/meta/recs/waitlist/presale/fan/photos = E; practice/concierge/preferences/passport = F; ws/calendar/widget = G.

## Tes (per fase)
Unit: validator form, util harga, state mesin polling. E2E Playwright (serial): A beli sampai tiket (gateway di-stub), antre, galat 409; B transfer/refund; C ubah profil/sandi; D cookie + legal. dcheck + axe pada tiap rute baru.

## Sumber
- `backend/api/openapi.yaml`: `CreateOrderReq` (l.328), `OrderView` (l.631), `PayResult` (l.836), `TicketView` (l.1552), `/orders` (l.8854), `/orders/{id}/pay` (l.9061).
- Audit celah FE (65 butir) dari pengguna, sesi 2026-11-11.
- `docs/06-FRD.md`, `docs/07-DESIGN-UI.md` untuk kriteria penerimaan; `docs/11-RONDE5-PLAN.md` untuk sisa ronde 5.
