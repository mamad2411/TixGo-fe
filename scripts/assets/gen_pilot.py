#!/usr/bin/env python3
"""Pembangkit aset vektor pilot TixGo (gaya KARCIS / riso). Deterministik: hasil sama tiap dijalankan.

Keluaran → src/assets/illustrations/{scene,object}/*.svg
Aturan (docs/16 §2, §5): datar tanpa gradien, border tinta 2 px, maks 3 aksen, warna lewat CSS variable
(fallback ke nilai token) agar mengikuti tema terang/malam saat SVG disisipkan inline.

Pakai:  python3 scripts/assets/gen_pilot.py   (dari folder frontend/)
"""
import math, os, random

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "assets", "illustrations")

# token -> (css var, fallback terang). Dipakai sebagai fill="var(--x, #fallback)".
def c(name):
    fb = {"kertas": "#F2EAD8", "kertas2": "#E8DEC6", "tinta": "#121110", "merah": "#E32620",
          "kuning": "#FFD23F", "biru": "#2447F5", "hijau": "#7BE495", "abu": "#5F5B52"}[name]
    var = {"kertas": "--kertas", "kertas2": "--kertas-2", "tinta": "--tinta", "merah": "--merah-karcis",
           "kuning": "--kuning-spidol", "biru": "--biru-riso", "hijau": "--hijau-stabilo", "abu": "--abu-fotokopi"}[name]
    return f"var({var},{fb})"

# Adegan panggung selalu "malam" (tidak ikut dibalik oleh dark mode): nilai tetap.
NIGHT, NIGHT2, PAPER = "#1A1815", "#26231F", "#F2EAD8"
YEL, RED, BLUE = "#FFD23F", "#E32620", "#2447F5"


def write(sub, name, svg):
    d = os.path.join(ROOT, sub)
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, name)
    open(p, "w").write(svg)
    return p


