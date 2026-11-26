# Turkey Trouble: the turkey. A tom, about 1 m tall, built from code: layered plumage (feather cards over a dark body),
# a fan of 13 separate tail feathers, bare head and neck with snood and wattle, scaly legs. Every joint is its own node
# with the names in CONTRACT.md, so the game can animate it. Authored in three.js axes (x = its left, y up, z forward).
#   blender -b --factory-startup --python turkey.py -- <work_dir> <assets_dir> [preview]
import bpy, bmesh, sys, os, math, random, time
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '.'
ASSETS = argv[1] if len(argv) > 1 else OUT
PREVIEW = len(argv) > 2 and argv[2] == 'preview'
os.makedirs(OUT, exist_ok=True)
T0 = time.time()
rnd = random.Random(5)


def say(*a):
    print(f'[turkey {time.time() - T0:5.1f}s]', *a, flush=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))      # three.js axes -> Blender axes
CI = C.inverted()


def V(x, y, z):
    return Vector((x, y, z))


# ================================================================ the feather picture: four kinds side by side
def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def feather_atlas():
    """512 x 512 RGBA. Four columns: body feather, wing feather, tail feather, covert. v runs from the quill (0) to the tip (1)."""
    S = 512
    rng = np.random.default_rng(4)
    img = np.zeros((S, S, 4), np.float32)
    vv, uu = np.mgrid[0:S, 0:128].astype(np.float32)
    v = vv / (S - 1)
    u = (uu / 127.0) * 2 - 1
    barb = np.sin((v * 90 + np.abs(u) * 26) * 1.0) * 0.5 + 0.5
    fine = rng.random((S, 128)).astype(np.float32)

    def shape(width_at, tip_round):
        w = width_at(v)
        edge = w - np.abs(u) - 0.035 * (barb - 0.5) * smooth(0.2, 0.9, v)
        a = smooth(0.0, 0.07, edge) * smooth(1.0, 1.0 - tip_round, v) * smooth(0.0, 0.03, v)
        return a

    def put(col, rgb, alpha):
        shaft = np.exp(-(u / 0.035) ** 2) * smooth(0.02, 0.2, v) * (1 - smooth(0.8, 1.0, v))
        rgb = rgb * (0.82 + 0.3 * barb[..., None]) * (0.9 + 0.2 * fine[..., None])
        rgb = rgb * (1 - 0.35 * shaft[..., None]) + np.array([0.5, 0.42, 0.3], np.float32) * 0.25 * shaft[..., None]
        img[:, col * 128:(col + 1) * 128, :3] = np.clip(rgb, 0, 1)
        img[:, col * 128:(col + 1) * 128, 3] = alpha

    def c3(r, g, b):
        return np.array([r, g, b], np.float32)[None, None, :]

    def mixc(a, b, t):
        return a * (1 - t[..., None]) + b * t[..., None]

    # 0 body: broad, square-ended; dark base, bronze sheen, a black band just under a pale edge
    a = shape(lambda t: 0.28 + 0.62 * smooth(0.0, 0.55, t), 0.045)
    rgb = mixc(c3(0.035, 0.03, 0.028), c3(0.36, 0.20, 0.07), smooth(0.35, 0.72, v))
    rgb = mixc(rgb, c3(0.10, 0.20, 0.12), smooth(0.62, 0.80, v) * 0.55)
    rgb = mixc(rgb, c3(0.012, 0.010, 0.010), smooth(0.80, 0.88, v) * (1 - smooth(0.93, 0.955, v)))
    rgb = mixc(rgb, c3(0.42, 0.33, 0.22), smooth(0.945, 0.965, v))
    put(0, rgb, a)
    # 1 wing: long, narrow, barred white on near-black
    a = shape(lambda t: 0.22 + 0.42 * smooth(0.0, 0.3, t) - 0.25 * smooth(0.78, 1.0, t), 0.02)
    bar = smooth(0.42, 0.58, np.sin(v * 2 * np.pi * 13 + u * 1.2) * 0.5 + 0.5)
    rgb = mixc(c3(0.03, 0.028, 0.026), c3(0.30, 0.28, 0.23), bar * smooth(0.08, 0.2, v))
    put(1, rgb, a)
    # 2 tail: long and wide; fine brown and black bars, a broad black band, a chestnut-cream tip
    a = shape(lambda t: 0.20 + 0.62 * smooth(0.0, 0.6, t) + 0.06 * smooth(0.6, 0.95, t), 0.03)
    bar = smooth(0.4, 0.6, np.sin(v * 2 * np.pi * 15 + np.abs(u) * 2.4) * 0.5 + 0.5)
    rgb = mixc(c3(0.05, 0.035, 0.025), c3(0.30, 0.17, 0.07), bar)
    rgb = mixc(rgb, c3(0.010, 0.009, 0.009), smooth(0.74, 0.80, v) * (1 - smooth(0.905, 0.925, v)))
    rgb = mixc(rgb, c3(0.50, 0.33, 0.17), smooth(0.915, 0.94, v))
    put(2, rgb, a)
    # 3 covert: rump and thigh feathers, dark with a chestnut end
    a = shape(lambda t: 0.26 + 0.58 * smooth(0.0, 0.5, t), 0.05)
    rgb = mixc(c3(0.03, 0.026, 0.024), c3(0.20, 0.10, 0.04), smooth(0.4, 0.7, v))
    rgb = mixc(rgb, c3(0.012, 0.010, 0.010), smooth(0.76, 0.82, v) * (1 - smooth(0.9, 0.92, v)))
    rgb = mixc(rgb, c3(0.40, 0.19, 0.07), smooth(0.905, 0.93, v))
    put(3, rgb, a)
    im = bpy.data.images.new('turkey_feathers', S, S, alpha=True)
    im.pixels.foreach_set(img.ravel())
    im.filepath_raw = os.path.join(OUT, 'turkey_feathers.png')
    im.file_format = 'PNG'
    im.save()
    return im


