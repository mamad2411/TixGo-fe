#!/usr/bin/env python3
"""Aset vektor sinematik untuk landing page TixGo (tema konser). Deterministik.

Keluaran → src/assets/illustrations/landing/*.svg
Landing = satu-satunya tempat yang boleh memakai gradien/blur (lapis sinematik); app lain tetap KARCIS datar
(docs/16 prinsip 2 & 4, docs/25 §3). Semua gambar dibuat sendiri dari kode — tanpa foto/aset pihak lain.

Pakai:  python3 scripts/assets/gen_landing.py   (dari folder frontend/)
"""
import math
import os
import random
import re

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "assets", "illustrations", "landing")
GOLD, GOLD_D, GOLD_L = "#d9b979", "#8a6b34", "#f5e3b5"
INK = "#0c0a09"


def save(name, svg):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name)
    open(p, "w").write(svg)
    return p


def blur(idn, sd):
    return f'<filter id="{idn}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{sd}"/></filter>'


# --------------------------------------------------------------------------------------- 1. adegan panggung
def stage_scene():
    W, H = 1600, 1000
    r = random.Random(2027)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" role="img" aria-labelledby="t">',
         '<title id="t">Panggung konser saat senja dengan lampu sorot dan penonton</title>', '<defs>',
         '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0b1f"/><stop offset=".38" stop-color="#2b1f4a"/>'
         '<stop offset=".62" stop-color="#9a4a3e"/><stop offset=".78" stop-color="#e58b4f"/><stop offset="1" stop-color="#f6b56a"/></linearGradient>',
         '<radialGradient id="glow" cx=".5" cy=".62" r=".5"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".85"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>',
         '<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1cf" stop-opacity=".95"/><stop offset="1" stop-color="#fff1cf" stop-opacity="0"/></linearGradient>',
         '<linearGradient id="led" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1430"/><stop offset="1" stop-color="#3a1d3f"/></linearGradient>',
         blur("b4", 4), blur("b14", 14), blur("b40", 40), '</defs>',
         f'<rect width="{W}" height="{H}" fill="url(#sky)" id="sky-bg"/>']
    # bintang
    o.append('<g id="stars" fill="#fff6e0">')
    for _ in range(80):
        o.append(f'<circle cx="{r.randint(0, W)}" cy="{r.randint(0, 460)}" r="{r.uniform(.6, 1.7):.1f}" opacity="{r.uniform(.25, .9):.2f}"/>')
    o.append('</g>')
    o.append(f'<ellipse cx="800" cy="640" rx="760" ry="330" fill="url(#glow)" id="glow"/>')
    # bukit jauh
    o.append(f'<path id="hills" d="M0,640 C160,590 300,610 430,630 C600,560 760,600 900,620 C1060,585 1240,600 1400,625 C1500,610 1560,615 1600,620 V720 H0 Z" fill="#251a3d" opacity=".9"/>')
    # panggung: tower, LED, truss
    o.append('<g id="stage">')
    o.append('<rect x="560" y="470" width="480" height="210" fill="url(#led)" stroke="#d9b979" stroke-width="2"/>')
    for i in range(1, 12):
        o.append(f'<line x1="{560 + i * 40}" y1="470" x2="{560 + i * 40}" y2="680" stroke="#d9b979" stroke-opacity=".12"/>')
    for j in range(1, 5):
        o.append(f'<line x1="560" y1="{470 + j * 42}" x2="1040" y2="{470 + j * 42}" stroke="#d9b979" stroke-opacity=".12"/>')
    o.append('<circle cx="800" cy="575" r="62" fill="none" stroke="#f5e3b5" stroke-width="3" opacity=".8"/><circle cx="800" cy="575" r="38" fill="#f5e3b5" opacity=".18"/>')
    for sx in (430, 1090):  # menara kiri-kanan
        o.append(f'<rect x="{sx}" y="400" width="80" height="290" fill="#120d1f" stroke="#d9b979" stroke-width="2"/>')
        for k in range(8):
            o.append(f'<line x1="{sx}" y1="{410 + k * 36}" x2="{sx + 80}" y2="{446 + k * 36}" stroke="#d9b979" stroke-opacity=".35"/>')
    o.append('<rect x="380" y="380" width="840" height="26" fill="#120d1f" stroke="#d9b979" stroke-width="2"/>')
    x = 380
    while x < 1220:
        o.append(f'<path d="M{x},406 L{x + 20},380 L{x + 40},406" fill="none" stroke="#d9b979" stroke-width="2" stroke-opacity=".7"/>')
        x += 40
    o.append('<rect x="480" y="680" width="640" height="46" fill="#0d0a14" stroke="#d9b979" stroke-width="2"/></g>')
    # berkas lampu: gradien + blur + screen
    o.append('<g id="beams" style="mix-blend-mode:screen" filter="url(#b14)">')
    for bx, tx, wd in [(460, 120, 130), (560, 420, 100), (700, 700, 90), (900, 900, 90), (1040, 1180, 100), (1140, 1480, 130), (800, 800, 70)]:
        o.append(f'<polygon points="{bx - 8},392 {bx + 8},392 {tx + wd},760 {tx - wd},760" fill="url(#beam)" opacity=".55"/>')
    o.append('</g>')
    # kabut
    o.append('<g id="haze" filter="url(#b40)">')
    for _ in range(7):
        o.append(f'<ellipse cx="{r.randint(100, 1500)}" cy="{r.randint(690, 760)}" rx="{r.randint(180, 340)}" ry="{r.randint(30, 60)}" fill="#ffd9a0" opacity="{r.uniform(.22, .42):.2f}"/>')
    o.append('</g>')

    def crowd(idn, base, n, size, col, hands, phones):
        g = [f'<g id="{idn}" fill="{col}">']
        for i in range(n):
            cx = (i + .5) * W / n + r.uniform(-14, 14)
            rr = size * r.uniform(.85, 1.15)
            cy = base - r.uniform(0, size * .9)
            g.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{rr:.0f}"/><rect x="{cx - rr * 1.6:.0f}" y="{cy + rr * .6:.0f}" width="{rr * 3.2:.0f}" height="{H - cy:.0f}" rx="{rr:.0f}"/>')
            if hands:
                for sgn in (-1, 1):
                    if r.random() < .62:
                        hx = cx + sgn * rr * 1.2
                        hl = rr * r.uniform(2.2, 3.6)
                        tx = hx + sgn * r.uniform(4, 26)
                        g.append(f'<path d="M{hx:.0f},{cy + rr:.0f} Q{hx + sgn * 8:.0f},{cy - hl * .5:.0f} {tx:.0f},{cy - hl:.0f}" stroke="{col}" stroke-width="{max(9, rr * .3):.0f}" stroke-linecap="round" fill="none"/>'
                                 f'<circle cx="{tx:.0f}" cy="{cy - hl - rr * .2:.0f}" r="{max(9, rr * .22):.0f}"/>')
                        if phones and r.random() < .35:
                            phones.append((tx, cy - hl - rr * .5))
        g.append('</g>')
        return "".join(g)

    phones = []
    o.append(crowd("crowd-far", 800, 30, 30, "#1a1228", False, phones))
    o.append(crowd("crowd-near", 960, 12, 74, "#06050a", True, phones))
    o.append('<g id="phones">')
    for px, py in phones:
        o.append(f'<circle cx="{px:.0f}" cy="{py:.0f}" r="16" fill="#ffe9b0" opacity=".35" filter="url(#b4)"/><rect x="{px - 6:.0f}" y="{py - 10:.0f}" width="12" height="20" rx="2.5" fill="#fff3c8"/>')
    o.append('</g><g id="bokeh" filter="url(#b14)">')
    for _ in range(9):
        o.append(f'<circle cx="{r.randint(0, W)}" cy="{r.randint(760, 980)}" r="{r.randint(24, 60)}" fill="#ffd9a0" opacity="{r.uniform(.08, .18):.2f}"/>')
    o.append('</g></svg>')
    return "\n".join(o)


