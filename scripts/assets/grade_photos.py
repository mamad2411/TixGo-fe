#!/usr/bin/env python3
"""Grading foto → src/assets/photos/*.webp (ImageMagick). Satu bahasa warna untuk semua foto landing:
peta gradasi (tritone) hitam-hangus → ember → emas → krem, kontras kurva-S, vignette. Warna asli foto (biru/merah)
ikut sebagian kecil (MIX) agar tetap hidup, tidak seperti filter plastik.

Pakai: python3 scripts/assets/grade_photos.py [id ...]    (butuh: python3 scripts/assets/fetch_photos.py dulu)
"""
import os, subprocess, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
SRC = os.path.join(ROOT, "design-src", "originals")
DST = os.path.join(ROOT, "src", "assets", "photos")
STOPS = ["#070504", "#2a140f", "#8c4526", "#e6b46c", "#fff0d0"]
MIX = 22  # % warna asli
# id → (lebar keluaran, gravitasi crop opsional "WxH+x+y" tidak dipakai, kualitas, gamma)
SPEC = {
    "front-row": dict(w=3200, q=84, gamma=1.4, small=1600),
    "hands-red": dict(w=2400, q=80, gamma=1.3),
    "hands-silhouette": dict(w=2400, q=80, gamma=1.2),
    "phone-light": dict(w=2400, q=80, gamma=1.25),
    "blue-flare": dict(w=2400, q=80, gamma=1.05),
    "disco-ball": dict(w=2400, q=80, gamma=1.0),
}


def run(args):
    subprocess.run(args, check=True)


LAYERS = os.path.join(ROOT, "design-src", "layers")


def grade_ops(sp, clut):
    return ["(", "+clone", "-colorspace", "Gray", "-sigmoidal-contrast", "5,50%", "-gamma", str(sp["gamma"]), clut, "-clut", ")",
            "-compose", "blend", "-define", f"compose:args={100 - MIX}", "-composite"]