ATLAS = feather_atlas()
KIND = {'body': 0, 'wing': 1, 'tail': 2, 'covert': 3}


# ================================================================ materials
def mat_feathers():
    m = bpy.data.materials.new('feathers')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get('Principled BSDF')
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = ATLAS
    col = nt.nodes.new('ShaderNodeVertexColor'); col.layer_name = 'Col'
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1.0
    nt.links.new(tex.outputs['Color'], mx.inputs[6]); nt.links.new(col.outputs['Color'], mx.inputs[7])
    nt.links.new(mx.outputs[2], b.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], b.inputs['Alpha'])
    b.inputs['Roughness'].default_value = 0.46
    b.inputs['Metallic'].default_value = 0.25
    m.use_backface_culling = False
    try:
        m.blend_method = 'CLIP'
    except Exception:
        pass
    return m


def mat_plain(name, color, rough=0.5, metal=0.0, vertex_color=True):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get('Principled BSDF')
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if vertex_color:
        col = nt.nodes.new('ShaderNodeVertexColor'); col.layer_name = 'Col'
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1.0
        mx.inputs[6].default_value = (*color, 1)
        nt.links.new(col.outputs['Color'], mx.inputs[7])
        nt.links.new(mx.outputs[2], b.inputs['Base Color'])
    else:
        b.inputs['Base Color'].default_value = (*color, 1)
    m.use_backface_culling = True
    return m


M_FEATH = mat_feathers()
M_DOWN = mat_plain('down', (0.014, 0.012, 0.011), rough=0.9)
M_SKIN = mat_plain('skin', (1.0, 1.0, 1.0), rough=0.42)
M_BEAK = mat_plain('beak', (0.48, 0.40, 0.28), rough=0.35)
M_EYE = mat_plain('eye', (0.012, 0.010, 0.010), rough=0.08, vertex_color=False)
M_LEG = mat_plain('leg', (0.42, 0.25, 0.22), rough=0.5)