# --------------------------------------------------------------------------------------- 2. bingkai portal (minimal)
def portal_frame():
    """600x900. Bukaan = (70..530, 70..840) — geometri HARUS sama dengan OPEN di useLandingMotion.ts.
    Desain: cincin emas tipis konsentris + lantai tipis; tanpa ornamen kartun. Kedalaman dari 4 cincin berpudar,
    bukan dari tirai. Ruang antar cincin transparan (gelap halaman terlihat)."""
    def arch(inset, bottom=840):
        r_ = 300 - inset
        return f"M{inset},{bottom} V300 A{r_},{r_} 0 0 1 {600 - inset},300 V{bottom}"
    o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" role="presentation" aria-hidden="true">', '<defs>',
         f'<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{GOLD_L}"/><stop offset=".55" stop-color="{GOLD}"/><stop offset="1" stop-color="{GOLD_D}"/></linearGradient>',
         blur("pb", 6), '</defs>',
         # cahaya hangat di belakang bingkai
         f'<path d="{arch(60)} Z" fill="none" stroke="{GOLD}" stroke-width="22" opacity=".12" filter="url(#pb)"/>']
    for inset, w, op in [(70, 3, 1.0), (50, 1.6, .55), (32, 1.2, .32), (16, 1, .18)]:
        o.append(f'<path d="{arch(inset)}" fill="none" stroke="url(#pg)" stroke-width="{w}" opacity="{op}"/>')
    # lantai: garis tipis + ambang
    o.append(f'<path d="M16,840 H584" stroke="url(#pg)" stroke-width="1.4" opacity=".6"/><path d="M40,858 H560" stroke="url(#pg)" stroke-width="1" opacity=".3"/>')
    o.append('</svg>')
    return "\n".join(o)