def grade_layers(pid, sp, clut):
    """Lapisan kedalaman dari craft_layers.py (PhotoCraft):
    - fg  = siluet penonton + alpha (hasil Select Subject → inverse → Layer via Cut). Dikembalikan ke ukuran kanvas penuh
            (posisi dari <id>-bounds.json bila ada, jika tidak diasumsikan rata-bawah lalu DIVERIFIKASI terhadap foto asli).
    - bg  = foto asli; area DI DALAM siluet (alpha diperkecil 5 px + diblur) diisi gelap hangat — BUKAN hasil Content-Aware Fill
            (yang menghalusinasi lampu/kabut ganda). Gap antar kepala/tangan saat parallax pun terbaca sebagai kerumunan gelap.
    Peta gradasi sama untuk keduanya; vignette hanya di bg."""
    import json
    tmp = os.path.join(ROOT, "design-src", "tmp")
    os.makedirs(tmp, exist_ok=True)
    w = sp["w"]
    orig = os.path.join(SRC, pid + ".jpg")
    fg_in = os.path.join(LAYERS, pid + "-fg.png")
    W0, H0 = map(int, subprocess.check_output(["magick", "identify", "-format", "%w %h", orig + "[0]"]).split())
    H = round(w * H0 / W0)
    fgw, fgh = map(int, subprocess.check_output(["magick", "identify", "-format", "%w %h", fg_in + "[0]"]).split())
    bj = os.path.join(LAYERS, pid + "-bounds.json")
    if os.path.exists(bj):
        x0, y0 = json.load(open(bj))["fg"][:2]
    else:
        x0, y0 = 0, H0 - fgh  # rata-bawah
    sc = w / W0
    ox, oy = round(x0 * sc), round(y0 * sc)
    base = os.path.join(tmp, pid + "-orig.png")
    run(["magick", orig, "-auto-orient", "-resize", f"{w}x{H}!", base])
    fg_full = os.path.join(tmp, pid + "-fgfull.png")
    run(["magick", fg_in, "-resize", f"{round(fgw * sc)}x{round(fgh * sc)}!", "-background", "none", "-gravity", "NorthWest",
         "-extent", f"{w}x{H}-{ox}-{oy}", fg_full])
    # verifikasi penyelarasan: selisih foto asli vs fg pada piksel solid harus < 1,5 %
    diff = float(subprocess.check_output(["magick", base, "(", fg_full, "-alpha", "off", ")", "-compose", "difference", "-composite",
                                          "(", fg_full, "-alpha", "extract", "-threshold", "90%", ")", "-compose", "multiply", "-composite",
                                          "-colorspace", "gray", "-format", "%[fx:mean*100]", "info:"], stderr=subprocess.DEVNULL))
    if diff > 1.5:
        sys.exit(f"{pid}: lapisan fg TIDAK sejajar dengan foto asli (selisih {diff:.2f} %). Simpan bounds lewat craft_layers.py terbaru.")
    mask = os.path.join(tmp, pid + "-mask.png")
    run(["magick", fg_full, "-alpha", "extract", "-morphology", "Erode", "Disk:5", "-blur", "0x3", mask])  # isian gelap HANYA di dalam siluet
    filled = os.path.join(tmp, pid + "-bgfilled.png")
    run(["magick", base, "(", "-size", f"{w}x{H}", "xc:#0b0807", mask, "-alpha", "off", "-compose", "CopyOpacity", "-composite", ")",
         "-compose", "over", "-composite", filled])
    run(["magick", filled, *grade_ops(dict(sp, gamma=sp["gamma"] * 1.38), clut),  # latar lebih terang; siluet depan tetap gelap
          "-background", "#070504", "-vignette", f"0x{round(260 * sp['w'] / 2000)}", "-quality", str(sp["q"]),
         "-define", "webp:method=6", os.path.join(DST, pid + "-bg.webp")])
    rgb, alpha = os.path.join(tmp, pid + "-rgb.png"), os.path.join(tmp, pid + "-a.png")
    # choke 1 px saja: tepi BG tetap piksel foto asli, jadi sambungan siluet/latar tak terlihat (choke besar → cincin gelap)
    run(["magick", fg_full, "-alpha", "extract", "-morphology", "Erode", "Disk:1", alpha])
    run(["magick", fg_full, "-background", "#070504", "-alpha", "remove", "-alpha", "off", *grade_ops(sp, clut), rgb])
    run(["magick", rgb, alpha, "-compose", "CopyOpacity", "-composite", "-quality", str(sp["q"]), "-define", "webp:method=6",
         "-define", "webp:alpha-quality=95", os.path.join(DST, pid + "-fg.webp")])
    for f in ("-orig.png", "-fgfull.png", "-mask.png", "-bgfilled.png", "-rgb.png", "-a.png"):
        os.remove(os.path.join(tmp, pid + f))
    if sp.get("small"):
        for kind in ("bg", "fg"):
            src = os.path.join(DST, f"{pid}-{kind}.webp")
            run(["magick", src, "-resize", f"{sp['small']}x", "-quality", str(sp["q"] - 4), "-define", "webp:method=6",
                 "-define", "webp:alpha-quality=95", os.path.join(DST, f"{pid}-{kind}-{sp['small']}.webp")])
    print(pid, f"(selisih {diff:.2f}%) bg", os.path.getsize(os.path.join(DST, pid + "-bg.webp")) // 1024, "KB · fg",
          os.path.getsize(os.path.join(DST, pid + "-fg.webp")) // 1024, "KB")


def main(ids):
    os.makedirs(DST, exist_ok=True)
    clut = os.path.join(ROOT, "design-src", "clut.png")
    run(["magick", *[f"xc:{c}" for c in STOPS], "+append", "-filter", "triangle", "-resize", "256x1!", clut])
    for pid in ids or SPEC:
        sp = SPEC[pid]
        if os.path.exists(os.path.join(LAYERS, pid + "-fg.png")):
            grade_layers(pid, sp, clut)
            continue
        out = os.path.join(DST, pid + ".webp")
        run(["magick", os.path.join(SRC, pid + ".jpg"), "-auto-orient", "-resize", f"{sp['w']}x", "-strip",
             "(", "+clone", "-colorspace", "Gray", "-sigmoidal-contrast", "5,50%", "-gamma", str(sp["gamma"]), clut, "-clut", ")",
             "-compose", "blend", "-define", f"compose:args={100 - MIX}", "-composite",
             "-background", "#070504", "-vignette", f"0x{round(260 * sp['w'] / 2000)}", "-quality", str(sp["q"]), "-define", "webp:method=6", out])
        print(pid, os.path.getsize(out) // 1024, "KB")


if __name__ == "__main__":
    main(sys.argv[1:])