# ================================================================ geometry gatherer (explicit normals, UVs, colours)
class Geo:
    def __init__(self):
        self.v, self.n, self.uv, self.c, self.f, self.fm = [], [], [], [], [], []

    def vert(self, p, n, uv=(0, 0), c=(1, 1, 1)):
        self.v.append(Vector(p)); self.n.append(Vector(n).normalized()); self.uv.append(uv); self.c.append(c)
        return len(self.v) - 1

    def quad(self, a, b, c, d, m):
        self.f.append((a, b, c, d)); self.fm.append(m)

    def tri(self, a, b, c, m):
        self.f.append((a, b, c)); self.fm.append(m)

    def tube(self, rings, m, sides=10, color=None, cap0=True, cap1=True):
        """rings: list of (centre, radius_x, radius_y, colour or None). The tube's local frame follows the centre line."""
        idx = []
        up_hint = V(0, 0, 1)
        for k, (cen, rx, ry, col) in enumerate(rings):
            cen = Vector(cen)
            a = Vector(rings[max(0, k - 1)][0]); b = Vector(rings[min(len(rings) - 1, k + 1)][0])
            t = (b - a).normalized()
            x = t.cross(up_hint)
            if x.length < 1e-4:
                x = t.cross(V(1, 0, 0))
            x.normalize()
            y = x.cross(t).normalized()
            row = []
            for s in range(sides):
                ang = 2 * math.pi * s / sides
                d = x * math.cos(ang) * rx + y * math.sin(ang) * ry
                nrm = (x * math.cos(ang) / max(rx, 1e-5) + y * math.sin(ang) / max(ry, 1e-5))
                row.append(self.vert(cen + d, nrm, (s / sides, k / max(1, len(rings) - 1)), col or color or (1, 1, 1)))
            idx.append(row)
        for k in range(len(rings) - 1):
            for s in range(sides):
                s2 = (s + 1) % sides
                self.quad(idx[k][s], idx[k][s2], idx[k + 1][s2], idx[k + 1][s], m)
        for cap, k, sign in ((cap0, 0, -1), (cap1, len(rings) - 1, 1)):
            if not cap:
                continue
            cen = Vector(rings[k][0])
            a = Vector(rings[max(0, k - 1)][0]); b = Vector(rings[min(len(rings) - 1, k + 1)][0])
            t = (b - a).normalized() * sign
            ci = self.vert(cen + t * rings[k][1] * 0.35, t, (0.5, 0.5), rings[k][3] or color or (1, 1, 1))
            for s in range(sides):
                s2 = (s + 1) % sides
                if sign > 0:
                    self.tri(idx[k][s], idx[k][s2], ci, m)
                else:
                    self.tri(idx[k][s2], idx[k][s], ci, m)

    def ellipsoid(self, cen, r, m, color=(1, 1, 1), u=14, v=9, rot=None):
        cen = Vector(cen)
        R = rot or Matrix.Identity(3)
        rows = []
        for j in range(v + 1):
            th = math.pi * j / v
            row = []
            for i in range(u):
                ph = 2 * math.pi * i / u
                d = V(math.sin(th) * math.cos(ph), math.cos(th), math.sin(th) * math.sin(ph))
                p = V(d.x * r[0], d.y * r[1], d.z * r[2])
                nrm = V(d.x / r[0], d.y / r[1], d.z / r[2])
                row.append(self.vert(cen + R @ p, R @ nrm, (i / u, j / v), color))
            rows.append(row)
        for j in range(v):
            for i in range(u):
                i2 = (i + 1) % u
                self.quad(rows[j][i2], rows[j][i], rows[j + 1][i], rows[j + 1][i2], m)

    def feather(self, root, along, across, normal, length, width, kind, tint=(1, 1, 1), curl=0.12, segs=3, bend_normal=0.55):
        """a card from its quill at root, along `along`, lying on a surface whose normal is `normal`"""
        along = Vector(along).normalized(); normal = Vector(normal).normalized()
        across = Vector(across).normalized()
        u0 = KIND[kind] * 0.25 + 0.004; u1 = u0 + 0.25 - 0.008
        rows = []
        for k in range(segs + 1):
            t = k / segs
            lift = normal * (-curl * length * t * t)
            cen = Vector(root) + along * (length * t) + lift
            nrm = (normal + along * (curl * 2 * t)).normalized()
            l = self.vert(cen - across * width / 2, (nrm - across * bend_normal * 0.5), (u0, t), tint)
            r = self.vert(cen + across * width / 2, (nrm + across * bend_normal * 0.5), (u1, t), tint)
            rows.append((l, r))
        for k in range(segs):
            self.quad(rows[k][0], rows[k][1], rows[k + 1][1], rows[k + 1][0], 0)

    def build(self, name, mats):
        me = bpy.data.meshes.new(name)
        faces = []
        for f in self.f:                                   # wind every face the way its own normals point
            a, b, c = self.v[f[0]], self.v[f[1]], self.v[f[2]]
            geo_n = (b - a).cross(c - a)
            want = Vector((0, 0, 0))
            for i in f:
                want += self.n[i]
            faces.append(tuple(reversed(f)) if geo_n.dot(want) < 0 else f)
        me.from_pydata([C.to_3x3() @ p for p in self.v], [], faces)
        me.update()
        for m in mats:
            me.materials.append(m)
        for poly, mi in zip(me.polygons, self.fm):
            poly.material_index = mi
            poly.use_smooth = True
        uv = me.uv_layers.new(name='UVMap')
        col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        for i, c in enumerate(self.c):
            col.data[i].color = (c[0], c[1], c[2], 1.0)
        for loop in me.loops:
            uv.data[loop.index].uv = self.uv[loop.vertex_index]
        try:
            me.normals_split_custom_set_from_vertices([tuple(C.to_3x3() @ n) for n in self.n])
        except Exception as e:
            say('custom normals not set:', e)
        return me