# --------------------------------------------------------------------------------------- 3. kabut (transisi)
def haze():
    r = random.Random(11)
    W, H = 1600, 900
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">', '<defs>', blur("b50", 50), blur("b24", 24),
         '<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2ead8" stop-opacity="0"/><stop offset=".55" stop-color="#f2ead8" stop-opacity=".85"/><stop offset="1" stop-color="#f2ead8"/></linearGradient>',
         '</defs>', '<g filter="url(#b50)">']
    for _ in range(14):
        c = r.choice(["#ffd9a0", "#f6c58a", "#fff0d6", "#e8a96a"])
        o.append(f'<ellipse cx="{r.randint(0, W)}" cy="{r.randint(280, 760)}" rx="{r.randint(220, 420)}" ry="{r.randint(60, 130)}" fill="{c}" opacity="{r.uniform(.35, .7):.2f}"/>')
    o.append('</g><g filter="url(#b24)">')
    for _ in range(9):
        o.append(f'<ellipse cx="{r.randint(0, W)}" cy="{r.randint(480, 860)}" rx="{r.randint(160, 300)}" ry="{r.randint(34, 70)}" fill="#fff6e6" opacity="{r.uniform(.4, .75):.2f}"/>')
    o.append(f'</g><rect y="{H * .45:.0f}" width="{W}" height="{H * .55:.0f}" fill="url(#fade)"/></svg>')
    return "\n".join(o)


