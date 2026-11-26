# Turkey Trouble: the things that move. Every model is made by this code (no downloads, no asset packs).
#   blender -b --factory-startup --python build/models.py -- <out_dir>
# Writes <out_dir>/models.glb with root nodes: pickup, tractor_wagon, grain_truck, dog, log, pumpkin, net, feather.
# Conventions: meters, Blender Z up, models face Blender -Y (three.js +z after the Y-up export), origin on the ground at
# the middle, children have their origin at their joint or axle and carry only a translation.
# Ambient occlusion (plus mud / rust / coat colour) is baked by Cycles into vertex colours (COLOR_0).
# Also saves a preview .blend into the scratch folder for models_preview.py.
import bpy, bmesh, sys, os, math, time, random, struct, json
import numpy as np
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = ARGS[0] if ARGS else os.path.join(HERE, '..', 'assets')
SCRATCH = r'C:\Users\lilli\Projects\turkey-work\models'
os.makedirs(OUT, exist_ok=True)
os.makedirs(SCRATCH, exist_ok=True)
T0 = time.time()
random.seed(7)


def say(*a):
    print(f'[models {time.time() - T0:6.1f}s]', *a, flush=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
COLL = scene.collection


def use_gpu():
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for kind in ('OPTIX', 'CUDA'):
            try:
                prefs.compute_device_type = kind
                if hasattr(prefs, 'refresh_devices'):
                    prefs.refresh_devices()
                else:
                    prefs.get_devices()
                found = [d for d in prefs.devices if d.type == kind]
                if found:
                    for d in prefs.devices:
                        d.use = d.type == kind
                    scene.cycles.device = 'GPU'
                    return kind
            except Exception as e:
                say('device', kind, 'failed:', e)
    except Exception as e:
        say('no cycles prefs:', e)
    scene.cycles.device = 'CPU'
    return 'CPU'


say('device', use_gpu())

# ====================================================================== textures made here (numpy -> png)
def write_png(path, rgba):
    import zlib
    h, w = rgba.shape[:2]
    px = (np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8)
    raw = b''.join(b'\x00' + px[y].tobytes() for y in range(h))

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def save_png(name, rgba):
    path = os.path.join(SCRATCH, name + '.png')
    write_png(path, rgba)   # row 0 = top of the image
    im = bpy.data.images.load(path)
    im.name = name
    return im


def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def tex_grain(name, size, dark, light, streak=1.0, knots=True, seed=1):
    """Tileable grain along image x (u). Colours given as sRGB-ish tuples; pixels stored as display values."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    tau = 2 * np.pi / size
    warp = (5 * np.sin(x * tau * 1 + 1.3) + 3 * np.sin(x * tau * 3 + y * tau * 1) + 1.5 * np.sin(x * tau * 7 + y * tau * 2))
    v = (y + warp) * tau
    g = 0.5 + 0.5 * np.sin(v * 23 * streak) * 0.6 + 0.4 * np.sin(v * 61 * streak + np.sin(x * tau * 2) * 2)
    fine = np.zeros_like(g)
    for k in (89, 131, 197):
        ph = rng.uniform(0, 6.28)
        fine += np.sin(v * k + ph + np.sin(x * tau * 5 + ph) * 0.7)
    g = np.clip(g * 0.7 + 0.3 * (0.5 + 0.5 * fine / 3), 0, 1)
    if knots:
        for _ in range(3):
            cx, cy = rng.uniform(0, size, 2)
            dx = np.minimum(np.abs(x - cx), size - np.abs(x - cx)) / (size * 0.05)
            dy = np.minimum(np.abs(y - cy), size - np.abs(y - cy)) / (size * 0.02)
            d = np.sqrt(dx * dx + dy * dy)
            g = np.where(d < 1, g * (0.45 + 0.55 * d), g)
    dark = np.array(dark, np.float32)
    light = np.array(light, np.float32)
    rgb = dark[None, None, :] * (1 - g[..., None]) + light[None, None, :] * g[..., None]
    out = np.ones((size, size, 4), np.float32)
    out[..., :3] = rgb
    return save_png(name, out)


def tex_net(name, size=128, cells=8):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / size * cells
    a = np.abs(((x + y) % 1.0) - 0.5)
    b = np.abs(((x - y) % 1.0) - 0.5)
    line = np.maximum(np.clip((0.06 - (0.5 - a)) / 0.06 + 1, 0, 1) * 0, 0)
    t = 0.075
    on = ((0.5 - a) < t) | ((0.5 - b) < t)
    out = np.zeros((size, size, 4), np.float32)
    out[..., 0], out[..., 1], out[..., 2] = 0.16, 0.15, 0.13
    out[..., 3] = on.astype(np.float32)
    return save_png(name, out)


def tex_feather(name, w=64, h=256):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    t = y / (h - 1)                       # 0 = tip (top row), 1 = quill end
    u = (x - (w - 1) / 2) / ((w - 1) / 2)  # -1..1 across
    # vane outline: rounded tip, widest at 35 percent, narrowing to the quill; quill only in the last 12 percent
    half = np.where(t < 0.88, np.sin(np.clip(t / 0.88, 0, 1) * np.pi) ** 0.55 * (1 - 0.25 * t), 0.0)
    half = half * (1 - 0.05 * np.sin(t * 40) * (np.abs(u) > 0.6))
    vane = np.abs(u) < half
    shaft = np.abs(u) < (0.06 + 0.04 * t)
    alpha = (vane | (shaft & (t < 0.99))).astype(np.float32)
    # bars: chevrons pointing to the tip
    bar = 0.5 + 0.5 * np.sin((t * 8.5 + np.abs(u) * 0.35) * 2 * np.pi)
    bar = np.clip((bar - 0.70) * 6, 0, 1)
    brown = np.array([0.20, 0.12, 0.06])
    pale = np.array([0.74, 0.64, 0.50])
    rgb = brown * (1 - bar[..., None]) + pale * bar[..., None]
    rgb = rgb * (0.85 + 0.15 * (1 - np.abs(u)))[..., None]
    tipw = np.clip((0.08 - t) / 0.08, 0, 1)[..., None]  # pale tip
    rgb = rgb * (1 - tipw) + np.array([0.85, 0.80, 0.70]) * tipw
    rgb = np.where(shaft[..., None], np.array([0.78, 0.72, 0.60]), rgb)
    out = np.zeros((h, w, 4), np.float32)
    out[..., :3] = rgb
    out[..., 3] = alpha
    return save_png(name, out)


# ====================================================================== materials
INFO = {}


def mat(name, color, rough=0.5, metal=0.0, emit=None, es=0.0, tex=None, alpha=False, double=False, coat=0.0,
        sheen=0.0, spec=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = es
    if coat:
        try:
            b.inputs['Coat Weight'].default_value = coat
            b.inputs['Coat Roughness'].default_value = 0.06
        except Exception as e:
            say('coat', e)
    if sheen:
        try:
            b.inputs['Sheen Weight'].default_value = sheen
            b.inputs['Sheen Roughness'].default_value = 0.5
        except Exception as e:
            say('sheen', e)
    if spec is not None:
        try:
            b.inputs['Specular IOR Level'].default_value = spec
        except Exception:
            pass
    m.use_backface_culling = not double
    INFO[name] = dict(color=color, tex=tex, alpha=alpha)
    build_graph(m, preview=True)
    return m


def build_graph(m, preview):
    nt = m.node_tree
    b = nt.nodes.get('Principled BSDF')
    for n in [n for n in nt.nodes if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL')]:
        nt.nodes.remove(n)
    info = INFO[m.name]
    src = None
    if info['tex'] is not None:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = info['tex']
        t.location = (-700, 200)
        src = t.outputs['Color']
        if info['alpha']:
            r = nt.nodes.new('ShaderNodeMath')
            r.operation = 'ROUND'
            nt.links.new(t.outputs['Alpha'], r.inputs[0])
            nt.links.new(r.outputs[0], b.inputs['Alpha'])
            try:
                m.blend_method = 'CLIP'
            except Exception:
                pass
    if preview:
        a = nt.nodes.new('ShaderNodeVertexColor')
        a.layer_name = 'Col'
        a.location = (-700, -100)
        mul = nt.nodes.new('ShaderNodeVectorMath')
        mul.operation = 'MULTIPLY'
        mul.location = (-400, 0)
        if src is not None:
            nt.links.new(src, mul.inputs[0])
        else:
            mul.inputs[0].default_value = info['color']
        nt.links.new(a.outputs['Color'], mul.inputs[1])
        nt.links.new(mul.outputs[0], b.inputs['Base Color'])
    elif src is not None:
        nt.links.new(src, b.inputs['Base Color'])
    else:
        b.inputs['Base Color'].default_value = (*info['color'], 1)


TX_WOOD = tex_grain('tt_wood', 512, (0.22, 0.17, 0.12), (0.54, 0.46, 0.35), seed=3)
TX_STRAW = tex_grain('tt_straw', 256, (0.40, 0.31, 0.15), (0.80, 0.68, 0.42), streak=2.2, knots=False, seed=5)
TX_NET = tex_net('tt_net')
TX_BARK = tex_grain('tt_bark', 256, (0.06, 0.045, 0.032), (0.38, 0.31, 0.23), streak=1.7, knots=False, seed=9)
TX_FEATHER = tex_feather('tt_feather')

M = dict(
    paint=mat('paint', (0.34, 0.035, 0.03), rough=0.30, coat=0.5),
    glass=mat('glass', (0.012, 0.014, 0.016), rough=0.08, spec=0.6),
    chrome=mat('chrome', (0.80, 0.80, 0.80), rough=0.16, metal=1.0),
    steel=mat('steel', (0.42, 0.41, 0.40), rough=0.45, metal=0.85),
    trim=mat('trim', (0.035, 0.035, 0.035), rough=0.55),
    rubber=mat('rubber', (0.028, 0.027, 0.026), rough=0.72),
    wheel=mat('wheel', (0.62, 0.62, 0.60), rough=0.32, metal=0.9),
    rim=mat('rim_paint', (0.70, 0.63, 0.45), rough=0.35, coat=0.3),
    engine=mat('engine', (0.10, 0.10, 0.10), rough=0.5, metal=0.5),
    headlamp=mat('headlamp', (1.0, 0.93, 0.8), rough=0.1, emit=(1.0, 0.86, 0.62), es=6.0),
    taillamp=mat('taillamp', (0.5, 0.02, 0.01), rough=0.15, emit=(1.0, 0.06, 0.03), es=4.0),
    amber=mat('amber', (0.9, 0.42, 0.05), rough=0.15, emit=(1.0, 0.45, 0.05), es=0.6),
    wood=mat('wood', (1, 1, 1), rough=0.55, tex=TX_WOOD),
    straw=mat('straw', (1, 1, 1), rough=0.85, tex=TX_STRAW),
    twine=mat('twine', (0.55, 0.28, 0.07), rough=0.7),
    grain=mat('grain', (0.82, 0.52, 0.10), rough=0.8),
    fur=mat('fur', (1, 1, 1), rough=0.78, sheen=0.6),
    eye=mat('eye', (0.02, 0.012, 0.008), rough=0.05, spec=0.8),
    bark=mat('bark', (1, 1, 1), rough=0.6, tex=TX_BARK),
    logend=mat('logend', (1, 1, 1), rough=0.7),
    pumpkin=mat('pumpkin', (1, 1, 1), rough=0.42, coat=0.2),
    netting=mat('netting', (1, 1, 1), rough=0.8, tex=TX_NET, alpha=True, double=True),
    frame=mat('net_frame', (0.70, 0.71, 0.72), rough=0.35, metal=1.0),
    feather=mat('feather', (1, 1, 1), rough=0.7, tex=TX_FEATHER, alpha=True, double=True, sheen=0.4),
)

# ====================================================================== geometry helpers
def make_obj(name, verts, faces, m):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.update()
    o = bpy.data.objects.new(name, me)
    COLL.objects.link(o)
    if m is not None:
        me.materials.append(m)
    return o


def cleanup(o, recalc=True, merge=0.0004):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=merge * 0.5)
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()
    return o


def apply_mods(o):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    eo = o.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(eo, preserve_all_data_layers=True, depsgraph=dg)
    old = o.data
    o.modifiers.clear()
    o.data = me
    bpy.data.meshes.remove(old)
    return o


def smooth(o, deg=38):
    me = o.data
    for p in me.polygons:
        p.use_smooth = True
    try:
        me.set_sharp_from_angle(angle=math.radians(deg))
    except Exception as e:
        say('sharp-from-angle missing:', e)
    return o


def bevel(o, w, seg=2, angle=30):
    for p in o.data.polygons:
        p.use_smooth = True
    md = o.modifiers.new('bev', 'BEVEL')
    md.width = w
    md.segments = seg
    md.limit_method = 'ANGLE'
    md.angle_limit = math.radians(angle)
    md.use_clamp_overlap = True
    try:
        md.harden_normals = True
    except Exception:
        pass
    apply_mods(o)
    o['_hard'] = 1
    return o


def box(c, s, m, bev=0.0, seg=1, rz=0.0, rx=0.0, ry=0.0):
    sx, sy, sz = [v / 2 for v in s]
    verts = [(dx * sx, dy * sy, dz * sz) for dx in (-1, 1) for dy in (-1, 1) for dz in (-1, 1)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    o = make_obj('box', verts, faces, m)
    o.data.transform(Matrix.Translation(Vector(c)) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(ry, 4, 'Y'))
    cleanup(o)
    if bev > 0:
        bevel(o, bev, seg)
    return o


def beam(p0, p1, w, h, m, side=None, bev=0.0, seg=1):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    d.normalize()
    if side is None:
        side = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    side = Vector(side)
    s = (side - d * side.dot(d)).normalized()
    u = d.cross(s).normalized()
    verts = []
    for p in (p0, p1):
        for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(p + s * (a * w / 2) + u * (b * h / 2))
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    o = make_obj('beam', verts, faces, m)
    cleanup(o)
    if bev > 0:
        bevel(o, bev, seg)
    return o


def basis(axis):
    a = Vector(axis).normalized()
    ref = Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((0, 1, 0))
    b1 = a.cross(ref).normalized()
    b2 = a.cross(b1).normalized()
    return a, b1, b2


def revolve(profile, center, axis, segs, m, closed=False, phase=0.0, rfun=None, smooth_deg=50):
    a, b1, b2 = basis(axis)
    c = Vector(center)
    n = len(profile)
    verts = []
    for i in range(segs):
        t = phase + 2 * math.pi * i / segs
        ct, st = math.cos(t), math.sin(t)
        for (r, h) in profile:
            rr = r if rfun is None else rfun(r, h, t)
            verts.append(c + a * h + (b1 * ct + b2 * st) * rr)
    faces = []
    J = n if closed else n - 1
    for i in range(segs):
        i2 = (i + 1) % segs
        for j in range(J):
            j2 = (j + 1) % n
            faces.append((i * n + j, i2 * n + j, i2 * n + j2, i * n + j2))
    o = make_obj('rev', verts, faces, m)
    cleanup(o)
    smooth(o, smooth_deg)
    return o


def cyl(center, axis, r, L, segs, m, r2=None):
    r2 = r if r2 is None else r2
    return revolve([(0, -L / 2), (r, -L / 2), (r2, L / 2), (0, L / 2)], center, axis, segs, m, smooth_deg=40)


def loft(rings, m, cap=True, smooth_deg=40):
    n = len(rings[0])
    verts = [p for r in rings for p in r]
    faces = []
    for k in range(len(rings) - 1):
        for j in range(n):
            j2 = (j + 1) % n
            faces.append((k * n + j, k * n + j2, (k + 1) * n + j2, (k + 1) * n + j))
    if cap:
        faces.append(tuple(range(n)))
        faces.append(tuple((len(rings) - 1) * n + j for j in range(n)))
    o = make_obj('loft', verts, faces, m)
    cleanup(o)
    smooth(o, smooth_deg)
    return o


def ring(y, zb, zt, hwb, hwt=None, rb=0.03, rt=0.05, n=3, xc=0.0):
    hwt = hwb if hwt is None else hwt
    h = zt - zb
    rb = max(0.003, min(rb, h * 0.45, hwb * 0.9))
    rt = max(0.003, min(rt, h * 0.45, hwt * 0.9))
    pts = []

    def arc(cx, cz, r, a0, a1):
        for i in range(n + 1):
            a = a0 + (a1 - a0) * i / n
            pts.append(Vector((xc + cx + r * math.cos(a), y, cz + r * math.sin(a))))
    arc(hwb - rb, zb + rb, rb, -math.pi / 2, 0)
    arc(hwt - rt, zt - rt, rt, 0, math.pi / 2)
    arc(-(hwt - rt), zt - rt, rt, math.pi / 2, math.pi)
    arc(-(hwb - rb), zb + rb, rb, math.pi, 1.5 * math.pi)
    return pts


def arch_z(y, base, arches):
    z = base
    for cy, cz, r in arches:
        dy = y - cy
        if abs(dy) < r:
            z = max(z, cz + math.sqrt(r * r - dy * dy))
    return z


def stations(y0, y1, arches=(), coarse=0.22, fine=0.06):
    ys = [float(v) for v in np.linspace(y0, y1, max(2, int(abs(y1 - y0) / coarse) + 1))]
    for cy, cz, r in arches:
        a, b = max(y0, cy - r - 0.03), min(y1, cy + r + 0.03)
        if b > a:
            ys += [float(v) for v in np.linspace(a, b, max(2, int((b - a) / fine) + 1))]
    ys.sort()
    out = [ys[0]]
    for v in ys[1:]:
        if v - out[-1] > 0.012:
            out.append(v)
    if out[-1] != ys[-1]:
        out[-1] = ys[-1]
    return out


def smoothstep(a, b, x):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def cube_uv(o, scale=1.0, offset=(0.0, 0.0)):
    me = o.data
    uv = me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        n = p.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in p.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            if ax == 0:
                u, w = v.y, v.z
            elif ax == 1:
                u, w = v.x, v.z
            else:
                u, w = v.y, v.x
            uv.data[li].uv = (u * scale + offset[0], w * scale + offset[1])
    return o


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


# ====================================================================== nodes
MORG = {}


def emp(name, parent, origin):
    o = bpy.data.objects.new(name, None)
    COLL.objects.link(o)
    o.empty_display_size = 0.2
    MORG[name] = Vector(origin)
    if parent is not None:
        o.parent = parent
        o.location = Vector(origin) - MORG[parent.name]
    return o


def join(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


def node(parent, part, parts, origin):
    o = join(parts, f'{parent.name.split("|")[0]}|{part}' if '|' not in parent.name else f'{parent.name}|{part}')
    org = Vector(origin)
    o.data.transform(Matrix.Translation(-org))
    o.parent = parent
    o.location = org - MORG[parent.name]
    MORG[o.name] = org
    o['part'] = part
    return o


def lamp_empty(parent, name, pos):
    e = emp(f'{parent.name}|{name}', parent, pos)
    e['part'] = name
    e.empty_display_size = 0.05
    return e


# ====================================================================== wheels
def tire(center, R, Ri, W, side, segs, kind='road'):
    hw = W / 2
    mid = Ri + 0.45 * (R - Ri)
    if kind == 'road':
        prof = [(Ri, -hw * 0.78), (mid, -hw), (R - 0.028, -hw * 0.96), (R - 0.004, -hw * 0.78), (R, -hw * 0.3),
                (R, hw * 0.3), (R - 0.004, hw * 0.78), (R - 0.028, hw * 0.96), (mid, hw), (Ri, hw * 0.78)]
    elif kind == 'rib':
        prof = [(Ri, -hw * 0.8), (mid, -hw), (R - 0.03, -hw * 0.88), (R - 0.004, -hw * 0.55), (R - 0.016, -hw * 0.30),
                (R, -hw * 0.12), (R, hw * 0.12), (R - 0.016, hw * 0.30), (R - 0.004, hw * 0.55), (R - 0.03, hw * 0.88),
                (mid, hw), (Ri, hw * 0.8)]
    else:  # 'ag': carcass only, lugs added separately
        prof = [(Ri, -hw * 0.82), (mid, -hw), (R - 0.09, -hw * 0.95), (R - 0.045, -hw * 0.6),
                (R - 0.045, hw * 0.6), (R - 0.09, hw * 0.95), (mid, hw), (Ri, hw * 0.82)]
    prof = [(r, h * side) for r, h in prof]
    o = revolve(prof, center, (1, 0, 0), segs, M['rubber'], closed=True, smooth_deg=55)
    parts = [o]
    if kind == 'ag':
        c = Vector(center)
        nl = 18
        for i in range(nl):
            for half in (-1, 1):
                t0 = 2 * math.pi * (i + (0.5 if half > 0 else 0)) / nl
                t1 = t0 + 0.16
                rad0 = Vector((0, math.cos(t0), math.sin(t0)))
                rad1 = Vector((0, math.cos(t1), math.sin(t1)))
                p0 = c + Vector((half * 0.02 * side, 0, 0)) + rad0 * (R - 0.025)
                p1 = c + Vector((half * hw * 0.95 * side, 0, 0)) + rad1 * (R - 0.025)
                tang = Vector((0, -math.sin(t0), math.cos(t0)))
                parts.append(beam(p0, p1, 0.075, 0.05, M['rubber'], side=tang))
    return parts


def rim(center, Ri, W, side, segs, m, dish=0.0, hub=0.06, nuts=True):
    hw = W / 2
    prof = [(0.0, hw * (0.30 + dish)), (hub, hw * (0.30 + dish)), (hub + 0.03, hw * (0.04 + dish)),
            (Ri * 0.75, hw * (0.04 + dish)), (Ri * 0.92, hw * 0.55), (Ri * 1.035, hw * 0.80), (Ri * 0.97, hw * 0.66),
            (Ri * 0.97, -hw * 0.72), (0.0, -hw * 0.10)]
    prof = [(r, h * side) for r, h in prof]
    o = revolve(prof, center, (1, 0, 0), segs, m, closed=True, smooth_deg=35)
    parts = [o]
    if nuts:
        c = Vector(center)
        for k in range(5):
            t = 2 * math.pi * k / 5
            p = c + Vector((side * hw * (0.30 + dish), 0.0, 0.0)) + Vector((0, math.cos(t), math.sin(t))) * (hub + 0.025)
            parts.append(cyl(p + Vector((side * 0.008, 0, 0)), (1, 0, 0), 0.011, 0.02, 5, M['chrome']))
    return parts


def wheel_parts(center, R, Ri, W, side, segs=24, kind='road', rim_m=None, dish=0.0, hub=0.06, nuts=True):
    return tire(center, R, Ri, W, side, segs, kind) + rim(center, Ri, W, side, segs, rim_m or M['wheel'], dish, hub, nuts)


def band(c, s, m, rz=0.0):
    """A box with its two +-x faces removed: a strap (twine) around something. 8 triangles."""
    sx, sy, sz = [v / 2 for v in s]
    verts = [(dx * sx, dy * sy, dz * sz) for dx in (-1, 1) for dy in (-1, 1) for dz in (-1, 1)]
    faces = [(0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    o = make_obj('band', verts, faces, m)
    o.data.transform(Matrix.Translation(Vector(c)) @ Matrix.Rotation(rz, 4, 'Z'))
    return o


# ====================================================================== cab helpers
def greenhouse(P, y_pts, zb, hwb, hwt, glass_rings_n=3):
    rings = [ring(y, zb, zt, hwb, hwt, rb=0.004, rt=0.06, n=glass_rings_n) for y, zt in y_pts]
    P.append(loft(rings, M['glass'], smooth_deg=30))


# ====================================================================== PICKUP
def build_pickup():
    root = emp('pickup', None, (0, 0, 0))
    P = []
    R, Ri, W = 0.385, 0.20, 0.26
    AF, AR, TX = -1.75, 1.55, 0.795
    arch_r, arch_c = 0.475, 0.40
    arches = [(AF, arch_c, arch_r)]

    def ztop(y):
        return 1.035 + 0.085 * smoothstep(-2.66, -1.2, y) if y < -0.95 else 1.12

    rings = [ring(-2.705, 0.52, 1.0, 0.86, 0.85, rb=0.03, rt=0.05), ring(-2.69, 0.48, 1.022, 0.905, 0.895, rb=0.035, rt=0.07)]
    for y in stations(-2.665, 0.655, arches, coarse=0.26, fine=0.075):
        zb = arch_z(y, 0.45, arches)
        rings.append(ring(y, zb, ztop(y), 0.92, 0.912, rb=0.035, rt=0.075))
    rings += [ring(0.672, 0.46, 1.11, 0.906, 0.898, rb=0.03, rt=0.06), ring(0.685, 0.49, 1.09, 0.88, 0.87, rb=0.03, rt=0.05)]
    P.append(loft(rings, M['paint']))
    # greenhouse (glass), roof, pillars
    greenhouse(P, [(-0.955, 1.13), (-0.80, 1.36), (-0.62, 1.62), (-0.46, 1.82), (-0.38, 1.85), (0.50, 1.86),
                   (0.585, 1.835), (0.615, 1.70), (0.63, 1.13)], 1.105, 0.885, 0.775)
    P.append(loft([ring(y, 1.815, 1.895, 0.79, 0.755, rb=0.01, rt=0.04) for y in (-0.42, -0.40, 0.50, 0.58, 0.60)],
                  M['paint']))
    for s in (1, -1):
        P.append(beam((s * 0.878, -0.94, 1.12), (s * 0.772, -0.43, 1.84), 0.075, 0.045, M['paint'], side=(0, 1, 0), bev=0.008))
        P.append(beam((s * 0.88, 0.60, 1.11), (s * 0.772, 0.57, 1.85), 0.12, 0.045, M['paint'], side=(0, 1, 0), bev=0.008))
        P.append(beam((s * 0.88, -0.30, 1.115), (s * 0.88, 0.58, 1.115), 0.012, 0.03, M['chrome']))   # belt molding
        # door seams + handle
        for yy in (-0.93, 0.585):
            P.append(beam((s * 0.921, yy, 0.47), (s * 0.921, yy, 1.105), 0.006, 0.008, M['trim']))
        P.append(beam((s * 0.921, -0.93, 0.47), (s * 0.921, 0.585, 0.47), 0.006, 0.008, M['trim']))
        P.append(box((s * 0.926, 0.42, 1.02), (0.014, 0.14, 0.032), M['chrome'], bev=0.004))
        # mirror
        P.append(beam((s * 0.90, -0.84, 1.15), (s * 0.965, -0.82, 1.24), 0.03, 0.03, M['trim']))
        P.append(box((s * 0.972, -0.80, 1.30), (0.055, 0.05, 0.20), M['trim'], bev=0.012))
        P.append(box((s * 0.972, -0.826, 1.30), (0.045, 0.004, 0.18), M['chrome']))
        # bed side wall with arch
        ysb = stations(0.76, 2.68, [(AR, arch_c, arch_r)], coarse=0.3, fine=0.08)
        P.append(loft([ring(y, arch_z(y, 0.50, [(AR, arch_c, arch_r)]), 1.12, 0.032, 0.032, rb=0.008, rt=0.028, n=1,
                            xc=s * 0.888) for y in ysb], M['paint']))
        P.append(box((s * 0.74, AR, 0.86), (0.25, 0.92, 0.28), M['trim'], bev=0.08, seg=2))       # wheel well hump
        P.append(box((s * 0.889, 2.695, 0.93), (0.055, 0.02, 0.28), M['taillamp'], bev=0.006))   # tail lamp
        P.append(box((s * 0.72, -2.708, 0.86), (0.27, 0.02, 0.15), M['headlamp'], bev=0.006))    # headlamp
        P.append(box((s * 0.72, -2.698, 0.86), (0.31, 0.02, 0.19), M['chrome'], bev=0.006))
        P.append(box((s * 0.895, -2.64, 0.86), (0.04, 0.10, 0.15), M['amber'], bev=0.006))      # corner lamp
        P.append(box((s * 0.923, 2.55, 0.98), (0.01, 0.05, 0.03), M['taillamp']))                # side marker
        P.append(box((s * 0.45, 0.0, 0.36), (0.08, 5.0, 0.15), M['trim']))                        # frame rail
        P.append(beam((s * 0.45, AF, 0.40), (s * 0.70, AF, 0.385), 0.05, 0.05, M['trim']))         # steering arm
        P.append(box((s * 0.25, AR, 0.30), (0.08, 1.2, 0.04), M['steel']))                        # leaf spring
    # bed floor, front wall, tailgate
    P.append(box((0, 1.71, 0.69), (1.72, 1.86, 0.06), M['trim']))
    P.append(box((0, 0.77, 0.84), (1.84, 0.06, 0.58), M['paint'], bev=0.012))
    P.append(box((0, 2.655, 0.82), (1.72, 0.05, 0.58), M['paint'], bev=0.012))
    P.append(box((0, 2.683, 1.03), (0.22, 0.012, 0.05), M['trim']))
    # grille and bumpers
    P.append(box((0, -2.708, 0.86), (0.98, 0.03, 0.30), M['trim'], bev=0.01))
    for z in (0.79, 0.86, 0.93):
        P.append(box((0, -2.722, z), (0.92, 0.012, 0.018), M['chrome']))
    P.append(box((0, -2.712, 1.01), (1.70, 0.02, 0.025), M['chrome']))
    P.append(box((0, -2.735, 0.52), (1.90, 0.13, 0.22), M['chrome'], bev=0.03, seg=2))
    P.append(box((0, -2.67, 0.40), (1.66, 0.08, 0.10), M['trim'], bev=0.01))
    P.append(box((0, 2.75, 0.50), (1.86, 0.12, 0.18), M['chrome'], bev=0.025, seg=2))
    P.append(box((0, 2.81, 0.50), (0.30, 0.005, 0.15), M['trim']))
    P.append(box((0, 2.76, 0.39), (0.07, 0.14, 0.07), M['trim'], bev=0.006))
    # windshield wipers, cowl
    for x in (-0.25, 0.35):
        P.append(beam((x - 0.25, -0.90, 1.16), (x + 0.20, -0.86, 1.19), 0.02, 0.01, M['trim'], side=(0, -0.4, 1)))
    # axles, exhaust, under-cab
    P.append(cyl((0, AR, 0.385), (1, 0, 0), 0.045, 1.45, 10, M['trim']))
    P.append(revolve([(0, -0.14), (0.12, -0.09), (0.14, 0.0), (0.12, 0.08), (0, 0.11)], (0, AR, 0.385), (0, 1, 0), 12, M['trim']))
    P.append(box((0, AF, 0.40), (1.35, 0.10, 0.08), M['trim']))
    P.append(cyl((-0.55, 2.62, 0.33), (0, 1, 0), 0.035, 0.40, 10, M['steel']))
    P.append(box((0.55, 1.0, 0.36), (0.42, 0.55, 0.22), M['trim'], bev=0.03))  # fuel tank
    body = node(root, 'body', P, (0, 0, 0))
    wheels = {}
    for nm, x, y, s in (('wheel_fl', TX, AF, 1), ('wheel_fr', -TX, AF, -1), ('wheel_rl', TX, AR, 1), ('wheel_rr', -TX, AR, -1)):
        wheels[nm] = node(root, nm, wheel_parts((x, y, R), R, Ri, W, s, segs=20, kind='road', dish=0.15), (x, y, R))
    for s, l in ((1, 'l'), (-1, 'r')):
        lamp_empty(root, f'headlight_{l}', (s * 0.72, -2.72, 0.86))
        lamp_empty(root, f'taillight_{l}', (s * 0.889, 2.71, 0.93))
    return root



def grain_heap():
    """A mounded load of shelled corn inside the grain box."""
    nx, ny = 9, 17
    x0, x1, y0, y1 = -1.15, 1.15, -0.76, 4.46
    verts, faces = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            y = y0 + (y1 - y0) * j / ny
            u, v = (x / 1.15), ((y - 1.85) / 2.61)
            h = 1.98 + 0.30 * max(0.0, 1 - u * u) * max(0.0, 1 - v * v) ** 0.7 + 0.025 * math.sin(x * 7 + y * 3) * math.sin(y * 5)
            verts.append((x, y, h))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    o = make_obj('grain', verts, faces, M['grain'])
    cleanup(o)
    smooth(o, 80)
    return o


# ====================================================================== GRAIN TRUCK
def build_grain_truck():
    root = emp('grain_truck', None, (0, 0, 0))
    P = []
    R, Ri, W = 0.50, 0.29, 0.27
    AF, AR = -3.10, 2.15
    # hood
    rings = [ring(-4.415, 1.03, 1.62, 0.46, 0.40, rb=0.02, rt=0.10), ring(-4.40, 1.0, 1.655, 0.52, 0.46, rb=0.02, rt=0.14)]
    for y in stations(-4.37, -2.55, coarse=0.25):
        rings.append(ring(y, 1.0, 1.66 + 0.10 * smoothstep(-4.4, -2.6, y), 0.53, 0.47, rb=0.02, rt=0.15))
    P.append(loft(rings, M['paint']))
    for s in (1, -1):
        for k in range(4):       # hood side louvres
            P.append(beam((s * 0.531, -3.10 + k * 0.09, 1.20), (s * 0.531, -3.10 + k * 0.09, 1.45), 0.006, 0.01, M['trim']))
        # front fender
        def zt(y):
            dy = y - AF
            return max(0.50 + math.sqrt(max(0, 0.76 ** 2 - dy * dy)), 1.06 if y < AF else 0.95)

        def zb(y):
            dy = y - AF
            return max(0.50 + math.sqrt(max(0, 0.62 ** 2 - dy * dy)), 0.80 if y < AF else 0.86)
        fr = [ring(-4.39, zb(-4.37) + 0.02, zt(-4.37) - 0.03, 0.24, 0.22, rb=0.03, rt=0.08, n=2, xc=s * 0.86)]
        for y in stations(-4.37, -2.52, [(AF, 0.5, 0.78)], coarse=0.3, fine=0.11):
            fr.append(ring(y, zb(y), zt(y), 0.27, 0.25, rb=0.02, rt=0.10, n=2, xc=s * 0.86))
        P.append(loft(fr, M['paint']))
        P.append(box((s * 0.60, AF, 0.95), (0.10, 1.6, 0.30), M['trim']))                           # splash apron
        # headlamp pods on the fenders
        P.append(revolve([(0, -4.25), (0.10, -4.27), (0.115, -4.36), (0.11, -4.41), (0, -4.405)], (s * 0.84, 0, 1.17),
                         (0, 1, 0), 16, M['chrome']))
        P.append(revolve([(0, -4.418), (0.088, -4.415), (0.088, -4.405), (0, -4.40)], (s * 0.84, 0, 1.17), (0, 1, 0), 16,
                         M['headlamp']))
        P.append(beam((s * 0.84, -4.30, 1.05), (s * 0.84, -4.30, 1.12), 0.04, 0.04, M['trim']))
        # running board, mirrors, door seams
        P.append(box((s * 0.98, -1.80, 0.83), (0.30, 1.50, 0.05), M['steel'], bev=0.01))
        P.append(box((s * 1.20, -2.40, 2.08), (0.04, 0.16, 0.36), M['trim'], bev=0.01))
        P.append(box((s * 1.20, -2.42, 2.08), (0.03, 0.005, 0.32), M['chrome']))
        for zz in (1.88, 2.26):
            P.append(beam((s * 0.99, -2.42, zz - 0.04), (s * 1.19, -2.40, zz), 0.02, 0.02, M['steel']))
        for yy in (-2.40, -1.12):
            P.append(beam((s * 1.001, yy, 0.87), (s * 1.001, yy, 1.77), 0.006, 0.008, M['trim']))
        P.append(box((s * 1.006, -1.30, 1.68), (0.014, 0.14, 0.03), M['chrome'], bev=0.004))
        # cab pillars
        P.append(beam((s * 0.975, -2.53, 1.77), (s * 0.865, -2.10, 2.60), 0.08, 0.05, M['paint'], side=(0, 1, 0), bev=0.008))
        P.append(beam((s * 0.98, -1.10, 1.77), (s * 0.865, -1.11, 2.61), 0.12, 0.05, M['paint'], side=(0, 1, 0), bev=0.008))
        # frame
        P.append(box((s * 0.45, 0.0, 0.82), (0.10, 9.0, 0.22), M['trim']))
        P.append(box((s * 0.30, AR, 0.62), (0.08, 1.4, 0.06), M['steel']))
        # mud flaps, tail lamps
        P.append(box((s * 1.0, AR + 0.62, 0.68), (0.40, 0.015, 0.55), M['rubber']))
        P.append(box((s * 0.95, 4.585, 0.95), (0.18, 0.03, 0.10), M['taillamp'], bev=0.006))
        # grain box side boards (wood) and stakes
        for z0, z1 in ((1.33, 1.67), (1.70, 2.04), (2.07, 2.41)):
            b = box((s * 1.185, 1.85, (z0 + z1) / 2), (0.05, 5.30, z1 - z0), M['wood'], bev=0.008, seg=1)
            cube_uv(b, 0.5, (random.random(), random.random()))
            P.append(b)
        for yy in (-0.78, 0.53, 1.85, 3.17, 4.48):
            P.append(box((s * 1.228, yy, 1.86), (0.04, 0.08, 1.14), M['steel'], bev=0.006))
        P.append(box((s * 1.20, 1.85, 2.43), (0.10, 5.34, 0.035), M['steel'], bev=0.006))
    # cab
    rings = [ring(-2.565, 0.88, 1.76, 0.96, 0.95, rb=0.03, rt=0.04)]
    for y in stations(-2.55, -1.07, coarse=0.3):
        rings.append(ring(y, 0.86, 1.78, 1.0, 0.99, rb=0.04, rt=0.06))
    rings.append(ring(-1.055, 0.88, 1.765, 0.975, 0.965, rb=0.03, rt=0.04))
    P.append(loft(rings, M['paint']))
    greenhouse(P, [(-2.55, 1.79), (-2.40, 2.06), (-2.22, 2.40), (-2.10, 2.585), (-2.04, 2.615), (-1.16, 2.625),
                   (-1.10, 2.59), (-1.075, 2.40), (-1.065, 1.79)], 1.755, 0.985, 0.865)
    P.append(loft([ring(y, 2.575, 2.665, 0.88, 0.85, rb=0.01, rt=0.04) for y in (-2.08, -2.06, -1.14, -1.10, -1.085)],
                  M['paint']))
    for x in (-0.25, 0.0, 0.25):
        P.append(box((x, -2.07, 2.68), (0.07, 0.04, 0.035), M['amber'], bev=0.006))
    for x in (-0.30, 0.30):
        P.append(beam((x - 0.28, -2.52, 1.81), (x + 0.22, -2.50, 1.85), 0.02, 0.01, M['trim'], side=(0, -0.5, 1)))
    # grille
    P.append(box((0, -4.41, 1.32), (0.98, 0.05, 0.62), M['paint'], bev=0.02))
    P.append(box((0, -4.432, 1.32), (0.82, 0.02, 0.52), M['trim'], bev=0.006))
    for k in range(9):
        P.append(box((-0.36 + k * 0.09, -4.445, 1.32), (0.022, 0.012, 0.50), M['chrome']))
    P.append(box((0, -4.53, 0.70), (2.30, 0.14, 0.24), M['steel'], bev=0.02, seg=2))
    P.append(box((0, -4.30, 0.82), (0.90, 0.25, 0.32), M['engine'], bev=0.02))
    P.append(cyl((0, AF, 0.50), (1, 0, 0), 0.05, 1.75, 10, M['trim']))
    # fuel tank, exhaust stack
    P.append(cyl((0.80, -0.35, 0.72), (0, 1, 0), 0.24, 1.0, 14, M['steel']))
    for yy in (-0.70, 0.0):
        P.append(revolve([(0.0, -0.035), (0.248, -0.035), (0.248, 0.035), (0.0, 0.035)], (0.80, yy, 0.72), (0, 1, 0), 14, M['trim']))
    P.append(revolve([(0, 0.95), (0.06, 0.95), (0.06, 1.30), (0.09, 1.36), (0.09, 2.05), (0.06, 2.11), (0.06, 3.16), (0, 3.16)],
                     (-0.80, -0.92, 0), (0, 0, 1), 14, M['steel']))
    P.append(box((-0.80, -0.92, 3.17), (0.15, 0.15, 0.012), M['steel'], rx=math.radians(-20)))
    # grain box floor, headboard, endgate
    P.append(box((0, 1.85, 1.265), (2.44, 5.40, 0.12), M['steel'], bev=0.01))
    for yy in np.linspace(-0.6, 4.3, 8):
        P.append(box((0, float(yy), 1.16), (2.30, 0.08, 0.09), M['trim']))
    for z0, z1 in ((1.33, 1.67), (1.70, 2.04), (2.07, 2.41)):
        for yy in (-0.80, 4.50):
            b = box((0, yy, (z0 + z1) / 2), (2.32, 0.05, z1 - z0), M['wood'], bev=0.008, seg=1)
            cube_uv(b, 0.5, (random.random(), random.random()))
            P.append(b)
    P.append(box((0, -0.80, 2.43), (2.40, 0.10, 0.035), M['steel']))
    P.append(box((0, 4.50, 2.43), (2.40, 0.10, 0.035), M['steel']))
    P.append(grain_heap())
    P.append(box((0, 4.535, 1.58), (0.42, 0.02, 0.32), M['steel'], bev=0.006))
    for x in (-0.9, 0.9):
        P.append(box((x, 4.535, 1.86), (0.06, 0.03, 1.10), M['steel']))
    P.append(box((0, 4.52, 0.95), (2.20, 0.10, 0.10), M['steel']))
    P.append(cyl((0, AR, 0.50), (1, 0, 0), 0.07, 1.75, 12, M['trim']))
    P.append(revolve([(0, -0.20), (0.20, -0.12), (0.22, 0.0), (0.18, 0.12), (0, 0.16)], (0, AR, 0.50), (0, 1, 0), 14, M['trim']))
    node(root, 'body', P, (0, 0, 0))
    TXF = 0.955
    for nm, x, s in (('wheel_fl', TXF, 1), ('wheel_fr', -TXF, -1)):
        node(root, nm, wheel_parts((x, AF, R), R, Ri, W, s, segs=20, kind='rib', dish=0.25, hub=0.09), (x, AF, R))
    for nm, s in (('wheel_rl', 1), ('wheel_rr', -1)):
        xo, xi = s * 1.12, s * 0.85
        parts = wheel_parts((xo, AR, R), R, Ri, W - 0.01, s, segs=18, kind='road', dish=0.25, hub=0.09)
        parts += tire((xi, AR, R), R, Ri, W - 0.01, s, 18, 'road')
        parts.append(revolve([(0, -0.12 * s), (Ri * 0.97, -0.12 * s), (Ri * 0.97, 0.12 * s), (0, 0.12 * s)], (xi, AR, R), (1, 0, 0), 18, M['wheel']))
        node(root, nm, parts, (s * 0.985, AR, R))
    for s, l in ((1, 'l'), (-1, 'r')):
        lamp_empty(root, f'headlight_{l}', (s * 0.84, -4.42, 1.17))
        lamp_empty(root, f'taillight_{l}', (s * 0.95, 4.60, 0.95))
    return root


# ====================================================================== TRACTOR + WAGON
def build_tractor_wagon():
    root = emp('tractor_wagon', None, (0, 0, 0))
    RA, RF = -2.10, -4.22
    tractor = emp('tractor_wagon|tractor', root, (0, RA, 0))
    tractor['part'] = 'tractor'
    P = []
    # hood
    rings = [ring(-4.63, 1.01, 1.45, 0.25, 0.21, rb=0.02, rt=0.08), ring(-4.615, 0.985, 1.475, 0.29, 0.255, rb=0.02, rt=0.11)]
    for y in stations(-4.59, -2.78, coarse=0.25):
        rings.append(ring(y, 0.98, 1.48 + 0.04 * smoothstep(-4.6, -2.8, y), 0.30, 0.265, rb=0.02, rt=0.12))
    P.append(loft(rings, M['paint']))
    P.append(box((0, -4.645, 1.22), (0.42, 0.02, 0.40), M['trim'], bev=0.006))
    for k in range(7):
        P.append(box((-0.18 + k * 0.06, -4.655, 1.22), (0.018, 0.012, 0.38), M['rim']))
    P.append(box((0, -2.77, 1.30), (0.58, 0.05, 0.34), M['paint'], bev=0.015))     # dash
    P.append(revolve([(0, 0.0), (0.035, 0.0), (0.035, 0.012), (0, 0.012)], (0.12, -2.798, 1.36), (0, 1, 0), 10, M['chrome']))
    P.append(revolve([(0, 0.0), (0.035, 0.0), (0.035, 0.012), (0, 0.012)], (-0.12, -2.798, 1.36), (0, 1, 0), 10, M['chrome']))
    # engine + front axle
    P.append(box((0, -3.70, 0.76), (0.42, 1.55, 0.44), M['engine'], bev=0.03))
    P.append(cyl((0.24, -3.55, 0.70), (0, 0, 1), 0.05, 0.16, 10, M['engine']))
    P.append(beam((-0.24, -4.2, 0.92), (-0.24, -3.3, 0.92), 0.06, 0.08, M['steel']))
    P.append(box((0, RF, 0.52), (0.36, 0.40, 0.26), M['engine'], bev=0.02))
    P.append(box((0, RF, 0.36), (1.16, 0.10, 0.10), M['paint'], bev=0.015))
    for s in (1, -1):
        P.append(cyl((s * 0.56, RF, 0.36), (0, 0, 1), 0.035, 0.18, 8, M['steel']))
    P.append(box((0, -4.70, 0.62), (0.50, 0.12, 0.22), M['engine'], bev=0.02))        # front weight
    # transmission, rear housing
    P.append(box((0, -2.40, 0.82), (0.60, 1.10, 0.52), M['paint'], bev=0.04))
    P.append(cyl((0, RA, 0.78), (1, 0, 0), 0.30, 0.64, 16, M['paint']))
    for s in (1, -1):
        P.append(revolve([(0, 0.30 * s), (0.16, 0.30 * s), (0.09, 0.74 * s), (0, 0.74 * s)], (0, RA, 0.78), (1, 0, 0), 16, M['paint']))
        # rear fender: a curved band over the tyre
        fr = []
        for i in range(15):
            a = 0.05 + (2.45 - 0.05) * i / 14
            sec = [(0.66, 0.845), (1.14, 0.845), (1.16, 0.865), (1.16, 0.885), (1.14, 0.895), (0.66, 0.875)]
            fr.append([Vector((s * x, RA + r * math.cos(a), 0.78 + r * math.sin(a))) for x, r in sec])
        P.append(loft(fr, M['paint']))
        P.append(box((s * 0.68, -2.08, 1.1), (0.03, 1.1, 0.6), M['paint']))     # fender inner panel
        P.append(box((s * 0.50, -2.70, 0.66), (0.38, 0.62, 0.03), M['steel'], bev=0.006))   # foot plate
        P.append(box((s * 0.93, RA + 0.88, 0.86), (0.07, 0.03, 0.07), M['taillamp']))
        # lower links
        P.append(beam((s * 0.30, -1.95, 0.56), (s * 0.40, -1.35, 0.40), 0.05, 0.08, M['steel']))
        # headlamps
        P.append(revolve([(0, -4.36), (0.07, -4.38), (0.08, -4.46), (0, -4.47)], (s * 0.34, 0, 1.26), (0, 1, 0), 14, M['paint']))
        P.append(revolve([(0, -4.475), (0.068, -4.472), (0.068, -4.462), (0, -4.46)], (s * 0.34, 0, 1.26), (0, 1, 0), 14, M['headlamp']))
        P.append(beam((s * 0.30, -4.40, 1.26), (s * 0.34, -4.40, 1.26), 0.03, 0.03, M['steel']))
    P.append(beam((0, -1.85, 1.05), (0, -1.40, 0.86), 0.05, 0.06, M['steel']))
    P.append(box((0, -1.55, 0.46), (0.12, 0.70, 0.04), M['steel']))           # drawbar
    P.append(cyl((0, -1.25, 0.46), (0, 0, 1), 0.02, 0.14, 8, M['steel']))
    # seat
    P.append(beam((0, -1.98, 1.02), (0, -1.80, 1.27), 0.06, 0.06, M['steel']))
    P.append(box((0, -1.78, 1.30), (0.44, 0.40, 0.07), M['rubber'], bev=0.03))
    P.append(beam((0, -1.60, 1.30), (0, -1.53, 1.60), 0.42, 0.05, M['rubber'], side=(1, 0, 0), bev=0.02))
    # steering column + wheel
    c0, c1 = Vector((0, -2.80, 1.40)), Vector((0, -2.36, 1.74))
    P.append(beam(c0, c1, 0.04, 0.04, M['trim']))
    ax = (c1 - c0).normalized()
    P.append(revolve([(0.20 + 0.018 * math.cos(a), 0.018 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 6, endpoint=False)],
                     c1, ax, 22, M['rubber'], closed=True))
    a_, b1, b2 = basis(ax)
    for k in range(3):
        t = 2 * math.pi * k / 3 + 0.5
        P.append(beam(c1, c1 + (b1 * math.cos(t) + b2 * math.sin(t)) * 0.19, 0.015, 0.012, M['trim']))
    # exhaust stack + air cleaner
    P.append(revolve([(0, 1.45), (0.045, 1.45), (0.045, 1.66), (0.068, 1.71), (0.068, 2.04), (0.045, 2.09), (0.045, 2.32),
                      (0, 2.32)], (-0.14, -4.18, 0), (0, 0, 1), 12, M['engine']))
    P.append(box((-0.14, -4.18, 2.33), (0.10, 0.10, 0.008), M['engine'], rx=math.radians(25)))
    P.append(revolve([(0, 1.47), (0.03, 1.47), (0.03, 1.60), (0.065, 1.62), (0.065, 1.76), (0, 1.79)], (0.13, -4.30, 0),
                     (0, 0, 1), 12, M['steel']))
    node(tractor, 'body', P, (0, RA, 0))
    for nm, x, s in (('wheel_fl', 0.62, 1), ('wheel_fr', -0.62, -1)):
        node(tractor, nm, wheel_parts((x, RF, 0.36), 0.36, 0.20, 0.16, s, segs=18, kind='rib', rim_m=M['rim'], dish=0.2, hub=0.05, nuts=False),
             (x, RF, 0.36))
    for nm, x, s in (('wheel_rl', 0.92, 1), ('wheel_rr', -0.92, -1)):
        node(tractor, nm, wheel_parts((x, RA, 0.78), 0.78, 0.38, 0.40, s, segs=26, kind='ag', rim_m=M['rim'], dish=0.0, hub=0.10, nuts=False),
             (x, RA, 0.78))
    for s, l in ((1, 'l'), (-1, 'r')):
        lamp_empty(tractor, f'headlight_{l}', (s * 0.34, -4.48, 1.26))
        lamp_empty(tractor, f'taillight_{l}', (s * 0.93, RA + 0.90, 0.86))

    # ---------------- wagon
    HY = -1.25
    wagon = emp('tractor_wagon|wagon', root, (0, HY, 0))
    wagon['part'] = 'wagon'
    P = []
    WF, WR = 0.55, 4.05
    for i in range(10):
        x = -1.08 + i * 0.24
        b = box((x, 2.35, 0.995), (0.232, 4.90, 0.05), M['wood'], bev=0.006, seg=1)
        cube_uv(b, 0.5, (random.random(), random.random()))
        P.append(b)
    for s in (1, -1):
        b = box((s * 1.18, 2.35, 1.06), (0.05, 4.90, 0.09), M['wood'], bev=0.006, seg=1)
        cube_uv(b, 0.5, (random.random(), random.random()))
        P.append(b)
        P.append(box((s * 0.55, 2.35, 0.90), (0.10, 4.80, 0.12), M['steel']))
        # front hay rack posts
        b = box((s * 1.10, -0.06, 1.86), (0.08, 0.08, 1.70), M['wood'], bev=0.006, seg=1)
        cube_uv(b, 0.5, (random.random(), random.random()))
        P.append(b)
        P.append(beam((0, -0.85, 0.48), (s * 0.55, WF, 0.46), 0.06, 0.06, M['steel']))
    for z in (1.60, 2.15, 2.64):
        b = box((0, -0.06, z), (2.30, 0.05, 0.10), M['wood'], bev=0.006, seg=1)
        cube_uv(b, 0.5, (random.random(), random.random()))
        P.append(b)
    for yy in np.linspace(0.0, 4.7, 6):
        P.append(box((0, float(yy), 0.93), (2.30, 0.08, 0.07), M['steel']))
    for yy in (WF, WR):
        P.append(box((0, yy, 0.40), (1.66, 0.08, 0.08), M['steel']))
        P.append(box((0, yy, 0.66), (1.20, 0.16, 0.36), M['steel'], bev=0.01))
    P.append(beam((0, WF, 0.52), (0, WR, 0.52), 0.08, 0.08, M['steel']))
    P.append(beam((0, HY, 0.47), (0, WF, 0.50), 0.09, 0.07, M['steel']))
    P.append(revolve([(0.05 + 0.012 * math.cos(a), 0.012 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 5, endpoint=False)],
                     (0, HY, 0.47), (0, 0, 1), 12, M['steel'], closed=True))
    # bales
    BL, BW, BH = 0.90, 0.46, 0.36
    layers = [(2, 10, 0.0), (2, 9, 0.23), (2, 5, 0.23 + 0.47 * 2)]
    for li, (nx, ny, y_off) in enumerate(layers):
        for ix in range(nx):
            for iy in range(ny):
                cx = (ix - 0.5) * (BL + 0.02) + random.uniform(-0.02, 0.02)
                cy = -0.10 + 0.245 + y_off + iy * 0.472 + random.uniform(-0.015, 0.015)
                cz = 1.02 + BH / 2 + li * BH + random.uniform(-0.003, 0.004)
                rz = random.uniform(-0.05, 0.05)
                bl, bw, bh = BL * random.uniform(0.95, 1.03), BW * random.uniform(0.96, 1.02), BH * random.uniform(0.95, 1.02)
                b = box((cx, cy, cz - (BH - bh) / 2), (bl, bw, bh), M['straw'], bev=0.06, seg=1, rz=rz,
                        rx=random.uniform(-0.025, 0.025), ry=random.uniform(-0.02, 0.02))
                cube_uv(b, 1.1, (random.random(), random.random()))
                P.append(b)
                for t in (-0.22, 0.22):
                    P.append(band((cx + t * math.cos(rz), cy + t * math.sin(rz), cz - (BH - bh) / 2), (0.012, bw + 0.004, bh + 0.004),
                                  M['twine'], rz=rz))
    node(wagon, 'body', P, (0, HY, 0))
    for nm, x, y, s in (('wheel_fl', 0.85, WF, 1), ('wheel_fr', -0.85, WF, -1), ('wheel_rl', 0.85, WR, 1), ('wheel_rr', -0.85, WR, -1)):
        node(wagon, nm, wheel_parts((x, y, 0.40), 0.40, 0.22, 0.22, s, segs=16, kind='rib', dish=0.2, hub=0.05, nuts=False), (x, y, 0.40))
    return root


# ====================================================================== DOG
def skin_part(name, pts, radii, levels=2):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in pts], [(i, i + 1) for i in range(len(pts) - 1)], [])
    me.update()
    o = bpy.data.objects.new(name, me)
    COLL.objects.link(o)
    md = o.modifiers.new('skin', 'SKIN')
    try:
        md.use_smooth_shade = True
    except Exception:
        pass
    if len(me.skin_vertices) == 0:
        bpy.context.view_layer.objects.active = o
        with bpy.context.temp_override(object=o, active_object=o):
            bpy.ops.mesh.customdata_skin_add()
    sv = me.skin_vertices[0].data
    for i, r in enumerate(radii):
        sv[i].radius = (r, r) if not isinstance(r, tuple) else r
    sv[0].use_root = True
    ss = o.modifiers.new('sub', 'SUBSURF')
    ss.levels = levels
    ss.render_levels = levels
    apply_mods(o)
    smooth(o, 80)
    o.data.materials.clear()
    o.data.materials.append(M['fur'])
    return o


def build_dog():
    root = emp('dog', None, (0, 0, 0))
    body = skin_part('d_body', [(0, 0.25, 0.47), (0, 0.17, 0.47), (0, 0.05, 0.465), (0, -0.09, 0.44), (0, -0.20, 0.43),
                                (0, -0.28, 0.50), (0, -0.33, 0.565), (0, -0.355, 0.60)],
                     [(0.075, 0.08), (0.10, 0.11), (0.085, 0.085), (0.115, 0.15), (0.11, 0.155), (0.095, 0.105), (0.072, 0.075),
                      (0.06, 0.06)])
    head = [skin_part('d_head', [(0, -0.355, 0.60), (0, -0.365, 0.605), (0, -0.395, 0.625), (0, -0.445, 0.607), (0, -0.495, 0.59),
                                 (0, -0.535, 0.583)],
                      [(0.062, 0.062), (0.066, 0.064), (0.072, 0.068), (0.054, 0.05), (0.04, 0.035), (0.024, 0.021)])]
    for s in (1, -1):
        head.append(skin_part('d_ear', [(s * 0.040, -0.383, 0.66), (s * 0.052, -0.383, 0.695), (s * 0.056, -0.40, 0.708)],
                              [(0.028, 0.011), (0.02, 0.008), (0.007, 0.004)], levels=1))
        head.append(revolve([(0, -0.011), (0.008, -0.008), (0.011, 0), (0.008, 0.008), (0, 0.011)], (s * 0.037, -0.428, 0.638),
                            (0, 1, 0), 8, M['eye']))
    tail = skin_part('d_tail', [(0, 0.25, 0.48), (0, 0.31, 0.43), (0, 0.355, 0.35), (0, 0.38, 0.26), (0, 0.39, 0.18), (0, 0.405, 0.14)],
                     [0.03, 0.038, 0.042, 0.038, 0.028, 0.012], levels=1)
    legs = {}
    for s, side in ((1, 'L'), (-1, 'R')):
        legs['legF' + side] = skin_part('d_lf', [(s * 0.056, -0.20, 0.45), (s * 0.064, -0.175, 0.28), (s * 0.064, -0.19, 0.09),
                                                 (s * 0.064, -0.212, 0.03), (s * 0.064, -0.238, 0.022)],
                                        [0.058, 0.034, 0.02, 0.024, 0.019])
        legs['legR' + side] = skin_part('d_lr', [(s * 0.062, 0.17, 0.46), (s * 0.078, 0.10, 0.29), (s * 0.075, 0.22, 0.14),
                                                 (s * 0.072, 0.20, 0.03), (s * 0.072, 0.178, 0.022)],
                                        [0.082, 0.042, 0.022, 0.024, 0.019])
    allp = [body, tail] + head + list(legs.values())
    tot = sum(tris(o) for o in allp)
    say('dog raw tris', tot)
    if tot > 4800:
        legl = list(legs.values())
        fixed = tot - sum(tris(o) for o in legl)
        ratio = max(0.2, (4750 - fixed) / sum(tris(o) for o in legl))
        say('dog leg decimate ratio', round(ratio, 3))
        for o in legl:
            md = o.modifiers.new('dec', 'DECIMATE')
            md.ratio = ratio
            apply_mods(o)
            smooth(o, 80)
    zmin = min(min((o.matrix_world @ v.co).z for v in o.data.vertices) for o in allp)
    for o in allp:
        o.data.transform(Matrix.Translation((0, 0, -zmin)))
    dz = -zmin
    b = node(root, 'body', [body], (0, -0.02, 0.44 + dz))
    node(b, 'head', head, (0, -0.355, 0.60 + dz))
    node(b, 'tail', [tail], (0, 0.25, 0.48 + dz))
    pivots = {'legFL': (0.056, -0.20, 0.45), 'legFR': (-0.056, -0.20, 0.45), 'legRL': (0.062, 0.17, 0.46), 'legRR': (-0.062, 0.17, 0.46)}
    for nm in ('legFL', 'legFR', 'legRL', 'legRR'):
        px, py, pz = pivots[nm]
        node(b, nm, [legs[nm]], (px, py, pz + dz))
    return root


# ====================================================================== LOG, PUMPKIN, NET, FEATHER
def noise3(p, k=1.0, seed=0.0):
    x, y, z = p[..., 0] * k, p[..., 1] * k, p[..., 2] * k
    return (np.sin(x * 1.7 + y * 3.1 + seed) * np.sin(y * 2.3 - z * 4.1 + seed * 2) * np.sin(z * 1.3 + x * 2.9 - seed)
            + 0.5 * np.sin(x * 5.3 - y * 4.7 + z * 3.9 + seed * 3))


def build_log():
    rng = random.Random(11)
    L, R0, NS, NR = 3.70, 0.235, 18, 22
    verts, faces, uvs = [], [], []
    ys = np.linspace(-L / 2, L / 2, NR)
    jag0 = [rng.uniform(0.0, 0.10) for _ in range(NS)]
    jag1 = [rng.uniform(0.0, 0.16) for _ in range(NS)]

    def rad(t, y):
        taper = 1.0 - 0.10 * (y + L / 2) / L
        r = R0 * taper * (1 + 0.035 * math.sin(t * 7 + y * 1.3) + 0.03 * math.sin(t * 3 - y * 2.1) + 0.02 * math.sin(y * 5)
                          + 0.012 * math.sin(t * 19 + y * 0.7))
        return r * (1 + 0.05 * math.exp(-((y - 0.6) ** 2) / 0.02))
    for i, y in enumerate(ys):
        for j in range(NS + 1):
            t = 2 * math.pi * j / NS
            r = rad(t, y)
            yy = y - jag0[j % NS] if i == 0 else (y + jag1[j % NS] if i == NR - 1 else y)
            verts.append((r * math.cos(t), yy, R0 + r * math.sin(t)))
            uvs.append((yy * 0.9, j / NS * 2))
    C = NS + 1
    for i in range(NR - 1):
        for j in range(NS):
            faces.append((i * C + j, i * C + j + 1, (i + 1) * C + j + 1, (i + 1) * C + j))
    o = make_obj('log_main', verts, faces, M['bark'])
    uvl = o.data.uv_layers.new(name='UVMap')
    for p in o.data.polygons:
        for li in p.loop_indices:
            uvl.data[li].uv = uvs[o.data.loops[li].vertex_index]
    cleanup(o)
    smooth(o, 60)
    parts = [o]
    # broken ends: bark rim, then pale split wood with a splintered centre
    for i, sgn, jag in ((0, -1, jag0), (NR - 1, 1, jag1)):
        y = float(ys[i])
        cv, cf = [], []
        for j in range(NS):
            t = 2 * math.pi * j / NS
            r = rad(t, y)
            yy = y + sgn * jag[j]
            cv.append((r * math.cos(t), yy, R0 + r * math.sin(t)))
        for j in range(NS):
            t = 2 * math.pi * j / NS
            r = rad(t, y) * 0.84
            yy = y + sgn * (jag[j] * 0.7 + 0.01)
            cv.append((r * math.cos(t), yy, R0 + r * math.sin(t)))
        cv.append((0.02 * sgn, y + sgn * (max(jag) * 0.8 + 0.03), R0 + 0.01))
        for j in range(NS):
            j2 = (j + 1) % NS
            cf.append((j, j2, NS + j2, NS + j))
            cf.append((NS + j, NS + j2, 2 * NS))
        e = make_obj('log_end', cv, cf, M['logend'])
        cleanup(e)
        smooth(e, 50)
        parts.append(e)
    # broken branch stubs
    for (y, ang, ln, r) in ((-0.9, 0.15, 0.22, 0.055), (0.35, math.pi - 0.25, 0.21, 0.06), (1.25, -0.5, 0.14, 0.045),
                            (-0.2, math.pi + 0.5, 0.12, 0.04)):
        d = Vector((math.cos(ang), 0.25, math.sin(ang))).normalized()
        base = Vector((0, y, R0)) + d * (R0 * 0.75)
        st = revolve([(0, -0.05), (r, -0.05), (r * 0.85, ln * 0.7), (r * 0.6, ln), (0.0, ln + 0.02)], base, d, 7, M['bark'])
        cube_uv(st, 0.9)
        parts.append(st)
    return join(parts, 'log')


def build_pumpkin():
    NS, NR = 30, 9
    verts, faces = [], []
    Rh, H = 0.22, 0.30
    for i in range(1, NR):
        ph = math.pi * i / NR            # 0 = top
        for j in range(NS):
            t = 2 * math.pi * j / NS
            groove = (0.5 + 0.5 * math.cos(10 * t)) ** 2
            r = Rh * math.sin(ph) ** 0.7 * (1 - 0.075 * groove)
            z = H / 2 + H / 2 * math.cos(ph) * (0.90 if ph < math.pi / 2 else 1.0)
            verts.append((r * math.cos(t), r * math.sin(t), z))
    top = len(verts)
    verts.append((0, 0, H - 0.04))
    bot = len(verts)
    verts.append((0, 0, 0.018))
    n = NR - 1
    for i in range(n - 1):
        for j in range(NS):
            j2 = (j + 1) % NS
            faces.append((i * NS + j, i * NS + j2, (i + 1) * NS + j2, (i + 1) * NS + j))
    for j in range(NS):
        j2 = (j + 1) % NS
        faces.append((j2, j, top))
        faces.append(((n - 1) * NS + j, (n - 1) * NS + j2, bot))
    o = make_obj('pumpkin_body', verts, faces, M['pumpkin'])
    cleanup(o)
    smooth(o, 75)
    stem = revolve([(0.0, H - 0.06), (0.026, H - 0.06), (0.021, H + 0.0), (0.017, H + 0.04), (0.013, H + 0.06), (0.0, H + 0.062)],
                   (0, 0, 0), (0.3, 0.12, 1), 6, M['pumpkin'], smooth_deg=70)
    zmin = min(v.co.z for v in o.data.vertices)
    root = join([o, stem], 'pumpkin')
    root.data.transform(Matrix.Translation((0, 0, -zmin)))
    return root


def build_net():
    parts = []
    L, HR = 1.6, 0.34
    parts.append(cyl((0, -0.13, 0), (0, 1, 0), 0.02, 0.26, 10, M['rubber']))
    parts.append(cyl((0, -L / 2, 0), (0, 1, 0), 0.014, L, 8, M['frame']))
    hc = Vector((0, -L - HR, 0))
    parts.append(revolve([(HR + 0.011 * math.cos(a), 0.011 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 5, endpoint=False)],
                         hc, (0, 0, 1), 28, M['frame'], closed=True))
    parts.append(beam((0, -L + 0.02, 0), (0, -L - 0.02, 0), 0.03, 0.03, M['frame']))
    # bag: rings hanging under the hoop
    NS, NRG = 16, 6
    verts, faces, uvs = [], [], []
    for k in range(NRG + 1):
        f = k / NRG
        r = HR * math.sqrt(max(0.0, 1 - 0.93 * f ** 1.6))
        z = -0.44 * f ** 1.15
        for j in range(NS + 1):
            t = 2 * math.pi * j / NS
            sag = 0.03 * math.sin(t * 3) * f
            verts.append((hc.x + r * math.cos(t), hc.y + r * math.sin(t) + 0.06 * f, z + sag))
            uvs.append((j / NS * 6, f * 3))
    for k in range(NRG):
        for j in range(NS):
            a = k * (NS + 1) + j
            faces.append((a, a + 1, a + NS + 2, a + NS + 1))
    me = bpy.data.meshes.new('bag')
    me.from_pydata(verts, [], faces)
    me.update()
    bag = bpy.data.objects.new('bag', me)
    COLL.objects.link(bag)
    me.materials.append(M['netting'])
    uvl = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        for li in p.loop_indices:
            uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    smooth(bag, 80)
    return join([bag] + parts, 'net')


def build_feather():
    # 6 triangles: a gently curved card 0.05 x 0.22, lying flat, length along Y, tip toward -Y
    W, L = 0.05, 0.22
    verts, uvs = [], []
    for k, f in enumerate((0.0, 0.33, 0.66, 1.0)):
        y = -L / 2 + L * f
        z = 0.004 + 0.012 * math.sin(f * math.pi) + 0.006 * f
        for s in (-1, 1):
            verts.append((s * W / 2 * (1 - 0.15 * f), y, z + 0.004 * (1 - abs(s))))
            uvs.append(((s + 1) / 2, 1 - f))
    faces = [(0, 1, 3, 2), (2, 3, 5, 4), (4, 5, 7, 6)]
    me = bpy.data.meshes.new('feather')
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new('feather', me)
    COLL.objects.link(o)
    me.materials.append(M['feather'])
    uvl = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        for li in p.loop_indices:
            uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    smooth(o, 80)
    return o


# ====================================================================== build all
say('building')
roots = {}
roots['pickup'] = build_pickup(); say('pickup done')
roots['tractor_wagon'] = build_tractor_wagon(); say('tractor_wagon done')
roots['grain_truck'] = build_grain_truck(); say('grain_truck done')
roots['dog'] = build_dog(); say('dog done')
roots['log'] = build_log()
roots['pumpkin'] = build_pumpkin()
roots['net'] = build_net()
roots['feather'] = build_feather()
say('all built')

PLACE = {'pickup': (0, 0, 0), 'tractor_wagon': (4.2, 0, 0), 'grain_truck': (9.0, 0, 0), 'dog': (12.4, 0, 0),
         'log': (14.2, 0, 0), 'pumpkin': (16.0, 0, 0), 'net': (17.6, 1.0, 1.0), 'feather': (19.0, 0, 0)}
for k, r in roots.items():
    r.location = PLACE[k]
    r['part'] = k
bpy.context.view_layer.update()


def descendants(o):
    out = [o]
    for c in o.children:
        out += descendants(c)
    return out


# ====================================================================== bake AO into vertex colours
bpy.ops.mesh.primitive_plane_add(size=80, location=(10, 0, 0))
ground = bpy.context.active_object
ground.name = '_bake_ground'
world = bpy.data.worlds.new('bakeworld')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)
try:
    world.light_settings.distance = 0.55
except Exception as e:
    say('ao distance', e)
meshes = [o for k in roots for o in descendants(roots[k]) if o.type == 'MESH']
for o in meshes:
    me = o.data
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    a = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = a
    try:
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
    except Exception:
        pass
bake_set = [o for o in meshes if not (o.name in ('feather', 'net'))]
bpy.ops.object.select_all(action='DESELECT')
for o in bake_set:
    o.select_set(True)
bpy.context.view_layer.objects.active = bake_set[0]
scene.cycles.samples = 96
t = time.time()
try:
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    say(f'AO baked in {time.time() - t:.1f}s')
    BAKED = True
except Exception as e:
    say('AO BAKE FAILED:', e)
    BAKED = False


def model_coords(o, root):
    n = len(o.data.vertices)
    co = np.empty(n * 3, np.float32)
    o.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    mtx = np.array(root.matrix_world.inverted() @ o.matrix_world)
    return co @ mtx[:3, :3].T + mtx[:3, 3]


def vert_material_names(o):
    names = [m.name if m else '' for m in o.data.materials]
    clean = ('glass', 'headlamp', 'taillamp', 'amber')
    out = [''] * len(o.data.vertices)
    for p in o.data.polygons:
        nm = names[p.material_index] if p.material_index < len(names) else ''
        for v in p.vertices:
            if out[v] not in clean:
                out[v] = nm
    return np.array(out)


def tint_object(o, rootname, root):
    me = o.data
    a = me.color_attributes['Col']
    n = len(me.vertices)
    col = np.empty(n * 4, np.float32)
    a.data.foreach_get('color', col)
    col = col.reshape(-1, 4)
    ao = np.clip(col[:, 0], 0, 1) if BAKED else np.ones(n, np.float32)
    if o.name in ('feather', 'net'):
        ao = np.ones(n, np.float32)
    p = model_coords(o, root)
    z = p[:, 2]
    occl = 0.16 + 0.84 * ao ** 0.85
    rgb = np.ones((n, 3), np.float32) * occl[:, None]
    nz = noise3(p, 2.3, 1.0)
    nz2 = noise3(p, 6.1, 4.0)
    if rootname in ('pickup', 'grain_truck', 'tractor_wagon'):
        mats = vert_material_names(o)
        clean = np.isin(mats, ['glass', 'headlamp', 'taillamp', 'amber'])
        h = {'pickup': 0.78, 'grain_truck': 1.05, 'tractor_wagon': 0.70}[rootname]
        mud = np.clip((h - z) / (h * 0.75), 0, 1) ** 1.3 * np.clip(0.55 + 0.45 * nz + 0.2 * nz2, 0, 1)
        if '|wheel' in o.name:
            mud = np.clip(0.35 + 0.5 * mud, 0, 1)
        mud = np.where(clean, mud * 0.25, mud)
        mud_c = np.array([0.62, 0.50, 0.38], np.float32)
        rgb = rgb * (1 - mud[:, None] * (1 - mud_c[None, :]))
        st = mats == 'straw'
        if st.any():
            var = 0.72 + 0.4 * (0.5 + 0.5 * noise3(p, 1.9, 9.0))
            grn = np.clip(noise3(p, 1.3, 3.0), 0, 1) * 0.5
            sc = var[:, None] * (np.ones(3)[None, :] * (1 - grn[:, None]) + np.array([0.78, 0.92, 0.62])[None, :] * grn[:, None])
            rgb = np.where(st[:, None], rgb * sc, rgb)
        if rootname == 'grain_truck':
            rust = np.clip((nz * 0.6 + nz2 * 0.5 - 0.45) * 3, 0, 1) * np.where(mats == 'paint', 1, np.where(mats == 'steel', 0.25, 0.0))
            rust_c = np.array([0.55, 0.32, 0.18], np.float32)
            rgb = rgb * (1 - rust[:, None] * (1 - rust_c[None, :]))
    elif rootname == 'dog':
        sable = np.array([0.20, 0.095, 0.035]); tan = np.array([0.42, 0.24, 0.09]); white = np.array([0.78, 0.75, 0.68])
        x, y = p[:, 0], p[:, 1]
        part = o.name.split('|')[-1]
        top = np.clip((z - 0.38) / 0.12, 0, 1)
        c = tan[None, :] * (1 - top[:, None]) + sable[None, :] * top[:, None]
        c = c * (0.85 + 0.15 * nz2[:, None])
        wmask = np.zeros(n, bool)
        ss = lambda a, b, v: np.clip((v - a) / (b - a), 0, 1)
        wsoft = np.zeros(n, np.float32)
        if part == 'body':
            wsoft = np.maximum(wsoft, ss(-0.20, -0.26, y) * ss(0.52, 0.47, z) * ss(0.10, 0.06, np.abs(x)))   # chest front
            wsoft = np.maximum(wsoft, ss(-0.27, -0.31, y) * ss(0.46, 0.50, z))                             # collar
        if part == 'head':
            wsoft = np.maximum(wsoft, ss(-0.44, -0.48, y) * ss(0.595, 0.575, z))                             # chin
            wsoft = np.maximum(wsoft, ss(0.02, 0.008, np.abs(x)) * ss(-0.41, -0.44, y) * ss(0.59, 0.61, z))  # blaze
        if part.startswith('leg'):
            h0 = 0.11 if part.startswith('legF') else 0.08
            wsoft = np.maximum(wsoft, ss(h0, h0 - 0.03, z))                                                 # socks
        if part == 'tail':
            wsoft = np.maximum(wsoft, ss(0.24, 0.17, z))                                                    # tail tip
        c = c * (1 - wsoft[:, None]) + white[None, :] * wsoft[:, None]
        if part == 'head':
            c = np.where((y < -0.532)[:, None], np.array([0.03, 0.025, 0.02])[None, :], c)
        rgb = rgb * c
    elif rootname == 'log':
        mats = vert_material_names(o)
        moss = np.array([0.55, 0.85, 0.35]); wood = np.array([0.62, 0.48, 0.32])
        r = np.sqrt(p[:, 0] ** 2 + (p[:, 2] - 0.235) ** 2)
        c = np.ones((n, 3)) * (0.85 + 0.3 * (0.5 + 0.5 * nz2))[:, None]
        mossm = np.clip((nz - 0.1) * 1.6, 0, 1) * np.clip((p[:, 2] - 0.28) / 0.15, 0, 1)
        c = c * (1 - mossm[:, None]) + (c * moss[None, :]) * mossm[:, None]
        endm = (mats == 'logend').astype(np.float32)
        ringc = wood[None, :] * (0.8 + 0.2 * np.sin(r * 140 + nz * 2))[:, None] * np.where(r > 0.17, 0.6, 1.0)[:, None]
        c = c * (1 - endm[:, None]) + ringc * endm[:, None]
        rgb = rgb * c
    elif rootname == 'pumpkin':
        org = np.array([0.80, 0.33, 0.05]); deep = np.array([0.50, 0.17, 0.025]); stemc = np.array([0.36, 0.33, 0.20])
        rr = np.sqrt(p[:, 0] ** 2 + p[:, 1] ** 2)
        t = np.arctan2(p[:, 1], p[:, 0])
        groove = (0.5 + 0.5 * np.cos(10 * t)) ** 6
        c = org[None, :] * (1 - groove[:, None] * 0.6) + deep[None, :] * (groove[:, None] * 0.6)
        c = c * (0.92 + 0.08 * nz2[:, None])
        stem = (rr < 0.035) & (z > 0.25)
        c = np.where(stem[:, None], stemc[None, :], c)
        rgb = rgb * c
    out = np.ones((n, 4), np.float32)
    out[:, :3] = rgb
    a.data.foreach_set('color', out.ravel())


for k, r in roots.items():
    for o in descendants(r):
        if o.type == 'MESH':
            tint_object(o, k, r)
say('vertex colours done')

# ====================================================================== report + save preview blend
report = {}
for k, r in roots.items():
    ms = [o for o in descendants(r) if o.type == 'MESH']
    tri = sum(tris(o) for o in ms)
    pts = np.concatenate([model_coords(o, r) for o in ms])
    mn, mx = pts.min(0), pts.max(0)
    mats = sorted({m.name for o in ms for m in o.data.materials if m})
    names = [o.name.split('|')[-1] for o in descendants(r)]
    say('   per node:', {o.name.split('|', 1)[-1]: tris(o) for o in ms})
    report[k] = dict(tris=tri, size=[round(float(v), 3) for v in (mx - mn)], min=[round(float(v), 3) for v in mn],
                     max=[round(float(v), 3) for v in mx], materials=mats, nodes=names)
    say(f'{k:14s} tris {tri:6d} size w{mx[0]-mn[0]:.2f} l{mx[1]-mn[1]:.2f} h{mx[2]-mn[2]:.2f} '
        f'min {np.round(mn, 2)} max {np.round(mx, 2)}  nodes {names}')
with open(os.path.join(SCRATCH, 'report.json'), 'w') as f:
    json.dump(report, f, indent=1)

bpy.data.objects.remove(ground)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SCRATCH, 'models.blend'))
say('saved preview blend')

# ====================================================================== export
for m in M.values():
    build_graph(m, preview=False)
for o in bpy.data.objects:
    if '_hard' in o.keys():
        del o['_hard']
bpy.ops.object.select_all(action='DESELECT')
for r in roots.values():
    for o in descendants(r):
        o.select_set(True)
path = os.path.join(OUT, 'models.glb')
kw = dict(filepath=path, export_format='GLB', use_selection=True, export_extras=True, export_apply=True, export_yup=True,
          export_cameras=False, export_lights=False, export_animations=False, export_vertex_color='ACTIVE',
          export_all_vertex_colors=False, export_image_format='AUTO')
for drop in (None, 'export_all_vertex_colors', 'export_vertex_color', 'export_image_format'):
    if drop:
        kw.pop(drop, None)
    try:
        bpy.ops.export_scene.gltf(**kw)
        break
    except TypeError as e:
        say('export retry without', drop, e)

# ---- post: give nodes their plain names (Blender needs unique names; the game wants body, wheel_fl, ...)
with open(path, 'rb') as f:
    data = f.read()
jlen = struct.unpack_from('<I', data, 12)[0]
js = json.loads(data[20:20 + jlen].decode('utf8'))
rest = data[20 + jlen:]
for nd in js.get('nodes', []):
    if 'name' in nd:
        nd['name'] = nd['name'].split('|')[-1]
for me in js.get('meshes', []):
    if 'name' in me:
        me['name'] = me['name'].split('|')[-1]
attrs = sorted({a for me in js['meshes'] for p in me['primitives'] for a in p['attributes']})
jb = json.dumps(js, separators=(',', ':')).encode('utf8')
jb += b' ' * ((4 - len(jb) % 4) % 4)
total = 12 + 8 + len(jb) + len(rest)
with open(path, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total))
    f.write(struct.pack('<II', len(jb), 0x4E4F534A))
    f.write(jb)
    f.write(rest)
say('attributes in glb:', attrs, ' alphaModes:', {m.get('name'): m.get('alphaMode', 'OPAQUE') for m in js['materials'] if m.get('alphaMode')})
say('exported', path, os.path.getsize(path), 'bytes')
say('DONE')