def make(name, parent, pos, geo=None, mats=(), rot=None):
    """a node at pos (three.js axes, relative to its parent) with an optional mesh. rot = 3x3 rotation in three.js axes"""
    me = geo.build(name, mats) if geo is not None else None
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    M = Matrix.Translation(Vector(pos)) @ (rot.to_4x4() if rot is not None else Matrix.Identity(4))
    ob.matrix_local = C @ M @ CI
    if parent is not None:
        ob.parent = parent
        ob.matrix_parent_inverse = Matrix.Identity(4)
    else:
        ob.matrix_local = Matrix.Identity(4)
    return ob


def tint():
    k = rnd.random()
    if k < 0.5:
        return (1.0 + rnd.uniform(-0.12, 0.1), 0.92 + rnd.uniform(-0.1, 0.1), 0.85 + rnd.uniform(-0.1, 0.1))
    if k < 0.8:
        return (0.78, 1.05, 0.9)
    return (1.15, 0.86, 0.72)


# ================================================================ the bird
root = make('turkey', None, (0, 0, 0))

# ---- body: a dark egg under about 200 overlapping feathers
BODY_Y = 0.47
A_, B_, L_ = 0.175, 0.185, 0.30                       # half width, half height, half length
PITCH = Matrix.Rotation(-0.20, 3, 'X')                 # breast a little up
g = Geo()
g.ellipsoid((0, 0.0, 0.0), (A_ * 0.94, B_ * 0.94, L_ * 0.95), 1, color=(1, 1, 1), u=14, v=10, rot=PITCH)
rows = 17
for j in range(rows):
    t = 0.93 - 1.78 * j / (rows - 1)                    # +z (breast) to -z (rump)
    s = math.sqrt(max(0.0, 1 - t * t))
    n_ring = max(6, int(2 * math.pi * 0.18 * s / 0.036))
    for i in range(n_ring):
        ph = 2 * math.pi * (i + 0.5 * (j % 2)) / n_ring
        cx, cy = math.cos(ph), math.sin(ph)
        if cy < -0.93 and abs(t) < 0.4:
            continue                                    # only the strip between the legs stays bare down
        p = V(A_ * s * cx, B_ * s * cy, L_ * t)
        nrm = V(cx / A_, cy / B_, t / L_ * 1.0 / max(s, 0.25)).normalized()
        back = V(0, -0.25 if cy > -0.3 else -0.6, -1)
        along = (back - nrm * back.dot(nrm)).normalized()
        along = (along * math.cos(0.07) + nrm * math.sin(0.07)).normalized()
        across = nrm.cross(along).normalized()
        big = 1.0 + 0.35 * max(0.0, cy) + 0.25 * max(0.0, -t)
        kind = 'covert' if t < -0.55 else 'body'
        g.feather(PITCH @ p, PITCH @ along, PITCH @ across, PITCH @ nrm, 0.098 * big * rnd.uniform(0.9, 1.1), 0.068 * big, kind, tint(), curl=0.16)
# the beard: a dark tuft on the breast
for k in range(5):
    p = PITCH @ V(rnd.uniform(-0.012, 0.012), -0.02, L_ * 0.93)
    g.feather(p, V(rnd.uniform(-0.08, 0.08), -1, 0.22), V(1, 0, 0), V(0, 0.2, 1), 0.15, 0.018, 'wing', (0.25, 0.25, 0.25), curl=0.0)
body = make('body', root, (0, BODY_Y, 0), g, [M_FEATH, M_DOWN])