# --------------------------------------------------------------------------------------- 4. karcis hitam-emas
def ticket_hero():
    W, H, nx = 900, 420, 640
    r = random.Random(5)
    ser = 'font-family="var(--l-serif, Cormorant Garamond, Georgia, serif)"'
    sans = 'font-family="var(--l-sans, Manrope Variable, system-ui, sans-serif)"'
    # bentuk karcis: sudut melengkung + takik setengah lingkaran di garis sobek (atas & bawah)
    p = (f"M30,0 H{nx - 16} a16,16 0 0 0 32,0 H{W - 30} a30,30 0 0 0 30,30 V{H - 30} a30,30 0 0 0 -30,30 "
         f"H{nx + 16} a16,16 0 0 0 -32,0 H30 a30,30 0 0 0 -30,-30 V30 a30,30 0 0 0 30,-30 Z")
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -30 {W + 100} {H + 110}" role="img" aria-labelledby="tkt">',
         '<title id="tkt">Karcis konser hitam dengan foil emas</title>', '<defs>', blur("tksh", 18),
         f'<clipPath id="tkc"><path d="{p}"/></clipPath>',
         f'<linearGradient id="tkg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{GOLD_L}"/><stop offset=".45" stop-color="{GOLD}"/><stop offset=".7" stop-color="#f1d79a"/><stop offset="1" stop-color="{GOLD_D}"/></linearGradient>',
         '<linearGradient id="tkb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#231f1b"/><stop offset=".6" stop-color="#100e0c"/><stop offset="1" stop-color="#070605"/></linearGradient>',
         '<linearGradient id="tks" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".09"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>',
         '<radialGradient id="tkh" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff3c9"/><stop offset=".3" stop-color="#e8b6c8"/><stop offset=".55" stop-color="#9fd6d0"/><stop offset=".8" stop-color="#c9a24a"/><stop offset="1" stop-color="#6b4f1f"/></radialGradient></defs>',
         f'<g filter="url(#tksh)" opacity=".42"><path d="{p}" transform="translate(30,48)" fill="#3a2f20"/></g>',
         f'<path d="{p}" fill="url(#tkb)"/>', f'<g clip-path="url(#tkc)">']
    # pola guilloche (gelombang tumpang-tindih) — tanda keamanan cetak
    for k in range(22):
        a, f, ph = 10 + k * 1.1, 0.012 + (k % 5) * .0018, k * 0.55
        pts = " ".join(f"{x},{H * (k + 1) / 23 + a * math.sin(f * x + ph):.1f}" for x in range(0, W + 1, 12))
        o.append(f'<polyline points="{pts}" fill="none" stroke="{GOLD}" stroke-opacity=".075" stroke-width="1"/>')
    o.append(f'<rect x="0" y="0" width="{nx}" height="{H}" fill="url(#tks)" opacity=".7"/>')
    o.append('</g>')
    o.append(f'<path d="{p}" fill="none" stroke="url(#tkg)" stroke-width="3.2"/>')
    o.append(f'<path d="M30,18 H{nx - 16} a16,16 0 0 0 32,0 H{W - 30} a12,12 0 0 0 12,12 V{H - 30} a12,12 0 0 0 -12,12 H{nx + 16} a16,16 0 0 0 -32,0 H30 a12,12 0 0 0 -12,-12 V30 a12,12 0 0 0 12,-12 Z" fill="none" stroke="{GOLD}" stroke-opacity=".4" stroke-width="1.1"/>')
    # microtext di sepanjang bingkai dalam
    mt = "TIXGO · TIKET RESMI · SATU KURSI SATU CERITA · " * 3
    o.append(f'<text x="44" y="12" {sans} font-size="6.2" letter-spacing="1.6" fill="{GOLD}" fill-opacity=".4" textLength="{nx - 80}" lengthAdjust="spacing">{mt}</text>')
    o.append(f'<text x="44" y="{H - 6}" {sans} font-size="6.2" letter-spacing="1.6" fill="{GOLD}" fill-opacity=".4" textLength="{nx - 80}" lengthAdjust="spacing">{mt}</text>')
    # garis sobek berlubang
    o.append(f'<line x1="{nx}" y1="30" x2="{nx}" y2="{H - 30}" stroke="{GOLD}" stroke-width="2.6" stroke-dasharray="1 9" stroke-linecap="round"/>')
    # sisi kiri: identitas acara
    o += [f'<text x="64" y="84" {sans} font-size="14" letter-spacing="7" fill="{GOLD}">ADMIT ONE · TIXGO</text>',
          f'<text x="64" y="112" {sans} font-size="12" letter-spacing="3.5" fill="{GOLD}" fill-opacity=".7">SAB, 14 DES 2026 · ARENA NUSANTARA, JAKARTA</text>',
          f'<text x="62" y="208" {ser} font-size="104" fill="url(#tkg)" textLength="{nx - 120}" lengthAdjust="spacingAndGlyphs">Malam Raya</text>',
          f'<text x="64" y="256" {ser} font-size="38" font-style="italic" fill="{GOLD}">satu karcis, satu cerita</text>',
          f'<line x1="64" y1="290" x2="{nx - 40}" y2="290" stroke="{GOLD}" stroke-opacity=".35"/>']
    for i, (lab, val) in enumerate([("BLOK", "C"), ("BARIS", "12"), ("KURSI", "05"), ("PINTU", "17.00"), ("MULAI", "19.30")]):
        x = 64 + i * 112
        o.append(f'<text x="{x}" y="322" {sans} font-size="10.5" letter-spacing="3.5" fill="{GOLD}" fill-opacity=".65">{lab}</text>'
                 f'<text x="{x}" y="362" {ser} font-size="38" fill="{GOLD_L}">{val}</text>')
    # stub kanan: QR dinamis (barcode emas) + segel holografik
    x = nx + 40
    while x < W - 44:
        w = r.choice((3, 3, 5, 7))
        o.append(f'<rect x="{x}" y="58" width="{w}" height="196" fill="{GOLD}"/>')
        x += w + r.choice((3, 5, 7))
    o.append(f'<text x="{nx + 125}" y="282" {sans} font-size="12" letter-spacing="5" text-anchor="middle" fill="{GOLD}">000184</text>')
    cx, cy = nx + 125, 350
    o.append(f'<g transform="translate({cx} {cy})"><circle r="36" fill="url(#tkh)"/>'
             + "".join(f'<line x1="0" y1="0" x2="{36 * math.cos(math.radians(a)):.1f}" y2="{36 * math.sin(math.radians(a)):.1f}" stroke="#fff" stroke-opacity=".28" stroke-width=".8"/>' for a in range(0, 360, 15))
             + f'<circle r="36" fill="none" stroke="{GOLD_L}" stroke-width="1.6"/><circle r="27" fill="none" stroke="#0c0a09" stroke-opacity=".35" stroke-width="1"/>'
             + '<path d="M0,-13 L4,-4 L13,0 L4,4 L0,13 L-4,4 L-13,0 L-4,-4 Z" fill="#0c0a09" fill-opacity=".72"/></g>')
    o.append('</svg>')
    return "\n".join(o)


