# Kredit & provenans foto landing

Sumber: **Wikimedia Commons**, hanya berkas yang metadata lisensinya **CC0 / domain publik** pada saat diunduh (2026-11-10; `scripts/assets/fetch_photos.py` berhenti keras bila lisensi berubah). CC0 tidak mewajibkan atribusi; kredit tetap dicatat demi transparansi.

| Berkas | Judul asli | Fotografer (menurut Commons) | Lisensi | Halaman sumber | Dipakai di |
|---|---|---|---|---|---|
| `front-row.webp` | Front row audience (Unsplash).jpg | Melanie van Leeuwen strompictures | CC0 | [File:Front_row_audience_(Unsplash).jpg…](https://commons.wikimedia.org/wiki/File:Front_row_audience_(Unsplash).jpg) | hero (portal + adegan layar penuh) dan butir akordeon 'Pintu masuk' |
| `hands-red.webp` | Put your hands in the air (Unsplash).jpg | Arkady Lifshits overdriv3 | CC0 | [File:Put_your_hands_in_the_air_(Unsplash…](https://commons.wikimedia.org/wiki/File:Put_your_hands_in_the_air_(Unsplash).jpg) | akordeon 'Resale' |
| `hands-silhouette.webp` | Houston audience lifting up hands (Unsplash).jpg | Chad Kirchoff cakirchoff | CC0 | [File:Houston_audience_lifting_up_hands_(…](https://commons.wikimedia.org/wiki/File:Houston_audience_lifting_up_hands_(Unsplash).jpg) | akordeon 'Antrean adil' |
| `phone-light.webp` | Monterrey concert silhouette (Unsplash).jpg | Daniel Gzz danigzz90 | CC0 | [File:Monterrey_concert_silhouette_(Unspl…](https://commons.wikimedia.org/wiki/File:Monterrey_concert_silhouette_(Unsplash).jpg) | akordeon 'Refund' |
| `blue-flare.webp` | Enjoying the concert (Unsplash).jpg | Melissa Askew teamaskew | CC0 | [File:Enjoying_the_concert_(Unsplash).jpg…](https://commons.wikimedia.org/wiki/File:Enjoying_the_concert_(Unsplash).jpg) | akordeon 'Squad' |
| `disco-ball.webp` | Mirrored Disco Ball with Light and Motor.jpg | Catboy69 | CC0 | [File:Mirrored_Disco_Ball_with_Light_and_…](https://commons.wikimedia.org/wiki/File:Mirrored_Disco_Ball_with_Light_and_Motor.jpg) | bagian 'Kota' |

**Pengolahan:** diunduh versi 2400 px → grading peta-gradasi ember→emas + vignette + WebP (`scripts/assets/grade_photos.py`). Berkas asli tidak di-commit (`design-src/originals/`, di `.gitignore`); metadata lengkap di `design-src/photos.meta.json`.

**Catatan jujur:** lima dari enam berkas adalah impor foto Unsplash era CC0 yang diunggah kontributor Commons. Status CC0 **hanya dipastikan dari metadata Commons**, bukan diverifikasi independen ke fotografer. Foto orang yang dapat dikenali (penonton) tidak memiliki rilis model di sini — **tinjauan hukum** sebelum rilis (hak potret/UU PDP) tetap disarankan, atau ganti dengan foto hasil sesi sendiri.

**Lapisan kedalaman (hero + bagian detail):** `front-row`, `hands-silhouette`, `hands-red`, `phone-light` dipisah menjadi `*-bg.webp` (panggung) dan `*-fg.webp` (siluet penonton ber-alpha) lewat PhotoCraft (`scripts/assets/craft_layers.py`) lalu di-grading (`grade_photos.py`). Penyelarasan diverifikasi terhadap foto asli (selisih ≤ 0,17 %).

**Dipakai juga di katalog (ronde 5):** `hands-silhouette-fg` sebagai siluet penonton latar daftar konser (`ConcertBackdrop.vue`, di-mask + diwarnai CSS); `blue-flare`, `hands-red-bg`, `phone-light-bg`, `hands-silhouette-bg`, `disco-ball` sebagai sampul cadangan acara tanpa poster (`utils/fallbackCover.ts`). Tidak ada ilustrasi buatan-prosedural.