# ---- neck and head: bare skin, red below, blue-white on the head
RED, BLUE, PINK = (0.36, 0.035, 0.032), (0.20, 0.30, 0.46), (0.40, 0.14, 0.15)
g = Geo()
g.tube([((0, -0.03, -0.01), 0.078, 0.078, (0.05, 0.04, 0.04)), ((0, 0.025, 0.012), 0.066, 0.066, RED), ((0, 0.08, 0.018), 0.050, 0.052, RED), ((0, 0.145, 0.012), 0.040, 0.043, RED), ((0, 0.158, 0.01), 0.038, 0.04, RED)], 0, sides=10)
for k in range(11):                                     # caruncles: the knobbly red skin low on the neck
    a = rnd.uniform(0, 2 * math.pi)
    y = rnd.uniform(0.02, 0.10)
    r = 0.056 - y * 0.1
    g.ellipsoid((math.cos(a) * r, y, 0.015 + math.sin(a) * r), (0.014, 0.018, 0.014), 0, color=(0.44, 0.04, 0.035), u=6, v=4)
neck1 = make('neck1', body, (0, 0.13, 0.245), g, [M_SKIN], rot=Matrix.Rotation(0.42, 3, 'X'))
g = Geo()
g.tube([((0, -0.01, 0), 0.040, 0.043, RED), ((0, 0.045, -0.01), 0.034, 0.037, RED), ((0, 0.10, -0.016), 0.029, 0.032, PINK), ((0, 0.14, -0.01), 0.028, 0.031, BLUE)], 0, sides=10)
neck2 = make('neck2', neck1, (0, 0.155, 0.01), g, [M_SKIN], rot=Matrix.Rotation(-0.62, 3, 'X'))
g = Geo()
g.ellipsoid((0, 0.045, 0.012), (0.043, 0.047, 0.058), 0, color=BLUE, u=12, v=8)
g.ellipsoid((0, 0.082, -0.005), (0.03, 0.02, 0.04), 0, color=(0.32, 0.26, 0.30), u=8, v=5)        # the pale warty crown
for sx in (-1, 1):
    g.ellipsoid((sx * 0.037, 0.055, 0.03), (0.0075, 0.0085, 0.0085), 1, u=8, v=6)
    g.ellipsoid((sx * 0.030, 0.012, 0.012), (0.018, 0.02, 0.022), 0, color=RED, u=6, v=4)
head = make('head', neck2, (0, 0.14, -0.01), g, [M_SKIN, M_EYE], rot=Matrix.Rotation(0.20, 3, 'X'))
g = Geo()
g.tube([((0, 0, 0), 0.021, 0.019, (1, 1, 1)), ((0, -0.006, 0.03), 0.015, 0.013, (1, 1, 1)), ((0, -0.017, 0.058), 0.006, 0.005, (0.6, 0.55, 0.5)), ((0, -0.024, 0.066), 0.002, 0.002, (0.35, 0.3, 0.28))], 0, sides=8)
beak = make('beak', head, (0, 0.04, 0.06), g, [M_BEAK])
g = Geo()
g.tube([((0, 0.0, 0.0), 0.012, 0.011, RED), ((0.006, -0.004, 0.022), 0.011, 0.01, RED), ((0.014, -0.03, 0.04), 0.009, 0.008, RED), ((0.018, -0.065, 0.04), 0.007, 0.007, (0.56, 0.07, 0.06)), ((0.019, -0.09, 0.034), 0.004, 0.004, (0.56, 0.07, 0.06))], 0, sides=7)
snood = make('snood', head, (0, 0.062, 0.062), g, [M_SKIN])
g = Geo()
g.ellipsoid((0, -0.035, 0.004), (0.014, 0.042, 0.03), 0, color=(0.56, 0.05, 0.045), u=8, v=6)
g.ellipsoid((0, -0.068, 0.0), (0.012, 0.022, 0.022), 0, color=(0.6, 0.06, 0.05), u=7, v=5)
wattle = make('wattle', head, (0, 0.012, 0.045), g, [M_SKIN])