# --------------------------------------------------------------------------------------- 5. denah arena (kursi per baris)
def venue_plan():
    sans = 'font-family="var(--l-sans, Manrope Variable, system-ui, sans-serif)"'
    INK_L, SOLD, SEL = "#a3977c", "#d6cbb2", "#b8892f"
    r = random.Random(11)
    cx, cy = 500, 150  # titik pusat kipas = depan panggung
    o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1050" role="img" aria-labelledby="t">',
         '<title id="t">Denah arena: panggung, pit, dan tiga tingkat tribun berisi kursi per baris dengan kode blok</title>',
         '<defs><linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b979" stop-opacity=".38"/><stop offset="1" stop-color="#d9b979" stop-opacity="0"/></linearGradient></defs>']
    for ang in (-40, -20, 0, 20, 40):  # berkas lampu menyapu ke tribun
        a = math.radians(ang)
        x2, y2 = cx + 640 * math.sin(a), cy + 640 * math.cos(a)
        o.append(f'<path d="M{cx - 12},{cy - 20} L{cx + 12},{cy - 20} L{x2 + 46},{y2} L{x2 - 46},{y2} Z" fill="url(#beam)"/>')
    o.append(f'<g fill="none" stroke="{INK_L}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="plan">')
    o.append(f'<path class="draw" fill="#efe6d0" d="M300,30 H700 L735,{cy - 8} H265 Z"/>')
    o.append(f'<path class="draw" stroke-dasharray="7 6" d="M{cx - 205},{cy + 6} A205,205 0 0 0 {cx + 205},{cy + 6}"/>')
    o.append(f'<rect class="draw" x="{cx - 36}" y="{cy + 150}" width="72" height="34" rx="4"/></g>')
    tiers = [("A", 262, 360, 4), ("B", 392, 498, 5), ("C", 530, 640, 6)]
    secs, span, gap = 5, 112.0, 3.4
    a0 = -span / 2
    labels = []
    o.append('<g id="seats">')
    for code, rin, rout, rows in tiers:
        for si in range(secs):
            t0 = a0 + span / secs * si + gap / 2
            t1 = a0 + span / secs * (si + 1) - gap / 2
            for rw in range(rows):
                rr = rin + (rout - rin) * (rw + .5) / rows
                n = max(4, int(math.radians(t1 - t0) * rr / 18))
                for k in range(n):
                    t = math.radians(t0 + (t1 - t0) * (k + .5) / n)
                    x, y = cx + rr * math.sin(t), cy + rr * math.cos(t)
                    u = r.random() + (rr - 262) / 2200
                    if u < .3:
                        o.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="4.1" fill="{SOLD}"/>')
                    elif u > 1.05:
                        o.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="5.4" fill="{SEL}"/>')
                    else:
                        o.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="4.1" fill="none" stroke="{INK_L}" stroke-width="1.3"/>')
            tm = math.radians((t0 + t1) / 2)
            lr = rout + 17
            labels.append((cx + lr * math.sin(tm), cy + lr * math.cos(tm), f"{code}{si + 1}"))
    o.append('</g>')
    o.append(f'<g {sans} font-size="13" letter-spacing="1.5" fill="#7d7258" text-anchor="middle" id="codes">')
    for x, y, t in labels:
        o.append(f'<text x="{x:.0f}" y="{y + 4:.0f}">{t}</text>')
    o.append('</g>')
    o.append(f'<g {sans} font-size="17" letter-spacing="6" fill="#8a7e64" text-anchor="middle">'
             f'<text x="500" y="{cy - 50}">PANGGUNG</text><text x="500" y="{cy + 112}" font-size="14">PIT</text></g>')
    gy = 850
    o.append(f'<g fill="none" stroke="{INK_L}" stroke-width="2" stroke-linecap="round"><path class="draw" d="M120,{gy} H880"/>')
    for gx in (160, 330, 500, 670, 840):
        o.append(f'<circle class="draw" cx="{gx}" cy="{gy + 38}" r="19"/>')
    o.append('</g>')
    o.append(f'<g {sans} font-size="14" fill="#7d7258" text-anchor="middle">')
    for i, gx in enumerate((160, 330, 500, 670, 840)):
        o.append(f'<text x="{gx}" y="{gy + 43}">{i + 1}</text>')
    o.append(f'<text x="500" y="{gy + 82}" font-size="12" letter-spacing="5">PINTU MASUK 1 – 5</text></g>')
    ly = 1005
    o.append(f'<g {sans} font-size="13" letter-spacing="2" fill="#7d7258">'
             f'<circle cx="300" cy="{ly}" r="4.1" fill="none" stroke="{INK_L}" stroke-width="1.3"/><text x="314" y="{ly + 5}">TERSEDIA</text>'
             f'<circle cx="450" cy="{ly}" r="5.4" fill="{SEL}"/><text x="464" y="{ly + 5}">DIPILIH</text>'
             f'<circle cx="590" cy="{ly}" r="4.1" fill="{SOLD}"/><text x="604" y="{ly + 5}">TERJUAL</text></g></svg>')
    return "\n".join(o)


