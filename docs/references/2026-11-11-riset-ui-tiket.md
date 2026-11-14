# Riset UI/UX — situs tiket (2026-11-11)

Tujuan: UI app pelanggan setara produk tiket profesional, mode gelap dan terang sama matang. Bukan salin aset/brand.

## Temuan referensi (dibaca dengan `dref`, tangkapan dibuka satu per satu)
| Situs | Yang dipelajari |
|---|---|
| DICE | Satu bahasa: hitam/putih tegas + 1 warna sorot kecil (kuning di tanggal). Display tebal padat untuk judul, body netral. Radius hampir 0 (kartu) dan pil penuh (tombol, pencarian). Header ramping: logo, pencarian di tengah, 1 CTA solid. Harga di muka ("upfront pricing") jadi nilai jual. |
| Eventbrite | Kartu: gambar rasio tetap di atas, teks di bawah (tanggal, judul, tempat, harga), tanpa teks menumpuk di foto. Kategori = baris ikon ringan (satu baris). Pencarian + kota digabung satu kapsul di header. Tab ringan "Semua / Untukmu / Hari ini / Akhir pekan" menggantikan deretan dropdown. Palet: ungu tinta + 1 oranye aksi. Tanpa shadow, hanya garis. |
| Ticketmaster, Songkick, Linear | Disimpan di `~/.agents/refs/<slug>` (kerapatan daftar, tabel harga, kontras mode gelap). |

## Diagnosis UI TixGo saat ini (dari tangkapan sendiri, terang dan gelap)
1. Kartu acara menumpuk 5 lapis teks di atas foto (kategori, badge, judul serif, venue, harga). Sulit dipindai; kontras bergantung foto.
2. Rail hanya berisi 2–3 kartu sehingga setengah baris kosong; terlihat "belum jadi".
3. Ilustrasi mengambang (gitar, tiket, not) di tepi kosong terbaca sebagai clip-art; tidak membawa informasi.
4. Panel filter terlalu berat: 9 ikon bulat + 5 dropdown sekaligus.
5. Mode terang = krem di atas krem (kartu filter krem-in-krem, kontras antar-lapisan rendah). Mode gelap = cokelat-hitam datar dengan emas kuning terlalu neon; tidak ada tingkatan permukaan.
6. Header kosong di /events (tanpa pencarian/nav), hierarki tidak jelas.

## Keputusan (kontrak desain)
- **Arah:** editorial hangat + fungsional: satu aksen emas, tinta, kertas. Serif hanya untuk judul section dan hero; semua teks kartu sans.
- **Permukaan berlapis, bukan dekorasi:** bg -> panel -> panel-2 dengan selisih terang yang terukur di kedua mode.
- **Terang:** bg #F6F2EA, panel #FFFFFF, garis #E3DBCB, ink #1C1812, aksen #8A5A12 (kontras ≥4.5 di atas putih).
- **Gelap:** bg #0F0E0C, panel #181613, panel-2 #211E1A, garis #2E2A24, ink #F1EBDD, aksen #E0B25E (tidak neon).
- **Kartu acara:** poster rasio 4:5 di atas, chip tanggal, lalu judul sans 600, tempat, harga. Badge status satu saja.
- **Daftar:** kisi 4 kolom (desktop) untuk semua bagian; rail hanya bila item > kolom.
- **Tanpa clip-art mengambang.** Latar cukup berkas cahaya halus.
- **Gerak:** maks satu animasi dekoratif; transisi 120–240 ms.

## Sumber
- `~/.agents/refs/dice.fm`, `eventbrite.com`, `ticketmaster.com`, `songkick.com`, `linear.app` (`notes.md`, `desktop-hero.png`).
- Tangkapan lokal /events terang dan gelap, 2026-11-11.
- `~/.agents/DESIGN-PLAYBOOK.md` langkah 1–7; skill `designing-frontend-interfaces`, `anti-ui-slop`.
