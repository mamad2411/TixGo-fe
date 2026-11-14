<script setup lang="ts">
// Dekorasi latar yang ringan: ilustrasi vektor buatan sendiri (mikrofon, piringan hitam, not,
// speaker, headphone, tiket, gitar), dua nada emas.
//  - hanya di MARGIN SAMPING, di luar kolom konten (lebar --a-max), jadi tidak menabrak teks/kartu;
//  - tampil bila margin cukup lebar (>= 1384px); di layar sempit tersisa cahaya dan berkas lampu;
//  - posisi, ukuran, dan sudut diundi ulang setiap halaman dimuat. Nilai acak disimpan 0..1 lalu
//    dipetakan ke piksel sesuai ukuran kolom, jadi saat resize komposisi hanya menyesuaikan skala;
//  - kedelapan ilustrasi disebar dalam SATU lintasan vertikal dengan jarak minimum, jadi tidak ada
//    dua ilustrasi yang sebaris (kiri dan kanan sekaligus), tidak bertumpuk, dan tidak terpotong;
//  - satu-satunya animasi: piringan hitam berputar pelan. Warna hanya dari tema (emas/krem/tinta).
import { onBeforeUnmount, onMounted, ref } from 'vue'

withDefaults(defineProps<{ behind?: boolean; items?: boolean }>(), {
  behind: false,
  items: true, // ilustrasi tampil; set false bila hanya berkas cahaya yang diinginkan
})

// rasio tinggi/lebar tiap ilustrasi, urut sesuai template (kiri 0-3, kanan 4-7)
const ART = [170 / 80, 1, 100 / 90, 110 / 80, 1, 84 / 150, 170 / 70, 100 / 90]
const SPIN = [1] // piringan hitam: sudutnya dipakai animasi putar, bukan kemiringan acak

const rnd = (min: number, max: number): number => min + Math.random() * (max - min)
function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

type Seed = { tilt: number; size: number; shift: number; place: number }
type Box = { a: number; s: Seed; w: number; f: number; g: number; envH: number; top: number }

// undian sekali per pemuatan halaman: refresh = susunan baru.
// place disebar merata (satu per 1/8 tinggi) lalu diacak dan digoyang, supaya tidak menumpuk
// di satu tempat tapi juga tidak membentuk baris yang teratur.
const seeds: Seed[] = (() => {
  const n = ART.length
  const slot = shuffled(n)
  return ART.map((a, i) => {
    const spread = a > 1.6 ? 9 : 17 // yang jangkung dimiringkan lebih sedikit agar tidak mengecil
    return {
      tilt: SPIN.includes(i) ? 0 : Math.round(rnd(-spread, spread)),
      size: rnd(0.7, 1),
      shift: rnd(-1, 1),
      place: (slot[i] + 0.5) / n + rnd(-0.4, 0.4) / n,
    }
  })
})()

const lay = ref<Record<string, string>[]>([])
const ready = ref(false)
const sideL = ref<HTMLElement>()