# --------------------------------------------------------------------------------------- 6. penonton + ponsel (potret)
def crowd_phones():
    W, H = 800, 1000
    r = random.Random(77)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" role="img" aria-labelledby="t">', '<title id="t">Penonton mengangkat ponsel yang menyala di depan panggung</title>', '<defs>',
         '<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#120d24"/><stop offset=".55" stop-color="#6b2b3a"/><stop offset="1" stop-color="#f08a4b"/></linearGradient>',
         '<radialGradient id="g" cx=".5" cy=".55" r=".55"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>',
         blur("b3", 3), blur("b20", 20), '</defs>',
         f'<rect width="{W}" height="{H}" fill="url(#s)"/><ellipse cx="400" cy="560" rx="460" ry="300" fill="url(#g)"/>']
    # bulan sabit
    o.append('<g transform="translate(590 170)"><circle r="64" fill="#fff2d0"/><circle cx="26" cy="-10" r="56" fill="#3a2142"/></g>')
    o.append('<g fill="#fff6e0">' + "".join(f'<circle cx="{r.randint(0, W)}" cy="{r.randint(0, 420)}" r="{r.uniform(.6, 1.6):.1f}" opacity="{r.uniform(.3, .9):.2f}"/>' for _ in range(40)) + '</g>')
    # berkas
    o.append('<g style="mix-blend-mode:screen" filter="url(#b20)" opacity=".7">' + "".join(
        f'<polygon points="{x - 6},0 {x + 6},0 {x + dx + 90},640 {x + dx - 90},640" fill="#ffe2b0" opacity=".5"/>' for x, dx in [(160, -60), (400, 0), (640, 60)]) + '</g>')
    phones = []
    g = ['<g id="crowd" fill="#07050b">']
    for row, (base, size, n) in enumerate([(760, 54, 8), (880, 78, 6), (990, 108, 4)]):
        for i in range(n):
            cx = (i + .5) * W / n + r.uniform(-24, 24)
            rr = size * r.uniform(.85, 1.1)
            cy = base - r.uniform(0, size * .6)
            g.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{rr:.0f}"/><rect x="{cx - rr * 1.6:.0f}" y="{cy + rr * .6:.0f}" width="{rr * 3.2:.0f}" height="{H}" rx="{rr:.0f}"/>')
            for sgn in (-1, 1):
                if r.random() < .7:
                    hx, hl = cx + sgn * rr * 1.25, rr * r.uniform(2.2, 3.4)
                    tx = hx + sgn * r.uniform(6, 30)
                    g.append(f'<path d="M{hx:.0f},{cy + rr:.0f} Q{hx + sgn * 10:.0f},{cy - hl * .5:.0f} {tx:.0f},{cy - hl:.0f}" stroke="#07050b" stroke-width="{max(10, rr * .3):.0f}" stroke-linecap="round" fill="none"/>')
                    if r.random() < .75:
                        phones.append((tx, cy - hl - rr * .25, row))
    g.append('</g>')
    o += g
    o.append('<g id="phones">')
    for px, py, row in phones:
        s = 1 + row * .45
        o.append(f'<circle cx="{px:.0f}" cy="{py:.0f}" r="{26 * s:.0f}" fill="#ffe9b0" opacity=".3" filter="url(#b3)"/><rect x="{px - 8 * s:.0f}" y="{py - 14 * s:.0f}" width="{16 * s:.0f}" height="{28 * s:.0f}" rx="3" fill="#fff3c8"/>')
    o.append('</g></svg>')
    return "\n".join(o)


