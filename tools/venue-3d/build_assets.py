"""Aset 3D venue TixGo (Blender 5.x, headless) -> GLB untuk three.js + render pratinjau.

Jalankan:  Blender -b --factory-startup -P build_assets.py -- [--only seat,stage] [--out DIR] [--render DIR]

Satuan = satuan peta FE (1 unit ≈ 3 cm; kursi 14 x 12). Blender Z-up; exporter mengubah ke Y-up glTF dan +Y Blender
menjadi -Z glTF. Konvensi: PANGGUNG menghadap -Y Blender (= +Z glTF, ke arah penonton); KURSI menghadap +Y Blender
(= -Z glTF, ke panggung). Semua aset berpusat di x=0, y=0 dan berdiri di z=0.
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

ARGV = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def arg(name, default=None):
    return ARGV[ARGV.index(name) + 1] if name in ARGV else default


OUT = arg("--out", os.path.join(os.path.dirname(__file__), "..", "..", "public", "models"))
RENDER = arg("--render")
ONLY = set((arg("--only") or "").split(",")) - {""}


# ---------------------------------------------------------------- util
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


_mats = {}


def mat(name, color=(1, 1, 1), rough=0.6, metal=0.0, emit=None, emit_strength=0.0, image=None, alpha=None):
    key = (name, color, rough, metal, emit, emit_strength, image and image.name)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if alpha is not None:
        b.inputs["Alpha"].default_value = alpha
    if image is not None:
        t = m.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = image
        m.node_tree.links.new(t.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = emit_strength or 1.0
    elif emit is not None:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    _mats[key] = m
    return m


def _finish(o, name, material, bevel):
    o.name = name
    if material:
        o.data.materials.clear()
        o.data.materials.append(material)
    bpy.context.view_layer.objects.active = o
    if bevel:
        md = o.modifiers.new("bevel", "BEVEL")
        md.width = bevel
        md.segments = 3
        md.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=md.name)
    for p in o.data.polygons:
        p.use_smooth = bevel > 0
    return o


def box(name, size, loc=(0, 0, 0), material=None, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return _finish(o, name, material, bevel)


def cyl(name, r, h, loc=(0, 0, 0), material=None, rot=(0, 0, 0), seg=24, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, rotation=rot, vertices=seg)
    return _finish(bpy.context.active_object, name, material, bevel)


def cone(name, r1, r2, h, loc=(0, 0, 0), material=None, rot=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=h, location=loc, rotation=rot, vertices=seg)
    return _finish(bpy.context.active_object, name, material, 0)


def sphere(name, r, loc=(0, 0, 0), material=None, seg=20):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=max(8, seg // 2))
    return _finish(bpy.context.active_object, name, material, 0)


def beam(name, a, b, r, material, seg=10):
    """Silinder dari titik a ke b (untuk truss)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    mid = (a + b) / 2
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, location=mid, vertices=seg)
    o = bpy.context.active_object
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return _finish(o, name, material, 0)


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def move_to(c, objs):
    for o in objs:
        for oc in list(o.users_collection):
            oc.objects.unlink(o)
        c.objects.link(o)


def gradient_image(name, w, h, fn):
    img = bpy.data.images.new(name, w, h, alpha=False)
    px = []
    for y in range(h):
        for x in range(w):
            r, g, b = fn(x / (w - 1), y / (h - 1))
            px += [r, g, b, 1.0]
    img.pixels = px
    img.pack()
    return img