// petakan undian ke piksel: kotak-batas hasil rotasi harus muat di lebar kolom,
// dan kedelapan ilustrasi harus berbagi tinggi kolom tanpa saling menempel
function layout(): void {
  const el = sideL.value
  if (!el) return
  const W = el.clientWidth
  const H = el.clientHeight
  if (W < 8 || H < 40) return

  // 1. ukuran
  const box: Box[] = ART.map((a, i) => {
    const s = seeds[i]
    const t = (Math.abs(s.tilt) * Math.PI) / 180
    const cos = Math.cos(t)
    const sin = Math.sin(t)
    const f = cos + a * sin // lebar kotak-batas per px lebar gambar
    const g = a * cos + sin // tinggi kotak-batas per px lebar gambar
    const w = Math.max(12, ((W * 0.94) / f) * s.size)
    return { a, s, w, f, g, envH: w * g, top: 0 }
  })

  // 2. kalau tinggi kolom tidak cukup, semua diperkecil agar tetap ada jarak
  const gap = Math.max(26, H * 0.024)
  const total = box.reduce((n, b) => n + b.envH, 0)
  const room = H - gap * (box.length - 1)
  if (total > room) {
    const k = Math.max(0.05, room / total)
    for (const b of box) {
      b.w *= k
      b.envH *= k
    }
  }

  // 3. satu lintasan vertikal untuk kiri dan kanan sekaligus: target acak, lalu dipisah
  //    minimal `gap` sehingga tidak mungkin ada dua ilustrasi yang sebaris
  const order = [...box].sort((p, q) => p.s.place - q.s.place)
  let edge = 0
  for (const b of order) {
    b.top = Math.max(b.s.place * (H - b.envH), edge)
    edge = b.top + b.envH + gap
  }
  let limit = H
  for (let k = order.length - 1; k >= 0; k--) {
    const b = order[k]
    b.top = Math.min(b.top, limit - b.envH)
    limit = b.top - gap
  }

  lay.value = box.map((b) => {
    const roomX = Math.max(0, (W - b.w * b.f) / 2)
    return {
      '--iw': `${b.w.toFixed(1)}px`,
      '--r': `${b.s.tilt}deg`,
      '--dx': `${(b.s.shift * roomX * 0.9).toFixed(1)}px`,
      '--top': `${Math.max(0, b.top + (b.envH - b.a * b.w) / 2).toFixed(1)}px`,
    }
  })
  ready.value = true
}