# ---- the tail: a fan of 13 feathers, each on its own node, over two rows of short rump feathers
TAIL_LEAN = Matrix.Rotation(-0.42, 3, 'X')
g = Geo()
for row, (ln, wd, n) in enumerate(((0.19, 0.075, 15), (0.27, 0.085, 13))):
    for i in range(n):
        a = (i - (n - 1) / 2) * (3.05 / n)
        d = V(math.sin(a), math.cos(a), 0)
        g.feather(V(d.x * 0.035, d.y * 0.035, 0.02 + 0.012 * (1 - row)), d, V(d.y, -d.x, 0), V(0, 0, 1), ln, wd, 'covert', tint(), curl=0.05)
tail = make('tail', body, (0, 0.085, -0.29), g, [M_FEATH], rot=TAIL_LEAN)
for i in range(13):
    g = Geo()
    g.feather(V(0, 0, 0), V(0, 1, 0), V(1, 0, 0), V(0, 0, 1), 0.47 * (1.0 - 0.06 * abs(i - 6) / 6), 0.15, 'tail', (1.0, 0.97 + rnd.uniform(-0.05, 0.05), 0.95), curl=-0.05, segs=4)
    a = (i - 6) * 0.25
    make(f'tf{i}', tail, (math.sin(a) * 0.03, math.cos(a) * 0.03, 0.002 * (i % 2)), g, [M_FEATH], rot=Matrix.Rotation(-a, 3, 'Z'))

# ---- wings: folded against the body, barred flight feathers showing
for sx, name in ((1, 'wingL'), (-1, 'wingR')):
    g = Geo()
    lean = Matrix.Rotation(-0.25, 3, 'X')
    g.ellipsoid(lean @ V(sx * 0.008, -0.045, -0.12), (0.02, 0.085, 0.185), 1, color=(1, 1, 1), u=10, v=7, rot=lean)
    out = V(sx, 0.15, 0).normalized()
    for row, (y0, ln, wd, n, kind, drop) in enumerate(((0.06, 0.085, 0.062, 8, 'body', 0.25), (0.02, 0.105, 0.058, 9, 'covert', 0.3), (-0.02, 0.11, 0.056, 9, 'covert', 0.3), (-0.05, 0.17, 0.042, 11, 'wing', 0.2), (-0.078, 0.25, 0.036, 9, 'wing', 0.12))):
        for i in range(n):
            f = i / (n - 1)
            z = 0.07 - (0.30 if row < 3 else 0.22) * f
            p = lean @ V(sx * (0.054 - 0.004 * row), y0 - 0.035 * f, z)
            along = lean @ V(0, -drop - 0.25 * (1 - f), -1).normalized()
            g.feather(p, along, out.cross(along), out, ln * rnd.uniform(0.94, 1.06), wd, kind, tint() if kind != 'wing' else (1, 1, 1), curl=0.08)
    make(name, body, (sx * 0.165, 0.075, 0.10), g, [M_FEATH, M_DOWN])

# ---- legs: feathered thigh, scaly shank, three toes forward and one back
LEGC, CLAW = (1.0, 1.0, 1.0), (0.25, 0.22, 0.2)
for sx, sfx in ((1, 'L'), (-1, 'R')):
    g = Geo()
    g.tube([((0, 0.03, 0), 0.062, 0.07, None), ((0, -0.06, 0.012), 0.056, 0.062, None), ((0, -0.13, 0.03), 0.034, 0.036, None), ((0, -0.172, 0.036), 0.02, 0.02, None)], 1, sides=9, color=(1, 1, 1))
    for k in range(10):
        a = 2 * math.pi * k / 10
        nrm = V(math.cos(a), 0.1, math.sin(a)).normalized()
        g.feather(V(math.cos(a) * 0.052, 0.0 - 0.045 * (k % 2), 0.008 + math.sin(a) * 0.058), V(0, -1, 0.15), nrm.cross(V(0, -1, 0.15)), nrm, 0.075, 0.058, 'body', (0.45, 0.42, 0.4), curl=0.14)
    thigh = make('thigh' + sfx, body, (sx * 0.095, -0.115, -0.02), g, [M_FEATH, M_DOWN])
    g = Geo()
    g.tube([((0, 0.005, 0), 0.019, 0.019, LEGC), ((0, -0.05, -0.006), 0.014, 0.015, LEGC), ((0, -0.125, -0.014), 0.013, 0.014, LEGC), ((0, -0.155, -0.012), 0.017, 0.018, LEGC)], 0, sides=8)
    g.tube([((0, -0.095, -0.022), 0.005, 0.005, CLAW), ((0, -0.085, -0.045), 0.001, 0.001, CLAW)], 0, sides=5)       # the spur
    shin = make('shin' + sfx, thigh, (0, -0.172, 0.036), g, [M_LEG])
    g = Geo()
    for ang, ln in ((0.0, 0.085), (0.55, 0.07), (-0.55, 0.07), (math.pi, 0.036)):
        d = V(math.sin(ang), 0, math.cos(ang))
        g.tube([((0, 0.012, 0), 0.012, 0.011, LEGC), (d * ln * 0.5 + V(0, 0.011, 0), 0.0085, 0.008, LEGC), (d * ln + V(0, 0.008, 0), 0.007, 0.0065, LEGC), (d * (ln + 0.02) + V(0, 0.004, 0), 0.0015, 0.0015, CLAW)], 0, sides=6)
    make('foot' + sfx, shin, (0, -0.158, -0.012), g, [M_LEG])