def scene_panggung():
    """Adegan 1600x900, 6 lapis ber-id untuk parallax/scrub: sky, beams, truss, stage, crowd-far, crowd-near."""
    rnd = random.Random(184)
    W, H = 1600, 900
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t d">',
         '<title id="t">Panggung konser malam</title>',
         '<desc id="d">Panggung dengan lampu sorot, rangka truss, dan siluet penonton mengangkat tangan.</desc>']
    # 1. langit malam + titik halftone (tanpa gradien)
    o.append(f'<defs><pattern id="ht" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="6.5" cy="6.5" r="3.4" fill="{NIGHT2}"/><circle cx="19.5" cy="19.5" r="3.4" fill="{NIGHT2}"/></pattern></defs>')
    o.append(f'<g id="sky"><rect width="{W}" height="{H}" fill="{NIGHT}"/><rect width="{W}" height="520" fill="url(#ht)"/></g>')
    # 2. berkas lampu: poligon datar bertumpuk (bukan gradien)
    o.append('<g id="beams">')
    for i, (x, w, col, a) in enumerate([(300, 260, YEL, .9), (800, 300, RED, .85), (1300, 260, BLUE, .9), (560, 200, PAPER, .22), (1050, 200, PAPER, .22)]):
        top = 120
        o.append(f'<polygon points="{x - 14},{top} {x + 14},{top} {x + w},{600} {x - w},{600}" fill="{col}" opacity="{a * .55:.2f}"/>')
        o.append(f'<polygon points="{x - 8},{top} {x + 8},{top} {x + w * .45},{600} {x - w * .45},{600}" fill="{col}" opacity="{a:.2f}"/>')
    o.append('</g>')
    # 3. truss
    o.append(f'<g id="truss" stroke="{PAPER}" stroke-width="3" fill="none">')
    o.append(f'<rect x="120" y="96" width="1360" height="28" fill="{NIGHT}"/>')
    x = 120
    while x < 1480:
        o.append(f'<line x1="{x}" y1="124" x2="{x + 34}" y2="96"/><line x1="{x + 34}" y1="96" x2="{x + 68}" y2="124"/>')
        x += 68
    for lx in (300, 560, 800, 1050, 1300):
        o.append(f'<rect x="{lx - 22}" y="124" width="44" height="34" fill="{PAPER}" stroke="{NIGHT}"/>')
    o.append('</g>')
    # 4. panggung
    o.append(f'<g id="stage"><rect x="140" y="560" width="1320" height="120" fill="{RED}" stroke="{PAPER}" stroke-width="3"/>')
    o.append(f'<rect x="140" y="680" width="1320" height="40" fill="{NIGHT2}" stroke="{PAPER}" stroke-width="3"/>')
    for sx in (200, 1340):  # tumpukan speaker
        for k in range(3):
            o.append(f'<rect x="{sx}" y="{400 + k * 52}" width="60" height="52" fill="{NIGHT2}" stroke="{PAPER}" stroke-width="3"/>'
                     f'<circle cx="{sx + 30}" cy="{426 + k * 52}" r="16" fill="none" stroke="{PAPER}" stroke-width="3"/>')
    # drum kit siluet + mikrofon
    o.append(f'<g fill="{PAPER}" stroke="{NIGHT}" stroke-width="3"><ellipse cx="800" cy="520" rx="70" ry="38"/><ellipse cx="700" cy="500" rx="44" ry="20"/><ellipse cx="900" cy="500" rx="44" ry="20"/></g>')
    o.append(f'<g stroke="{PAPER}" stroke-width="5"><line x1="560" y1="470" x2="560" y2="560"/><circle cx="560" cy="462" r="12" fill="{YEL}"/></g>')
    o.append('</g>')

    def crowd(idn, base, n, size, col, hands):
        g = [f'<g id="{idn}" fill="{col}">']
        for i in range(n):
            cx = (i + .5) * W / n + rnd.uniform(-10, 10)
            r = size * rnd.uniform(.85, 1.15)
            cy = base - rnd.uniform(0, size * .8)
            g.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}"/>')
            g.append(f'<rect x="{cx - r * 1.5:.0f}" y="{cy + r * .6:.0f}" width="{r * 3:.0f}" height="{H - cy:.0f}" rx="{r:.0f}"/>')
            if hands and rnd.random() < .85:
                for sgn in (-1, 1):
                    if rnd.random() < .8:
                        hx = cx + sgn * r * 1.15
                        hl = r * rnd.uniform(2.0, 3.2)
                        tx = hx + sgn * rnd.uniform(4, 22)
                        g.append(f'<path d="M{hx:.0f},{cy + r:.0f} Q{hx + sgn * 6:.0f},{cy - hl * .5:.0f} {tx:.0f},{cy - hl:.0f}" stroke="{col}" stroke-width="{max(8, r * .28):.0f}" stroke-linecap="round" fill="none"/>')
                        g.append(f'<circle cx="{tx:.0f}" cy="{cy - hl - r * .22:.0f}" r="{max(8, r * .2):.0f}"/>')
        g.append('</g>')
        return "".join(g)

    o.append(crowd("crowd-far", 770, 22, 34, "#33302A", False))
    o.append(crowd("crowd-near", 880, 14, 62, "#0B0A09", True))
    # lampu kuning tangan: beberapa cahaya ponsel
    o.append(f'<g id="phones" fill="{YEL}">')
    for _ in range(9):
        o.append(f'<rect x="{rnd.randint(60, W - 80)}" y="{rnd.randint(640, 760)}" width="9" height="14" rx="2"/>')
    o.append('</g></svg>')
    return "\n".join(o)