let ro: ResizeObserver | undefined
onMounted(() => {
  layout()
  if (sideL.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => layout())
    ro.observe(sideL.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <div class="cb" :class="{ 'cb--behind': behind }" aria-hidden="true">
    <div class="cb__beams">
      <i style="--x: 8%; --w: 22%; --k: 0.9; --swing: 4.5deg; --dur: 13s; --delay: -2s" />
      <i style="--x: 38%; --w: 26%; --k: 0.7; --swing: 6deg; --dur: 18s; --delay: -7s" />
      <i style="--x: 70%; --w: 24%; --k: 0.85; --swing: 3.8deg; --dur: 15s; --delay: -11s" />
    </div>
    <div class="cb__glow" />

    <div v-if="items" class="cb__col" :class="{ 'is-ready': ready }">
      <!-- kiri -->
      <div ref="sideL" class="cb__side cb__side--l">
        <div class="cb__slot" :style="lay[0]">
          <svg class="cb__it" viewBox="0 0 80 170">
            <!-- mikrofon -->
            <path class="g1 st" d="M27 74h26l-5 64q-8 12-16 0z" />
            <rect class="g3 st" x="24" y="64" width="32" height="11" rx="3" />
            <circle class="g2 st" cx="40" cy="38" r="29" />
            <path class="ln" d="M13 30q27 12 54 0M12 40q28 14 56 0M16 50q24 11 48 0M40 9v58" />
            <path class="hi" d="M22 20q6-9 16-11" />
            <rect class="ink" x="35" y="96" width="10" height="4" rx="2" />
            <path class="g3 st" d="M31 138q9 14 18 0v10H31z" />
          </svg>
        </div>

        <div class="cb__slot" :style="lay[1]">
          <svg class="cb__it cb__vinyl" viewBox="-60 -60 120 120">
            <!-- piringan hitam -->
            <circle class="disc" r="58" />
            <circle v-for="r in [50, 43, 36, 29]" :key="r" class="groove" :r="r" />
            <path class="sheen" d="M0 0L-50-29A58 58 0 0 1-29-50ZM0 0L50 29A58 58 0 0 1 29 50Z" />
            <circle class="g2" r="20" />
            <circle class="lab" r="13" />
            <circle class="disc" r="3" />
          </svg>
        </div>

        <div class="cb__slot" :style="lay[2]">
          <svg class="cb__it" viewBox="0 0 90 100">
            <!-- not -->
            <path class="g3" d="M30 18 76 8v14L30 32z" />
            <rect class="g3" x="28" y="18" width="5" height="58" />
            <rect class="g3" x="73" y="8" width="5" height="58" />
            <ellipse class="g3" cx="20" cy="76" rx="14" ry="10" transform="rotate(-18 20 76)" />
            <ellipse class="g3" cx="65" cy="66" rx="14" ry="10" transform="rotate(-18 65 66)" />
          </svg>
        </div>

        <div class="cb__slot" :style="lay[3]">
          <svg class="cb__it" viewBox="0 0 80 110">
            <!-- speaker -->
            <rect class="g1 st" x="8" y="6" width="64" height="98" rx="9" />
            <circle class="g3 st" cx="40" cy="34" r="12" />
            <circle class="g2 st" cx="40" cy="72" r="23" />
            <circle class="g3 st" cx="40" cy="72" r="10" />
            <circle class="ink" cx="40" cy="34" r="3.500" />
            <path class="hi" d="M26 62q4-10 14-12" />
          </svg>
        </div>
      </div>

      <div class="cb__side cb__side--r">
        <!-- kanan -->
        <div class="cb__slot" :style="lay[4]">
          <svg class="cb__it" viewBox="0 0 120 120">
            <!-- headphone -->
            <path class="band" d="M20 72C20 28 36 12 60 12s40 16 40 60" />
            <rect class="g2 st" x="8" y="62" width="30" height="46" rx="13" />
            <rect class="g3 st" x="14" y="70" width="14" height="30" rx="6" />
            <rect class="g2 st" x="82" y="62" width="30" height="46" rx="13" />
            <rect class="g3 st" x="92" y="70" width="14" height="30" rx="6" />
            <path class="hi" d="M16 76v14M104 76v14" />
          </svg>
        </div>

        <div class="cb__slot" :style="lay[5]">
          <svg class="cb__it" viewBox="0 0 150 84">
            <!-- tiket -->
            <path class="g1 st" d="M8 6h134v22a10 10 0 0 0 0 28v22H8V56a10 10 0 0 0 0-28z" />
            <path class="perf" d="M106 10v64" />
            <polygon
              class="g3"
              points="52,24 57.5,35.500 70,37.200 61,46 63,58.500 52,52.600 41,58.500 43,46 34,37.200 46.500,35.500"
            />
            <rect class="ink" x="116" y="22" width="3" height="40" />
            <rect class="ink" x="122" y="22" width="1.500" height="40" />
            <rect class="ink" x="127" y="22" width="4" height="40" />
            <rect class="ink" x="133" y="22" width="2" height="40" />
          </svg>
        </div>

        <div class="cb__slot" :style="lay[6]">
          <svg class="cb__it" viewBox="0 0 70 170">
            <!-- gitar akustik -->
            <rect class="g3 st" x="29" y="6" width="12" height="26" rx="3" />
            <rect class="g1 st" x="31" y="30" width="8" height="64" />
            <path
              class="g2 st"
              d="M35 88c-12 0-16 8-16 16 0 6 3 8 3 12-8 3-12 11-12 20 0 18 12 28 25 28s25-10 25-28c0-9-4-17-12-20 0-4 3-6 3-12 0-8-4-16-16-16z"
            />
            <circle class="ink" cx="35" cy="130" r="8.500" />
            <rect class="g3 st" x="25" y="150" width="20" height="5" rx="2" />
            <path class="ln" d="M33 32v118M37 32v118" />
          </svg>
        </div>

        <div class="cb__slot" :style="lay[7]">
          <svg class="cb__it" viewBox="0 0 90 100">
            <path class="g3" d="M30 18 76 8v14L30 32z" />
            <rect class="g3" x="28" y="18" width="5" height="58" />
            <rect class="g3" x="73" y="8" width="5" height="58" />
            <ellipse class="g3" cx="20" cy="76" rx="14" ry="10" transform="rotate(-18 20 76)" />
            <ellipse class="g3" cx="65" cy="66" rx="14" ry="10" transform="rotate(-18 65 66)" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cb {
  --g1: #f1e2b8;
  --g2: #d9b979;
  --g3: #9a7432;
  --ink: #1a1613;
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
:global(.app.is-dark) .cb {
  --g1: #b08c4a;
  --g2: #8a6b34;
  --g3: #5b4522;
  --ink: #0c0a09;
}
.cb--behind {
  z-index: -1; /* di belakang konten non-posisi; induk harus isolation: isolate */
}
.cb > * {
  position: absolute;
}

/* Pendar kuning di dasar halaman dibuang (terbaca seperti noda blur); berkas lampu juga dimatikan. */
.cb__glow {
  display: none;
}
.cb__beams {
  display: none; /* garis cahaya vertikal terbaca sebagai artefak di terang maupun gelap */
}

/* kolom referensi = kolom konten; barang hanya di luar tepinya */
.cb__col {
  inset: 0 auto 0 50%;
  width: min(100%, var(--a-max, 1200px));
  translate: -50% 0;
  --w: clamp(64px, calc((100vw - var(--a-max, 1200px)) / 2 - 28px), 128px);
  display: none;
  opacity: 0;
  transition: opacity 0.45s ease;
}
.cb__col.is-ready {
  opacity: 1;
}
@media (min-width: 1384px) {
  .cb__col {
    display: block;
  }
}
/* kolom ilustrasi: tiap ilustrasi diletakkan absolut dari nilai acak yang sudah dihitung di script,
   jadi tidak perlu flex dan tidak ada yang bertumpuk */
.cb__side {
  position: absolute;
  top: 14px;
  bottom: 0;
  width: var(--w);
  overflow: hidden;
}
.cb__side--l {
  right: calc(100% + 14px);
}
.cb__side--r {
  left: calc(100% + 14px);
}
.cb__slot {
  position: absolute;
  inset-inline: 0;
  top: var(--top, 0px);
  display: grid;
  place-items: center;
}
/* --iw = lebar gambar (px, hasil undian), --dx = geser mendatar, --r = kemiringan.
   Semua dihitung di script supaya kotak-batas hasil rotasi tetap di dalam kolom. */
.cb__it {
  width: var(--iw, 64px);
  height: auto;
  translate: var(--dx, 0px) 0;
  rotate: var(--r, 0deg);
}

.g1 {
  fill: var(--g1);
}
.g2 {
  fill: var(--g2);
}
.g3 {
  fill: var(--g3);
}
.st {
  stroke: var(--ink);
  stroke-width: 2.4;
  stroke-linejoin: round;
}
.ink {
  fill: var(--ink);
}
.ln {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.8;
  stroke-linecap: round;
  opacity: 0.7;
}
.hi {
  fill: none;
  stroke: #fff;
  stroke-width: 3;
  stroke-linecap: round;
  opacity: 0.5;
}
.band {
  fill: none;
  stroke: var(--g3);
  stroke-width: 9;
  stroke-linecap: round;
}
.perf {
  stroke: var(--ink);
  stroke-width: 2;
  stroke-dasharray: 3 5;
  opacity: 0.6;
}
.disc {
  fill: #1a1613;
}
:global(.app.is-dark) .disc {
  fill: #0a0807;
  stroke: var(--g2);
  stroke-width: 1;
}
.groove {
  fill: none;
  stroke: #efe5cf;
  stroke-opacity: 0.12;
  stroke-width: 0.8;
}
.sheen {
  fill: #fff;
  opacity: 0.07;
}
.lab {
  fill: var(--g3);
}

/* satu-satunya animasi: piringan hitam berputar pelan */
.cb__vinyl {
  animation: cb-spin 60s linear infinite;
}
@keyframes cb-spin {
  to {
    rotate: 360deg;
  }
}

/* berkas lampu panggung: berayun pelan dari pangkalnya, tiap berkas beda tempo dan fase
   supaya tidak terlihat seperti satu gerakan serentak */
.cb__beams {
  inset: 0 0 auto 0;
  height: min(900px, 60%);
}
.cb__beams i {
  position: absolute;
  top: 0;
  left: var(--x);
  width: var(--w);
  height: 100%;
  clip-path: polygon(46% 0, 54% 0, 100% 100%, 0 100%);
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--g2) calc(var(--k) * 22%), transparent),
    transparent 85%
  );
  transform-origin: 50% 0;
  will-change: transform;
  animation: cb-swing var(--dur, 18s) ease-in-out infinite alternate;
  animation-delay: var(--delay, 0s);
}
@keyframes cb-swing {
  from {
    transform: rotate(calc(var(--swing, 3deg) * -1));
  }
  to {
    transform: rotate(var(--swing, 3deg));
  }
}
@media (prefers-reduced-motion: reduce) {
  .cb__beams i {
    animation: none;
    will-change: auto;
  }
}
</style>
