#!/usr/bin/env python3
"""Pisahkan foto konser menjadi lapisan KEDALAMAN untuk parallax sungguhan, memakai PhotoCraft (aplikasi lokal)
lewat server kontrol JSON-lines (`--control`). Hasil: design-src/layers/<id>-fg.png (siluet penonton + alpha)
dan <id>-bg.png (panggung tanpa penonton = "clean plate", diisi Content-Aware Fill).

Prasyarat (sekali): jalankan PhotoCraft dengan token + folder yang diizinkan, mis.
  TOK=$(python3 -c "import secrets;print(secrets.token_hex(32))"); echo $TOK > /tmp/craft.token
  open -g -n -a PhotoCraft --args --control 7981 --control-token $TOK \
       --automation-read-root <frontend>/design-src --automation-write-root /tmp
Catatan jujur:
- Perintah ekspor berbasis path dinonaktifkan aplikasi ("ambient filesystem paths"), jadi lapisan diekspor lewat
  clipboard macOS (edit.copy → PNG) — SKRIP INI MENIMPA CLIPBOARD Anda sementara.
- Pembukaan berkas lewat `open -a PhotoCraft <file>` (jalur kontrol file.openAs juga dinonaktifkan).
Pakai: python3 scripts/assets/craft_layers.py PORT TOKEN_FILE id [id ...]
"""
import json, os, socket, subprocess, sys, time

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
ORIG = os.path.join(ROOT, "design-src", "originals")
OUT = os.path.join(ROOT, "design-src", "layers")


class Craft:
    def __init__(self, port, token_file):
        self.s = socket.create_connection(("127.0.0.1", port), timeout=5)
        self.s.settimeout(300)
        self.f = self.s.makefile("rwb")
        self.n = 0
        assert self.call("auth", {"token": open(token_file).read().strip()}).get("ok"), "auth gagal"

    def call(self, method, params=None):
        self.n += 1
        self.f.write((json.dumps({"id": self.n, "method": method, "params": params or {}}) + "\n").encode())
        self.f.flush()
        return json.loads(self.f.readline())

    def cmd(self, name, params=None):
        r = self.call("engine.execute", {"command": name, "params": params or {}})
        if not r.get("ok"):
            raise RuntimeError(f"{name}: {r.get('error')}")
        return r.get("result")


def clip_to_png(dst):
    """Simpan PNG dari clipboard (AppleScript). Gagal keras bila clipboard bukan gambar."""
    script = f'''set d to (the clipboard as «class PNGf»)
set f to open for access POSIX file "{dst}" with write permission
set eof f to 0
write d to f
close access f'''
    subprocess.run(["osascript", "-e", script], check=True)


def split(c, pid, grow=14, feather=1.2):
    subprocess.run(["open", "-g", "-a", "PhotoCraft", os.path.join(ORIG, pid + ".jpg")], check=True)
    for _ in range(40):  # tunggu dokumen aktif berisi satu layer Background
        time.sleep(0.5)
        try:
            ls = c.cmd("layer.list", {})["layers"]
            if len(ls) == 1 and ls[0]["name"] == "Background":
                break
        except RuntimeError:
            pass
    c.cmd("select.subject", {"sampleAllLayers": True})
    c.cmd("select.inverse")  # subjek terdeteksi = panggung terang; yang kita mau = siluet penonton
    c.cmd("select.modify.feather", {"radius": feather})
    fg = c.cmd("layer.new.layerViaCut")["layer"]
    bg = next(l["id"] for l in c.cmd("layer.list", {})["layers"] if l["name"] == "Background")
    c.cmd("layer.select", {"layer": bg})
    c.cmd("select.reselect")
    c.cmd("select.modify.expand", {"radius": grow})
    c.cmd("edit.contentAwareFill", {"sampling": "auto", "colorAdaptation": "default", "output": "current"})
    c.cmd("select.deselect")
    os.makedirs(OUT, exist_ok=True)
    boxes = {l["id"]: l["bounds"] for l in c.cmd("layer.list", {})["layers"]}
    json.dump({"fg": boxes[fg], "bg": boxes[bg]}, open(os.path.join(OUT, f"{pid}-bounds.json"), "w"))  # [x,y,w,h] pada kanvas
    for lid, name in ((fg, "fg"), (bg, "bg")):
        c.cmd("layer.select", {"layer": lid})
        c.cmd("select.all")
        c.cmd("edit.copy")
        time.sleep(0.8)
        clip_to_png(os.path.join(OUT, f"{pid}-{name}.png"))
        c.cmd("select.deselect")
    c.cmd("file.close", {})  # tutup dokumen ini tanpa menyimpan (perilaku default aplikasi: lihat catatan)
    print(pid, "OK")


if __name__ == "__main__":
    port, tokf, *ids = sys.argv[1:]
    cl = Craft(int(port), tokf)
    for i in ids:
        split(cl, i)
