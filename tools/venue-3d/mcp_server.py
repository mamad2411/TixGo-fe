"""MCP server `tixgo-venue`: membangun & memeriksa aset 3D venue TixGo lewat Blender headless.

Jalankan (stdio):  uv run --with 'mcp<2' python tools/venue-3d/mcp_server.py
Daftarkan:         claude mcp add tixgo-venue -- uv run --with 'mcp<2' python /ABS/PATH/frontend/tools/venue-3d/mcp_server.py
Blender: env BLENDER (default /Applications/Blender.app/Contents/MacOS/Blender).
Alat: venue_list_assets · venue_inspect_glb · venue_build_assets · venue_render_preview
"""
import json
import os
import struct
import subprocess
from pathlib import Path

from mcp.server.fastmcp import FastMCP

HERE = Path(__file__).resolve().parent
MODELS = (HERE / ".." / ".." / "public" / "models").resolve()
RENDERS = (HERE / ".." / ".." / "design-src" / "renders").resolve()
BLENDER = os.environ.get("BLENDER", "/Applications/Blender.app/Contents/MacOS/Blender")
KNOWN = ["seat", "seat_lo", "stage", "barricade", "tower", "foh", "tent_bar", "tent_medic", "tent_merch", "toilet", "gate", "person"]

mcp = FastMCP("tixgo-venue")


def _run(args: list[str]) -> str:
    if not Path(BLENDER).exists():
        raise RuntimeError(f"Blender tidak ditemukan di {BLENDER} (set env BLENDER)")
    p = subprocess.run(
        [BLENDER, "-b", "--factory-startup", "-P", str(HERE / "build_assets.py"), "--", *args],
        capture_output=True, text=True, timeout=900,
    )
    lines = [l for l in p.stdout.splitlines() if l.startswith(("ASSET", "RENDER"))]
    if p.returncode != 0 or any("Traceback" in l for l in p.stdout.splitlines()):
        tail = "\n".join(p.stdout.splitlines()[-15:] + p.stderr.splitlines()[-5:])
        raise RuntimeError(f"Blender gagal (exit {p.returncode}):\n{tail}")
    return "\n".join(lines)


def _only(names: str) -> list[str]:
    sel = [n.strip() for n in names.split(",") if n.strip()]
    bad = [n for n in sel if n not in KNOWN]
    if bad:
        raise ValueError(f"aset tidak dikenal: {bad}. Pilihan: {KNOWN}")
    return ["--only", ",".join(sel)] if sel else []


@mcp.tool()
def venue_list_assets() -> str:
    """Daftar aset GLB venue yang ada di public/models beserta ukuran berkas."""
    rows = []
    for n in KNOWN:
        f = MODELS / f"{n}.glb"
        rows.append(f"{n:12s} {'ada' if f.exists() else 'BELUM'} {f.stat().st_size / 1024:8.1f} KB" if f.exists() else f"{n:12s} BELUM")
    return "\n".join(rows)


@mcp.tool()
def venue_inspect_glb(name: str) -> str:
    """Periksa satu GLB: jumlah mesh/material/tekstur, segitiga, dan bounding box (tanpa Blender)."""
    if name not in KNOWN:
        raise ValueError(f"aset tidak dikenal: {name}")
    data = (MODELS / f"{name}.glb").read_bytes()
    magic, ver, _ = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise ValueError("bukan GLB")
    ln, ty = struct.unpack_from("<II", data, 12)
    js = json.loads(data[20 : 20 + ln])
    acc = js.get("accessors", [])
    tris, mn, mx = 0, [1e9] * 3, [-1e9] * 3
    for m in js.get("meshes", []):
        for pr in m["primitives"]:
            if "indices" in pr:
                tris += acc[pr["indices"]]["count"] // 3
            a = acc[pr["attributes"]["POSITION"]]
            for i in range(3):
                mn[i] = min(mn[i], a["min"][i])
                mx[i] = max(mx[i], a["max"][i])
    size = [round(mx[i] - mn[i], 1) for i in range(3)]
    return json.dumps(
        {"name": name, "glTF": ver, "meshes": len(js.get("meshes", [])), "materials": len(js.get("materials", [])),
         "textures": len(js.get("textures", [])), "triangles": tris, "size_xyz_y_up": size,
         "bytes": len(data)}, indent=2)


@mcp.tool()
def venue_build_assets(only: str = "") -> str:
    """Bangun ulang aset GLB lewat Blender. `only` = daftar dipisah koma (kosong = semua)."""
    return _run(_only(only))


@mcp.tool()
def venue_render_preview(only: str = "") -> str:
    """Bangun aset + render komposisi pratinjau EEVEE ke design-src/renders/showcase.png."""
    RENDERS.mkdir(parents=True, exist_ok=True)
    return _run([*_only(only), "--render", str(RENDERS)])


if __name__ == "__main__":
    mcp.run()