# --------------------------------------------------------------------------------------- 7. bola disko (pengganti globe)
def disco_ball():
    S = 800
    cx = cy = S / 2
    R = 300
    r = random.Random(9)
    lx, ly, lz = -.5, -.55, .66
    n = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / n, ly / n, lz / n
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" role="img" aria-labelledby="t">', '<title id="t">Bola disko berkilau</title>', '<defs>', blur("b30", 30),
         '<radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset=".78" stop-color="#000" stop-opacity="1"/><stop offset=".86" stop-color="#d9b979" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>',
         '<radialGradient id="base" cx=".38" cy=".34" r=".8"><stop offset="0" stop-color="#6a5530"/><stop offset="1" stop-color="#15110b"/></radialGradient></defs>',
         f'<circle cx="{cx}" cy="{cy}" r="{R + 80}" fill="url(#halo)"/>',
         f'<circle cx="{cx}" cy="{cy}" r="{R + 14}" fill="#050403" stroke="#d9b979" stroke-opacity=".55" stroke-width="2"/>',
         f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="url(#base)"/><g id="facets">']
    lat_step, lon_step = 12, 15
    sparkles = []
    for lat in range(-84, 84, lat_step):
        for lon in range(-90, 90, lon_step):
            quad = []
            for dla, dlo in ((0, 0), (lat_step, 0), (lat_step, lon_step), (0, lon_step)):
                la, lo = math.radians(lat + dla), math.radians(lon + dlo)
                x, y, z = math.cos(la) * math.sin(lo), -math.sin(la), math.cos(la) * math.cos(lo)
                quad.append((cx + R * x, cy + R * y, x, y, z))
            mx = sum(q[2] for q in quad) / 4
            my = sum(q[3] for q in quad) / 4
            mz = sum(q[4] for q in quad) / 4
            sh = max(0.0, mx * lx + my * ly + mz * lz)
            val = .12 + .88 * sh ** 1.4 + r.uniform(-.1, .12)
            val = min(1, max(0, val))
            c = (int(70 + 185 * val), int(55 + 160 * val), int(30 + 110 * val))
            pts = " ".join(f"{q[0]:.0f},{q[1]:.0f}" for q in quad)
            o.append(f'<polygon points="{pts}" fill="rgb({c[0]},{c[1]},{c[2]})" stroke="#0b0907" stroke-width="1.2"/>')
            if val > .86 and r.random() < .5:
                sparkles.append((sum(q[0] for q in quad) / 4, sum(q[1] for q in quad) / 4))
    o.append('</g><g id="sparkles" fill="#fff7dc">')
    for sx, sy in sparkles[:26]:
        s = r.uniform(8, 18)
        o.append(f'<path d="M{sx:.0f},{sy - s:.0f} L{sx + s * .22:.0f},{sy - s * .22:.0f} L{sx + s:.0f},{sy:.0f} L{sx + s * .22:.0f},{sy + s * .22:.0f} L{sx:.0f},{sy + s:.0f} L{sx - s * .22:.0f},{sy + s * .22:.0f} L{sx - s:.0f},{sy:.0f} L{sx - s * .22:.0f},{sy - s * .22:.0f} Z"/>')
    o.append('</g></svg>')
    return "\n".join(o)


if __name__ == "__main__":
    # Adegan panggung, penonton, dan bola disko VEKTOR dihapus (terasa slop) → diganti foto CC0 bergrading (grade_photos.py).
    for name, fn in [("landing-portal-frame.svg", portal_frame), ("landing-haze.svg", haze),
                     ("landing-ticket-hero.svg", ticket_hero), ("landing-venue-plan.svg", venue_plan)]:
        p = save(name, fn())
        print(f"{name}: {os.path.getsize(p):,} B")
        if name == "landing-ticket-hero.svg":
            # Karcis juga ditulis sebagai komponen Vue (inline → memakai font halaman; tanpa v-html/DOMPurify).
            svg = open(p).read().replace('role="img" aria-labelledby="tkt"', 'role="presentation" aria-hidden="true"')
            svg = re.sub(r"<title id=\"tkt\">.*?</title>\n?", "", svg)
            comp = os.path.join(os.path.dirname(OUT), "..", "..", "components", "landing", "TicketArt.vue")
            open(comp, "w").write("<!-- DIBANGKITKAN oleh scripts/assets/gen_landing.py — jangan edit tangan -->\n<template>\n" + svg + "\n</template>\n")
            print("TicketArt.vue ditulis")