# stand it on the ground: find the lowest point and lift the body so the toes rest at y = 0
bpy.context.view_layer.update()
low = min((o.matrix_world @ Vector(v.co)).z for o in scene.objects if o.type == 'MESH' for v in o.data.vertices)
body.location.z -= low
bpy.context.view_layer.update()
tris = sum(len(p.vertices) - 2 for o in scene.objects if o.type == 'MESH' for p in o.data.polygons)
top = max((o.matrix_world @ Vector(v.co)).z for o in scene.objects if o.type == 'MESH' for v in o.data.vertices)
say(f'turkey: {tris} triangles, {top:.2f} m tall, {len([o for o in scene.objects])} nodes')

# ================================================================ export
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    o.select_set(True)
path = os.path.join(ASSETS, 'turkey.glb')
kw = dict(filepath=path, export_format='GLB', use_selection=True, export_extras=True, export_apply=False, export_yup=True,
          export_cameras=False, export_lights=False, export_animations=False)
for extra in (dict(export_vertex_color='ACTIVE', export_image_format='WEBP', export_image_quality=90), dict(export_image_format='WEBP'), dict()):
    try:
        bpy.ops.export_scene.gltf(**kw, **extra)
        say('exported with', list(extra.keys()))
        break
    except Exception as e:
        say('export retry:', repr(e)[:160])
say('wrote', path, os.path.getsize(path), 'bytes')

# ================================================================ preview: four views in a soft dusk light
if PREVIEW:
    scene.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'OPTIX'
        (prefs.refresh_devices if hasattr(prefs, 'refresh_devices') else prefs.get_devices)()
        for d in prefs.devices:
            d.use = d.type == 'OPTIX'
        scene.cycles.device = 'GPU'
    except Exception as e:
        say('gpu:', e)
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.20, 0.24, 0.34, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.45
    for loc, energy, colr in (((2.5, -2.5, 2.6), 300, (1.0, 0.78, 0.55)), ((-2.5, 1.5, 1.6), 90, (0.6, 0.7, 1.0))):
        d = bpy.data.lights.new('l', 'AREA'); d.energy = energy; d.color = colr; d.size = 2.0
        o = bpy.data.objects.new('l', d); o.location = loc
        o.rotation_euler = (Vector((0, 0, 0.5)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(o)
    bpy.ops.mesh.primitive_plane_add(size=20)
    gm = bpy.data.materials.new('floor'); gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.06, 0.055, 0.05, 1)
    gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.4
    bpy.context.active_object.data.materials.append(gm)
    scene.render.resolution_x, scene.render.resolution_y = 800, 800
    scene.render.image_settings.file_format = 'JPEG'
    scene.view_settings.exposure = 0.0
    for name, eye in (('front', (0.9, -1.7, 0.75)), ('side', (2.0, 0.0, 0.6)), ('back', (-0.9, 1.9, 0.9)), ('head', (0.32, -0.75, 0.98))):
        cd = bpy.data.cameras.new(name); cd.lens = 50 if name != 'head' else 70
        cam = bpy.data.objects.new(name, cd); cam.location = eye
        target = Vector((0, -0.05, 0.55)) if name != 'head' else Vector((0, -0.32, 0.93))
        cam.rotation_euler = (target - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(cam); scene.camera = cam
        scene.render.filepath = os.path.join(OUT, f'turkey_{name}.jpg')
        bpy.ops.render.render(write_still=True)
    say('previews rendered')
say('DONE')
