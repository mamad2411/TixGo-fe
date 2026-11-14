# 12 — Audit celah Akun Pelanggan (2026-11-11)

Pemicu: pengguna menilai area akun "belum lengkap": tak ada foto profil, tak ada redeem voucher, refund belum ada. Audit ini membandingkan **endpoint BE yang sudah ada** dengan **halaman FE yang ada** (4 halaman: Profil, Pesanan, Tiket, Favorit).

## Celah (BE sudah siap, FE belum)
| # | Fitur | Endpoint BE | FE | Sev |
|---|---|---|---|---|
| 1 | Foto profil (unggah, crop, hapus, inisial cadangan) | `POST /media` (kind avatar) → `SetAvatar`; `UserView.avatar_key` | tidak ada | P0 |
| 2 | Dompet voucher + redeem kode | `promo.go`, `POST /orders/quote`; presale `POST /events/{slug}/presale/redeem`; `passport/redeem` | hanya kolom kode di checkout | P0 |
| 3 | Refund: cek kelayakan, ajukan, status, rekening refund | `GET /orders/{id}/refund-eligibility`, `POST /orders/{id}/refunds`, `GET /refunds/{id}`, `PUT /refunds/{id}/account` | tidak ada | P0 |
| 4 | Batalkan pesanan, unduh invoice | `POST /orders/{id}/cancel`, `GET /orders/{id}/invoice.pdf` | tidak ada | P0 |
| 5 | Detail tiket: QR berputar, transfer, jual ulang, ulasan | `/tickets/{id}`, `/qr`, `/transfer`, `/resale`, `/review`, `/plan` | daftar saja | P0 |
| 6 | Notifikasi (kotak masuk) + preferensi | `/me/notifications`, `/me/notification-prefs`, `/me/push/*` | tidak ada | P1 |
| 7 | Keamanan: MFA TOTP, perangkat login, keluar semua | `/me/mfa/totp/*`, `/me/devices`, `/auth/logout-all` | hanya ganti sandi | P1 |
| 8 | Ganti email, HP | `/me/email`, `/auth/email/change/confirm`, OTP | tidak ada | P1 |
| 9 | Privasi: persetujuan, ekspor data, hapus akun | `/me/consents`, `/me/privacy/*` | tidak ada | P1 |
| 10 | Bantuan: tiket dukungan, pencarian bantuan | `/support/tickets*`, `/content/help/search` | tidak ada | P1 |
| 11 | Ikuti artis/venue, rekomendasi, kalender saya | `/me/follows`, `/me/recommendations`, `/me/calendar.ics` | favorit saja | P2 |
| 12 | Squad (bagi bayar), jual ulang saya | `/me/squads`, `/me/resale/*` | tidak ada | P2 |

## Pola riset (sumber di bawah)
- Refund: tunjukkan kelayakan + potongan **sebelum** user mengajukan; sediakan status "Menunggu tinjauan → Diproses → Selesai"; order punya keadaan "Pembatalan diminta" agar tidak ambigu; opsi refund ke dompet vs rekening; refund cepat mencegah chargeback.
- Avatar: pratinjau instan, crop persegi, satu gambar dipakai konsisten di seluruh app, cadangan inisial.
- Akun: struktur navigasi dikenal (sidebar/tab: Ringkasan, Tiket, Pesanan, Voucher, Notifikasi, Profil, Keamanan, Privasi, Bantuan); DICE/Ticketmaster menaruh tiket sebagai halaman utama akun.

## Rencana (urut prioritas)
1. **Shell akun** baru: header profil (avatar + nama + status verifikasi), navigasi samping/tab, ringkasan (tiket mendatang, pesanan aktif, voucher).
2. **Profil + foto** (#1, #8) → **Voucher** (#2) → **Pesanan+Refund** (#3, #4) → **Detail tiket** (#5).
3. Notifikasi, Keamanan, Privasi, Bantuan (#6, #7, #9, #10); lalu #11, #12.
4. Tiap langkah: tangkapan terang+gelap, `pnpm check`, e2e, `dcheck`.

## Keputusan
- Voucher: BE belum punya "dompet voucher" per pengguna (hanya validasi kode saat `quote`). Opsi diputuskan: **simpan kode yang pernah divalidasi di sisi pengguna lewat endpoint BE baru read-only bila skema mendukung**; bila tidak, FE menampilkan "Tukar kode" yang memvalidasi lewat `quote`/presale dan menyimpan hasilnya ke akun. Cek `promo.go` sebelum kode.

## Sumber
- `backend/api/openapi.yaml` (rute /me, /orders, /refunds, /tickets, /support), `backend/internal/service/{auth,promo}.go`, `frontend/src/pages/account/*`.
- [Baymard — Cancellation Requested order state](https://baymard.com/research-articles/cancellation-requested-order-state), [Baymard — event ticketing UX](https://baymard.com/research-articles/event-ticketing-ux-research-launch)
- [Ticketnation — your account](https://docs.ticketnation.ph/features/your-account), [Eleken — profile page design](https://eleken.co/blog-posts/profile-page-design), [Filestack — profile picture upload UI](https://blog.filestack.com/profile-picture-upload-ui/)
- `dref` DICE/tiket.com/Airbnb: `~/.agents/refs/{dice.fm,tiket.com,airbnb.com}` (halaman akun di balik login, jadi pola akun diambil dari riset teks).


## Status 2026-11-12 (akhir ronde 6)
| # | Fitur | Status |
|---|---|---|
| 1 | Foto profil (+ tampil di header) | SELESAI, e2e |
| 2 | Dompet voucher + tukar kode | SELESAI (BE `user_vouchers`), e2e |
| 3 | Refund: pusat refund `/refund`, ajukan, timeline, rekening | SELESAI, e2e |
| 4 | Batal pesanan, unduh invoice | SELESAI (invoice belum dites e2e unduhan) |
| 5 | Detail tiket: QR berputar, kirim, jual ulang | SELESAI, e2e |
| 5b | Halaman terima tiket `/claim/:token` | SELESAI, e2e (sebelumnya tautan kirim berujung halaman kosong) |
| 6 | Notifikasi + preferensi | SELESAI, e2e (push belum: butuh service worker) |
| 7 | Keamanan: 2FA, perangkat, ganti email | SELESAI; konfirmasi TOTP penuh belum dites |
| 9 | Privasi: persetujuan, ekspor, hapus akun | SELESAI, e2e |
| 10 | Bantuan: tiket dukungan + percakapan | SELESAI, e2e |
| - | Halaman legal `/legal/:kind` + tautan footer, halaman 404 | SELESAI, e2e |

## Gap customer yang BELUM ada (verifikasi rute FE vs BE)
- WS `seat.updated` (status kursi masih polling). Antre adil SELESAI 2026-11-12 (`/events/:slug/antre`).
- Pembayaran nyata (Midtrans Snap) — dev hanya lewat gateway fake.
- Halaman artis + ikuti artis SELESAI 2026-11-12. Belum: venue, kalender `/calendar`, rekomendasi `/me/recommendations`, ikuti venue/kota/genre.
- Jual-beli ulang (marketplace `/events/{slug}/resale`, beli listing, riwayat/penarikan hasil jual).
- Squad (bagi bayar), waitlist, ulasan (`/tickets/{id}/review`), pengingat onsale, passport/poin.
- Banner persetujuan cookie, pencarian pusat bantuan (`/content/help/search`), pengumuman, PWA/offline tiket.
- Konfirmasi ganti email (`/auth/email/change/confirm`), i18n `en` belum diaudit utuh.