def truss_box(name, p0, p1, size, steel, braces=True):
    """Truss persegi dari p0 ke p1: 4 rel + diagonal."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    ax = d.normalized()
    up = Vector((0, 0, 1)) if abs(ax.z) < 0.9 else Vector((1, 0, 0))
    u = ax.cross(up).normalized()
    v = ax.cross(u).normalized()
    s = size / 2
    parts = []
    corners = [(-s, -s), (s, -s), (s, s), (-s, s)]
    for i, (cu, cv) in enumerate(corners):
        off = u * cu + v * cv
        parts.append(beam(f"{name}_r{i}", p0 + off, p1 + off, 0.9, steel, 8))
    if braces:
        n = max(2, int(L / (size * 1.6)))
        step = L / n
        for k in range(n):
            a = p0 + ax * (k * step)
            b = p0 + ax * ((k + 1) * step)
            sgn = 1 if k % 2 == 0 else -1
            for (c1, c2) in ((0, 1), (1, 2), (2, 3), (3, 0)):
                o1 = u * corners[c1][0] + v * corners[c1][1]
                o2 = u * corners[c2][0] + v * corners[c2][1]
                parts.append(beam(f"{name}_b", (a + o1) if sgn > 0 else (a + o2), (b + o2) if sgn > 0 else (b + o1), 0.45, steel, 6))
    return parts


# ---------------------------------------------------------------- materials palette
def palette():
    return dict(
        steel=mat("steel", (0.55, 0.57, 0.6), 0.35, 1.0),
        black=mat("black", (0.025, 0.025, 0.03), 0.55, 0.2),
        rubber=mat("rubber", (0.02, 0.02, 0.022), 0.9),
        deck=mat("deck", (0.08, 0.075, 0.07), 0.7),
        carpet=mat("carpet", (0.16, 0.05, 0.05), 0.95),
        white=mat("white", (0.92, 0.9, 0.86), 0.6),
        gold=mat("gold", (0.85, 0.68, 0.32), 0.3, 1.0),
        fabric=mat("fabric", (1, 1, 1), 0.85),
        wood=mat("wood", (0.28, 0.17, 0.09), 0.6),
        warm=mat("warm_emit", (1, 0.8, 0.5), 0.4, 0, (1.0, 0.75, 0.4), 6.0),
        cool=mat("cool_emit", (0.6, 0.75, 1), 0.4, 0, (0.55, 0.7, 1.0), 6.0),
        red=mat("red", (0.7, 0.08, 0.06), 0.55),
        cross=mat("cross_emit", (1, 1, 1), 0.5, 0, (1.0, 0.2, 0.2), 3.0),
        glass=mat("glass", (0.6, 0.75, 0.8), 0.05, 0, None, 0, None, 0.35),
    )


# ---------------------------------------------------------------- aset
def build_seat(P, lo=False):
    """Kursi teater: bantalan, sandaran miring, sandaran tangan, kaki. Menghadap +Y. Tinggi ±22."""
    o = []
    o.append(box("cushion", (12.4, 11, 4.2), (0, 0.6, 8.4), P["fabric"], 0 if lo else 1.3))
    o.append(box("back", (12.4, 3.2, 12.5), (0, -4.6, 16.2), P["fabric"], 0 if lo else 1.4, rot=(math.radians(-8), 0, 0)))
    if not lo:
        o.append(box("headcap", (10.2, 2.4, 3.4), (0, -5.6, 23.6), P["fabric"], 0 if lo else 1.0, rot=(math.radians(-8), 0, 0)))
    for sx in (-6.9, 6.9):
        o.append(box("arm", (1.6, 9.5, 2.0), (sx, 0.2, 12.2), P["black"], 0))
        o.append(box("armpost", (1.4, 1.8, 5.2), (sx, -2.2, 9.4), P["black"], 0))
    o.append(cyl("pedestal", 1.7, 6.2, (0, -0.6, 3.1), P["black"], seg=8))
    o.append(cyl("foot", 4.2, 1.0, (0, -0.6, 0.5), P["black"], seg=10))
    return join(o, "seat_lo" if lo else "seat")


def build_stage(P):
    """Panggung konser lebar 400 x dalam 130 x tinggi 26 + LED wall, truss, line array, lampu."""
    W, D, H = 400.0, 130.0, 26.0
    objs = []
    # dek + apron melengkung depan (bevel)
    objs.append(box("deck", (W, D, H), (0, 0, H / 2), P["deck"], 1.2))
    objs.append(box("deck_top", (W - 6, D - 6, 1.2), (0, 0, H + 0.4), P["carpet"], 0.4))
    objs.append(box("front_skirt", (W, 3, H - 2), (0, -D / 2 - 0.5, H / 2), P["black"], 0.6))
    # strip LED tepi depan
    objs.append(box("edge_led", (W - 8, 1.6, 2.2), (0, -D / 2 - 2.2, H - 3), P["warm"], 0.4))
    # tangga kecil kiri-kanan
    for sx in (-W / 2 + 22, W / 2 - 22):
        for i in range(4):
            objs.append(box("step", (22, 8, 6.2), (sx, -D / 2 - 5 - i * 7, 3.1 * (4 - i) / 2 + 1.5), P["deck"], 0.4))
    # LED wall belakang (tekstur prosedural emisif)
    def led(u, v):
        s = 0.5 + 0.5 * math.sin(u * 16 + v * 3)
        r = 0.15 + 0.85 * (1 - v) * (0.6 + 0.4 * s)
        g = 0.05 + 0.35 * v * s
        b = 0.35 + 0.65 * (u * 0.6 + 0.4 * s)
        stripe = 0.82 if int(u * 80) % 2 == 0 else 1.0  # kisi piksel halus
        return (r * stripe, g * stripe, b * stripe)

    img = gradient_image("led_wall", 256, 96, led)
    ledm = mat("led_wall", (1, 1, 1), 0.3, 0, None, 2.2, img)
    wall = box("led_frame", (W * 0.86, 4, 112), (0, D / 2 - 10, H + 56), P["black"], 0.8)
    objs.append(wall)
    panel = box("led_panel", (W * 0.86 - 6, 1.2, 106), (0, D / 2 - 12.6, H + 56), ledm, 0.2)
    objs.append(panel)
    # layar samping bersudut
    for sx, ang in ((-W * 0.5 - 6, 14), (W * 0.5 + 6, -14)):
        objs.append(box("wing_frame", (46, 4, 96), (sx, D / 2 - 18, H + 52), P["black"], 0.8, rot=(0, 0, math.radians(ang))))
        objs.append(box("wing_led", (42, 1.2, 90), (sx, D / 2 - 20.6, H + 52), ledm, 0.2, rot=(0, 0, math.radians(ang))))
    # truss: 2 balok melintang + 4 tiang + balok depan
    top = H + 124
    for y in (D / 2 - 6, -D / 2 + 20):
        objs += truss_box("tr_h", (-W / 2 - 6, y, top), (W / 2 + 6, y, top), 9, P["steel"])
    for sx in (-W / 2 - 6, W / 2 + 6):
        for y in (D / 2 - 6, -D / 2 + 20):
            objs += truss_box("tr_v", (sx, y, 0.2), (sx, y, top), 9, P["steel"], braces=True)
        objs += truss_box("tr_s", (sx, D / 2 - 6, top), (sx, -D / 2 + 20, top), 9, P["steel"])
    # lampu gantung: moving head (badan + lensa emisif)
    random.seed(7)
    for i in range(11):
        x = -W / 2 + 14 + i * (W - 28) / 10
        y = -D / 2 + 20
        objs.append(cyl("mh_body", 4.2, 9, (x, y, top - 11), P["black"], seg=14))
        objs.append(cyl("mh_lens", 3.0, 1.6, (x, y - 0.2, top - 17), P["cool"] if i % 2 else P["warm"], seg=14))
        objs.append(box("mh_yoke", (9, 2, 4), (x, y, top - 5), P["black"], 0.3))
    # line array speaker kiri-kanan (6 kotak melengkung)
    for sx in (-W / 2 - 34, W / 2 + 34):
        for k in range(7):
            ang = math.radians(-1.6 * k)
            objs.append(box("la", (22, 14, 12), (sx, -D / 2 + 26, top - 14 - k * 12.4), P["black"], 1.0, rot=(ang, 0, 0)))
            objs.append(box("la_grille", (19, 0.6, 9), (sx, -D / 2 + 18.8, top - 14 - k * 12.4), P["steel"], 0.2, rot=(ang, 0, 0)))
        objs.append(cyl("la_cable", 0.5, 22, (sx, -D / 2 + 26, top - 4), P["steel"], seg=6))
        # subwoofer di lantai
        for k in range(3):
            objs.append(box("sub", (24, 22, 16), (sx - (8 if sx < 0 else -8), -D / 2 - 14, H + 8 + 0 * k), P["black"], 1.2))
    # drum riser + tiang mic + monitor
    objs.append(box("riser", (60, 46, 6), (0, 10, H + 3), P["black"], 0.6))
    for sx in (-70, 70):
        objs.append(box("monitor", (16, 12, 8), (sx, -D / 2 + 14, H + 4), P["black"], 0.8, rot=(math.radians(-30), 0, 0)))
        objs.append(cyl("mic_stand", 0.5, 28, (sx + 12, -D / 2 + 24, H + 14), P["steel"], seg=6))
    return join(objs, "stage")


def build_barricade(P):
    """Barikade logam 120 lebar: rel atas/bawah + jeruji + kaki penopang."""
    o = [box("rail_top", (120, 1.6, 1.6), (0, 0, 20), P["steel"], 0.5), box("rail_low", (120, 1.6, 1.6), (0, 0, 7), P["steel"], 0.5)]
    for i in range(13):
        o.append(cyl("bar", 0.55, 20, (-60 + i * 10, 0, 10.5), P["steel"], seg=8))
    for sx in (-58, 58):
        o.append(box("foot", (2.2, 16, 1.6), (sx, 0, 0.8), P["steel"], 0.4))
        o.append(box("post", (2.2, 2.2, 22), (sx, 0, 11), P["steel"], 0.4))
    return join(o, "barricade")


def build_tower(P):
    """Menara delay: scaffold 4 tiang + tumpukan speaker + lampu merah peringatan."""
    o = []
    for sx in (-7, 7):
        for sy in (-7, 7):
            o.append(cyl("leg", 0.9, 120, (sx, sy, 60), P["steel"], seg=8))
    for z in range(10, 121, 22):
        o.append(box("ring", (16, 1.2, 1.2), (0, -7, z), P["steel"], 0.2))
        o.append(box("ring", (16, 1.2, 1.2), (0, 7, z), P["steel"], 0.2))
        o.append(box("ring", (1.2, 16, 1.2), (-7, 0, z), P["steel"], 0.2))
        o.append(box("ring", (1.2, 16, 1.2), (7, 0, z), P["steel"], 0.2))
    for k in range(5):
        o.append(box("spk", (18, 12, 14), (0, -8, 78 + k * 14), P["black"], 1.0))
    o.append(sphere("beacon", 1.8, (0, 0, 123), P["cross"]))
    o.append(box("base", (22, 22, 3), (0, 0, 1.5), P["rubber"], 0.5))
    return join(o, "tower")


def build_foh(P):
    """Booth FOH: kanopi, meja mixing berlayar menyala, rak lighting console."""
    o = [box("floor", (110, 64, 4), (0, 0, 2), P["deck"], 0.6)]
    for sx in (-50, 50):
        for sy in (-28, 28):
            o.append(cyl("post", 1.2, 44, (sx, sy, 26), P["steel"], seg=8))
    o.append(box("roof", (114, 68, 2.4), (0, 0, 49), P["black"], 0.8))
    o.append(box("desk", (80, 18, 12), (0, 8, 11), P["black"], 1.0))
    o.append(box("console", (66, 12, 2.4), (0, 6, 17.4), P["steel"], 0.5, rot=(math.radians(-12), 0, 0)))
    for i in range(6):
        o.append(box("fader_glow", (6, 0.8, 0.8), (-27 + i * 10.8, 1.6, 18.6), P["cool"], 0.1))
    o.append(box("screen", (24, 1.4, 14), (-22, 14, 28), P["cool"], 0.3, rot=(math.radians(-8), 0, 0)))
    o.append(box("screen", (24, 1.4, 14), (22, 14, 28), P["warm"], 0.3, rot=(math.radians(-8), 0, 0)))
    o.append(box("rail", (112, 1.4, 14), (0, -32, 11), P["steel"], 0.4))
    return join(o, "foh")


def tent(P, name, roof_a, roof_b, glow=None, size=(88, 66)):
    W, D = size
    o = [box("floor", (W, D, 3), (0, 0, 1.5), P["deck"], 0.6)]
    for sx in (-W / 2 + 4, W / 2 - 4):
        for sy in (-D / 2 + 4, D / 2 - 4):
            o.append(cyl("post", 1.3, 40, (sx, sy, 22), P["steel"], seg=8))
    # atap bergaris (6 panel segitiga)
    n = 6
    for i in range(n):
        w = W / n
        m = roof_a if i % 2 == 0 else roof_b
        o.append(box("roof", (w, D + 6, 1.6), (-W / 2 + w / 2 + i * w, 0, 44 + 6 * (1 - abs(2 * i / (n - 1) - 1))), m, 0.3))
    o.append(box("valance", (W + 4, 2, 7), (0, -D / 2 - 1, 40), roof_b, 0.4))
    o.append(box("counter", (W - 14, 10, 14), (0, -D / 2 + 10, 10), P["wood"], 0.8))
    o.append(box("counter_top", (W - 10, 13, 1.6), (0, -D / 2 + 10, 17.6), P["white"], 0.4))
    if glow:
        o.append(box("sign", (W - 24, 1.4, 7), (0, -D / 2 - 2.6, 33), glow, 0.4))
    for k in range(5):
        o.append(cyl("shelf_item", 2.2, 5, (-W / 2 + 14 + k * 15, D / 2 - 10, 7), P["white"] if k % 2 else P["gold"], seg=10))
    return join(o, name)


def build_tent_bar(P):
    return tent(P, "tent_bar", mat("stripe_a", (0.75, 0.38, 0.1), 0.7), mat("stripe_b", (0.95, 0.9, 0.78), 0.7), P["warm"])


def build_tent_medic(P):
    t = tent(P, "tent_medic", P["white"], mat("stripe_r", (0.8, 0.1, 0.1), 0.7), P["cross"])
    return t


def build_tent_merch(P):
    return tent(P, "tent_merch", mat("stripe_p", (0.36, 0.2, 0.6), 0.7), P["white"], P["cool"])


def build_toilet(P):
    o = [box("base", (150, 44, 3), (0, 0, 1.5), P["rubber"], 0.6)]
    cab = mat("cabin", (0.18, 0.4, 0.46), 0.55)
    for i in range(5):
        x = -60 + i * 30
        o.append(box("cabin", (28, 38, 54), (x, 0, 30), cab, 1.2))
        o.append(box("door", (18, 1.2, 42), (x, -19.6, 27), P["white"], 0.5))
        o.append(box("vent", (22, 30, 2), (x, 0, 58), P["black"], 0.5))
        o.append(box("lock", (3, 0.8, 3), (x + 6, -20.4, 28), P["cross"] if i % 2 else P["cool"], 0.2))
    return join(o, "toilet")


def build_gate(P):
    """Gerbang masuk: 2 tiang truss + papan lintang emisif + pagar antrean."""
    o = []
    for sx in (-70, 70):
        o += truss_box("g", (sx, 0, 0.2), (sx, 0, 78), 9, P["steel"])
    o += truss_box("g_h", (-74, 0, 78), (74, 0, 78), 9, P["steel"])
    o.append(box("banner", (132, 2, 22), (0, -4, 66), P["black"], 0.8))
    o.append(box("banner_glow", (124, 1.2, 4), (0, -5.4, 66), P["warm"], 0.4))
    for i in range(3):
        o.append(box("stanchion", (1.6, 1.6, 20), (-30 + i * 30, -16, 10), P["gold"], 0.4))
    o.append(box("rope", (60, 0.8, 0.8), (0, -16, 17), P["red"], 0.2))
    return join(o, "gate")


def build_person(P):
    """Figur penonton stilistik (tangan terangkat) untuk instancing kerumunan."""
    skin = mat("skin", (0.85, 0.7, 0.58), 0.8)
    o = [cyl("body", 2.6, 9, (0, 0, 7.8), P["fabric"], seg=8), sphere("head", 2.1, (0, 0, 14.2), skin, 8)]
    for sx, ang in ((-1, 30), (1, -30)):
        o.append(cyl("arm", 0.7, 7, (sx * 3.4, 0, 12.6), skin, rot=(0, math.radians(ang), 0), seg=5))
    return join(o, "person")


ASSETS = [
    ("seat", build_seat),
    ("seat_lo", lambda P: build_seat(P, lo=True)),
    ("stage", build_stage),
    ("barricade", build_barricade),
    ("tower", build_tower),
    ("foh", build_foh),
    ("tent_bar", build_tent_bar),
    ("tent_medic", build_tent_medic),
    ("tent_merch", build_tent_merch),
    ("toilet", build_toilet),
    ("gate", build_gate),
    ("person", build_person),
]


def tri_count(o):
    me = o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
    n = sum(len(p.vertices) - 2 for p in me.polygons)
    return n


def export(o, path):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
    )


def showcase(path):
    """Render pratinjau (EEVEE) komposisi aset: bukti visual kualitas, bukan bagian runtime."""
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    sc.render.filepath = path
    sc.view_settings.view_transform = "AgX"
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.011, 0.014, 1)
    sc.world = w
    # lantai
    P = palette()
    floor = box("floor", (2400, 1600, 2), (0, 300, -1), mat("floor", (0.11, 0.1, 0.09), 0.9), 0)
    # pencahayaan studio: key hangat, fill dingin, rim dari belakang panggung
    for rot, col, strength in (((math.radians(48), 0, math.radians(32)), (1.0, 0.86, 0.66), 3.2), ((math.radians(62), 0, math.radians(-120)), (0.62, 0.74, 1.0), 1.6), ((math.radians(110), 0, math.radians(200)), (1.0, 0.8, 0.9), 2.4)):
        bpy.ops.object.light_add(type="SUN")
        L = bpy.context.active_object
        L.data.energy, L.data.color, L.data.angle = strength, col, math.radians(4)
        L.rotation_euler = rot
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.05, 0.065, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.8
    bpy.ops.object.camera_add(location=(260, -520, 190))
    cam = bpy.context.active_object
    cam.rotation_euler = (Vector((0, 40, 70)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 28
    sc.camera = cam
    bpy.ops.render.render(write_still=True)


def main():
    reset()
    os.makedirs(OUT, exist_ok=True)
    P = palette()
    built = {}
    for name, fn in ASSETS:
        if ONLY and name not in ONLY:
            continue
        o = fn(P)
        o.name = name
        o.location = (0, 0, 0)
        built[name] = o
        path = os.path.abspath(os.path.join(OUT, f"{name}.glb"))
        export(o, path)
        kb = os.path.getsize(path) / 1024
        print(f"ASSET {name:12s} tris={tri_count(o):6d} size={kb:7.1f}KB -> {path}")
    if RENDER:
        os.makedirs(RENDER, exist_ok=True)
        # susun komposisi: panggung di belakang, kursi/barikade/dll di depan
        if "stage" in built:
            built["stage"].location = (0, 220, 0)
        pos = {"barricade": (0, 40, 0), "tower": (-260, 120, 0), "foh": (0, -120, 0), "tent_bar": (-240, -150, 0), "tent_medic": (240, -150, 0), "tent_merch": (330, 40, 0), "toilet": (-330, 40, 0), "gate": (0, -330, 0)}
        for n, loc in pos.items():
            if n in built:
                built[n].location = loc
        if "seat" in built:
            for i in range(7):
                if i == 0:
                    built["seat"].location = (-60, -230, 0)
                else:
                    d = built["seat"].copy()
                    d.data = built["seat"].data
                    bpy.context.scene.collection.objects.link(d)
                    d.location = (-60 + i * 20, -230, 0)
        if "person" in built:
            random.seed(3)
            for i in range(60):
                d = built["person"].copy()
                d.data = built["person"].data
                bpy.context.scene.collection.objects.link(d)
                d.location = (random.uniform(-120, 120), random.uniform(-100, -10), 0)
                d.rotation_euler.z = random.uniform(0, 6.28)
        showcase(os.path.abspath(os.path.join(RENDER, "showcase.png")))
        print("RENDER", os.path.abspath(os.path.join(RENDER, "showcase.png")))


main()