def object_karcis():
    """Karcis/stub 960x400: perforasi, nomor mono, barcode, cap LUNAS. Teks memakai font token via CSS (fallback monospace)."""
    W, H, nx = 960, 400, 700
    p = (f'M24,0 H{W-24} a24,24 0 0 0 24,24 V{H-24} a24,24 0 0 0 -24,24 H24 a24,24 0 0 0 -24,-24 V24 a24,24 0 0 0 24,-24 Z')
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 {W+12} {H+12}" role="img" aria-labelledby="t">',
         '<title id="t">Karcis konser bernomor dengan cap LUNAS</title>',
         f'<path d="{p}" transform="translate(6,6)" fill="{c("tinta")}"/>',  # bayangan keras 6px, tanpa blur
         f'<path d="{p}" fill="{c("kuning")}" stroke="{c("tinta")}" stroke-width="4"/>',
         f'<rect x="0" y="0" width="{nx}" height="{H}" fill="{c("kertas")}" stroke="{c("tinta")}" stroke-width="4" id="body"/>',
         f'<line x1="{nx}" y1="14" x2="{nx}" y2="{H-14}" stroke="{c("tinta")}" stroke-width="4" stroke-dasharray="14 12" id="perforation"/>']
    # pinggir bergerigi
    for i in range(1, 10):
        y = i * H / 10
        o.append(f'<circle cx="{nx}" cy="{y:.0f}" r="7" fill="{c("kertas")}" stroke="{c("tinta")}" stroke-width="3"/>' if i % 2 == 0 else '')
    mono = 'font-family="var(--font-data, Space Mono, ui-monospace, monospace)"'
    disp = 'font-family="var(--font-display, Anton, Impact, sans-serif)"'
    o += [f'<text x="48" y="104" {mono} font-size="22" fill="{c("abu")}" textLength="420" lengthAdjust="spacingAndGlyphs">NO. 000184  ·  MALAM FINAL</text>',
          f'<text x="48" y="206" {disp} font-size="108" fill="{c("tinta")}" id="judul" textLength="520" lengthAdjust="spacingAndGlyphs">PANGGUNG</text>',
          f'<text x="48" y="206" {disp} font-size="108" fill="none" stroke="{c("biru")}" stroke-width="2" transform="translate(3,3)" aria-hidden="true" textLength="520" lengthAdjust="spacingAndGlyphs">PANGGUNG</text>',
          f'<text x="48" y="262" {disp} font-size="64" fill="{c("merah")}" textLength="330" lengthAdjust="spacingAndGlyphs">RAYA 2027</text>',
          f'<text x="48" y="322" {mono} font-size="24" fill="{c("tinta")}" textLength="420" lengthAdjust="spacingAndGlyphs">BLOK C / BARIS 12 / KURSI 05</text>',
          f'<text x="48" y="360" {mono} font-size="20" fill="{c("abu")}" textLength="330" lengthAdjust="spacingAndGlyphs">SAB 14 AGU · PINTU 17.00</text>']
    # barcode + nomor di stub
    x = nx + 40
    rnd = random.Random(7)
    while x < W - 44:
        w = rnd.choice((3, 3, 5, 7))
        o.append(f'<rect x="{x}" y="70" width="{w}" height="220" fill="{c("tinta")}"/>')
        x += w + rnd.choice((4, 6))
    o.append(f'<text x="{nx + 120}" y="334" {mono} font-size="20" fill="{c("tinta")}" text-anchor="middle" textLength="110" lengthAdjust="spacingAndGlyphs">000184</text>')
    # cap LUNAS (id=stamp untuk animasi ketuk)
    o.append(f'<g id="stamp" transform="translate(618 300) rotate(-8)"><circle r="58" fill="none" stroke="{c("merah")}" stroke-width="7"/>'
             f'<circle r="47" fill="none" stroke="{c("merah")}" stroke-width="3"/>'
             f'<text {disp} font-size="38" fill="{c("merah")}" text-anchor="middle" y="13" textLength="84" lengthAdjust="spacingAndGlyphs">LUNAS</text></g>')
    o.append('</svg>')
    return "\n".join(x for x in o if x)


def object_cap(label="HADIR", col="hijau"):
    """Cap bulat 320x320 (HADIR/SOLD OUT). Tepi cap sedikit tidak rata (misregistrasi) agar terasa dicap."""
    ink = c("merah") if col == "merah" else c("tinta")
    o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-labelledby="t">',
         f'<title id="t">Cap {label}</title>',
         f'<g id="stamp" transform="rotate(-6 160 160)">',
         f'<circle cx="160" cy="160" r="146" fill="{c("hijau") if col=="hijau" else "none"}" stroke="{ink}" stroke-width="8"/>',
         f'<circle cx="160" cy="160" r="122" fill="none" stroke="{ink}" stroke-width="3" stroke-dasharray="3 9" stroke-linecap="round"/>',
         f'<text x="160" y="190" font-family="var(--font-display, Anton, Impact, sans-serif)" font-size="92" fill="{ink}" text-anchor="middle" textLength="{min(190, 40 * len(label))}" lengthAdjust="spacingAndGlyphs">{label}</text>',
         f'<text x="160" y="236" font-family="var(--font-data, Space Mono, monospace)" font-size="22" fill="{ink}" text-anchor="middle" textLength="150" lengthAdjust="spacingAndGlyphs">TIXGO · 2027</text></g></svg>']
    return "\n".join(o)


if __name__ == "__main__":
    out = [write("scene", "scene-panggung-malam.svg", scene_panggung()),
           write("object", "object-karcis-lunas.svg", object_karcis()),
           write("object", "object-cap-hadir.svg", object_cap("HADIR", "hijau"))]
    for p in out:
        print(os.path.relpath(p), os.path.getsize(p), "bytes")
