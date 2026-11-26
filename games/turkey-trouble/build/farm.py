# Turkey Trouble: the farm. Builds the whole static world from layout.json, lights it at dusk after a storm, and either
# renders preview pictures or bakes the lighting and exports the world for the game.
#   blender -b --factory-startup --python farm.py -- <work_dir> preview
#   blender -b --factory-startup --python farm.py -- <work_dir> bake <assets_dir>
# Nothing is downloaded: every shape and every texture is made here.
import bpy, bmesh, sys, os, json, math, random, time
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tt_tex
from tt_kit import *

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(HERE, 'out')
MODE = argv[1] if len(argv) > 1 else 'preview'
ASSETS = argv[2] if len(argv) > 2 else os.path.join(OUT, 'assets')
GAME = os.path.dirname(HERE)
L = json.load(open(os.path.join(GAME, 'layout.json'), encoding='utf-8'))
COL = {c['id']: c for c in L['colliders']}
BND = L['bounds']
TEX = os.path.join(OUT, 'tex')
for d in (OUT, TEX, ASSETS):
    os.makedirs(d, exist_ok=True)
rnd = random.Random(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
say('mode', MODE, '| device', use_gpu(scene))
scene.cycles.use_denoising = True
scene.cycles.sample_clamp_indirect = 4.0
scene.cycles.max_bounces = 6

# ================================================================ textures and materials
PH_TEX = {'barn': ('wood_plank_wall', 1.6, False), 'greywood': ('weathered_brown_planks', 1.4, False), 'shingles': ('roof_slates_02', 2.2, True),
          'tin': ('corrugated_iron', 2.0, True), 'concrete': ('concrete_floor_worn_001', 3.0, True), 'bark': ('bark_brown_02', 1.0, False),
          'hay': ('thatch_roof_angled', 0.9, False)}       # thatch strands, recoloured to dry straw
PH_TILE = {}                                               # metres one copy covers, for the surfaces that were swapped


def ph_image(asset, kind, non_color=False, size=512, straw=False):
    root = os.path.join(os.path.dirname(os.path.abspath(OUT)), 'polyhaven')
    src = os.path.join(root, asset, f'{asset}_{kind}_1k.jpg')
    dst = os.path.join(TEX, f'ph_{asset}_{kind}_{size}' + ('_straw' if straw else '') + '.png')
    if not os.path.exists(src):
        return None
    if not os.path.exists(dst):
        im = bpy.data.images.load(src)
        im.scale(size, size)
        if straw:                                          # keep the strands, change the colour: grey thatch -> dry straw
            px = np.empty(size * size * 4, np.float32)
            im.pixels.foreach_get(px)
            px = px.reshape(-1, 4)
            lum = px[:, :3] @ np.array([0.3, 0.6, 0.1], np.float32)
            k = np.clip(lum / max(1e-4, float(lum.mean())), 0.35, 1.9) ** 0.85
            px[:, 0], px[:, 1], px[:, 2] = np.clip(0.60 * k, 0, 1), np.clip(0.52 * k, 0, 1), np.clip(0.31 * k, 0, 1)
            im.pixels.foreach_set(px.ravel())
        im.filepath_raw = dst
        im.file_format = 'PNG'
        im.save()
        bpy.data.images.remove(im)
    return load_image(dst, non_color)


def textures():
    names = ['mud', 'gravel', 'grass', 'asphalt', 'stubble', 'barn', 'greywood', 'siding', 'siding_dummy', 'shingles', 'tin', 'concrete', 'brick', 'bark', 'hay']
    extra = ['window_a', 'window_b']
    if not all(os.path.exists(os.path.join(TEX, n + '_a.png')) for n in names + extra):
        say('making textures (about a minute, once)')
        maps, pics = tt_tex.make_all()
        for n, (alb, h, r) in maps.items():
            save_png(n + '_a', alb, os.path.join(TEX, n + '_a.png'))
            strength = {'shingles': 5, 'siding': 5, 'siding_dummy': 5, 'barn': 4, 'greywood': 4, 'tin': 6, 'brick': 4, 'bark': 5}.get(n, 3)
            save_png(n + '_n', tt_tex.normal_map(h, strength), os.path.join(TEX, n + '_n.png'), non_color=True)
            save_png(n + '_r', r, os.path.join(TEX, n + '_r.png'), non_color=True)
        for n, pic in pics.items():
            save_png(n + '_a', pic, os.path.join(TEX, n + '_a.png'))
    t = {}
    for n in names:
        t[n] = (load_image(os.path.join(TEX, n + '_a.png')), load_image(os.path.join(TEX, n + '_n.png'), True))
    for n in extra:
        t[n] = load_image(os.path.join(TEX, n + '_a.png'))
    if os.environ.get('TT_PH_TEX', '0') == '1':            # photo surfaces (Poly Haven, CC0) in place of the code-made ones
        for n, (asset, tile, shiny) in PH_TEX.items():
            d = ph_image(asset, 'diff', straw=(n == 'hay'))
            if d is None:
                continue
            t[n] = (d, ph_image(asset, 'nor_gl', True) if shiny else None)
            PH_TILE[n] = tile
        say('photo surfaces on:', sorted(PH_TILE))
    return t


T = textures()
say('textures ready')


def tm(name, tex, tile, rough, strength=1.0, color=(1, 1, 1)):
    return material(name, color=color, rough=rough, albedo=T[tex][0], normal=T[tex][1], normal_strength=strength, tile=PH_TILE.get(tex, tile))


M = {
    'siding': tm('siding', 'siding', 0.5, 0.55),
    'siding_dummy': tm('siding_dummy', 'siding_dummy', 0.5, 0.55),
    'barn': tm('barn', 'barn', 1.4, 0.6),
    'greywood': tm('greywood', 'greywood', 0.75, 0.75),
    'shingles': tm('shingles', 'shingles', 1.1, 0.38),
    'tin': tm('tin', 'tin', 1.8, 0.3),
    'concrete': tm('concrete', 'concrete', 2.0, 0.7),
    'brick': tm('brick', 'brick', 0.6, 0.75),
    'bark': tm('bark', 'bark', 0.8, 0.8),
    'hay': tm('hay', 'hay', 0.55, 0.85),
    'twine': material('twine', (0.17, 0.14, 0.08), rough=0.8),
    'trim': material('trim', (0.62, 0.61, 0.57), rough=0.45),
    'glass': material('glass', (0.012, 0.016, 0.02), rough=0.05),
    'iron': material('iron', (0.045, 0.045, 0.05), rough=0.45, metal=0.85),
    'galv': material('galv', (0.42, 0.44, 0.46), rough=0.3, metal=0.9),
    'pumpkin': material('pumpkin', (0.62, 0.20, 0.03), rough=0.42),
    'stem': material('stem', (0.16, 0.2, 0.07), rough=0.7),
    'door_green': material('door_green', (0.05, 0.12, 0.085), rough=0.4),
    'door_red': material('door_red', (0.30, 0.04, 0.03), rough=0.45),
    'cloth': material('cloth', (0.20, 0.13, 0.10), rough=0.9),
    'cloth_blue': material('cloth_blue', (0.08, 0.12, 0.22), rough=0.9),
    'straw': material('straw', (0.55, 0.43, 0.2), rough=0.9),
    'stone': material('stone', (0.24, 0.23, 0.21), rough=0.55),
    'sign_board': material('sign_board', (0.66, 0.60, 0.48), rough=0.6),
    'sign_text': material('sign_text', (0.03, 0.022, 0.018), rough=0.5),
    'road_yellow': material('road_yellow', (0.62, 0.43, 0.04), rough=0.5),
    'road_white': material('road_white', (0.62, 0.62, 0.59), rough=0.5),
    'water': material('water', (0.012, 0.022, 0.028), rough=0.03),
    'far': material('far', (0.03, 0.04, 0.05), rough=1.0),
    'bulb': material('bulb', (1, 0.8, 0.55), emit=(1.0, 0.66, 0.34), emit_strength=40.0),
    'bulb_cool': material('bulb_cool', (1, 0.86, 0.7), emit=(1.0, 0.80, 0.56), emit_strength=40.0),
    'bulb_merc': material('bulb_merc', (0.8, 0.9, 1.0), emit=(0.60, 0.80, 1.0), emit_strength=40.0),
    'needles': material('needles', (0.011, 0.024, 0.017), rough=0.95),
    'window_a': material('window_a', emit_img=T['window_a'], emit_strength=2.2, rough=0.2),
    'window_b': material('window_b', emit_img=T['window_b'], emit_strength=1.9, rough=0.2),
}
for m in bpy.data.materials:
    m.use_backface_culling = True
M['bark_tree'] = tm('bark_tree', 'bark', 0.8, 0.8)
M['wire'] = material('wire', (0.02, 0.02, 0.022), rough=0.5)
M['needles'].use_backface_culling = False
M['far_woods'] = material('far_woods', (0.010, 0.014, 0.018), rough=1.0)
M['far_woods'].use_backface_culling = False
PH = os.path.join(os.path.dirname(os.path.abspath(OUT)), 'polyhaven')     # the CC0 photo skies and surfaces (see README credits)

STATIC = {'buildings': [], 'props': [], 'south': []}     # lightmapped, by atlas
UNBAKED = []                                             # in the world, lit at run time (thin or far things)
CHIMNEYS = []                                            # chimney tops (game x, y, z): the game puts smoke there
LINES = []                                               # thin things also drawn as 1-pixel lines in the game (game x, y, z pairs), so they never break into dashes far away
GLOW = []                                                # emissive things: no bake, no shadow
CASTERS = []                                             # stand-ins that only cast shadows in the bake
LIGHTS = []


# ================================================================ ground, creek, masks
def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def make_masks():
    """ground_splat: R gravel, G grass, B asphalt (what is left is mud or stubble).
    ground_wet: R puddles, G dampness, B stubble. Row 0 is the south edge (Blender's bottom row)."""
    N = 1024
    rng = np.random.default_rng(3)
    xs = BND['minX'] + (np.arange(N) + 0.5) / N * (BND['maxX'] - BND['minX'])
    zs = BND['maxZ'] - (np.arange(N) + 0.5) / N * (BND['maxZ'] - BND['minZ'])
    X, Z = np.meshgrid(xs, zs)
    n1 = tt_tex.fbm(N, 24, 4, rng)
    n2 = tt_tex.fbm(N, 10, 5, rng)
    n3 = tt_tex.fbm(N, 5, 5, rng)
    Zj = Z + (n1 - 0.5) * 1.6
    Xj = X + (np.roll(n1, 97, 1) - 0.5) * 1.6

    def band(z0, z1, soft=0.5):
        return smooth(z0 - soft, z0 + soft, Zj) * (1 - smooth(z1 - soft, z1 + soft, Zj))

    def rect(x0, x1, z0, z1, soft=0.6):
        return smooth(x0 - soft, x0 + soft, Xj) * (1 - smooth(x1 - soft, x1 + soft, Xj)) * band(z0, z1, soft)

    asphalt = np.maximum(band(62, 72, 0.25), band(80, 86, 0.25))
    yard = rect(-36, 36, -62, 0, 1.0)
    corn = rect(24.5, 36, -29, -1.5, 0.8)
    drive = rect(-2.4, 2.4, -3, 34.5, 0.5)
    gravel = np.maximum.reduce([drive, band(34, 40, 0.5), band(60.6, 62, 0.4) * 0.85, band(72, 73.4, 0.4) * 0.85, band(78.6, 80, 0.4) * 0.85, band(86, 87.4, 0.4) * 0.85,
                                band(18.6, 27.4, 0.6) * 0.7, yard * smooth(0.52, 0.66, n3) * 0.55])
    lane = band(6, 12, 0.6)
    fields = np.maximum.reduce([band(44, 58, 0.7), corn, (np.abs(Xj) > 42) * (Zj < -2) * 1.0])
    stubble = np.clip(fields, 0, 1) * (1 - asphalt)
    mud = np.clip(np.maximum(yard * (1 - corn), lane), 0, 1)
    grass = np.clip(1 - np.maximum.reduce([asphalt, gravel, mud, stubble]), 0, 1)
    grass = np.maximum(grass, yard * smooth(0.6, 0.75, np.roll(n3, 211, 0)) * 0.7 * (1 - corn))
    gravel = gravel * (1 - asphalt)
    splat = np.dstack([gravel, grass * (1 - gravel), asphalt])

    wetland = np.clip(mud + gravel * 0.8 + asphalt, 0, 1)
    puddle = smooth(0.66, 0.76, n2) * smooth(0.30, 0.55, n1) * wetland          # small broken pools, not sheets
    ruts = (np.exp(-((np.abs(X) - 0.8) / 0.22) ** 2) * (Z > -2) * (Z < 34)) * smooth(0.35, 0.6, n1)
    lane_ruts = np.exp(-((np.abs(Z - 9) - 0.85) / 0.25) ** 2) * smooth(0.3, 0.55, np.roll(n1, 50, 0))
    edge = np.maximum(np.exp(-((Z - 62.5) / 0.35) ** 2), np.exp(-((Z - 71.5) / 0.35) ** 2)) * smooth(0.4, 0.6, n2) + np.exp(-((Z - 85.5) / 0.3) ** 2) * smooth(0.4, 0.6, n3)
    puddles = np.clip(np.maximum.reduce([puddle, ruts * smooth(0.5, 0.72, np.roll(n2, 37, 1)) * 0.9, lane_ruts * smooth(0.5, 0.72, np.roll(n2, 91, 0)) * 0.9, edge * 0.9]), 0, 1)
    damp = np.clip(0.35 + 0.65 * n3, 0, 1) * np.clip(wetland + 0.5, 0, 1)
    wet = np.dstack([puddles, damp, stubble * (1 - gravel)])
    save_png('ground_splat', splat, os.path.join(ASSETS, 'ground_splat.png'), non_color=True)
    save_png('ground_wet', wet, os.path.join(ASSETS, 'ground_wet.png'), non_color=True)
    return load_image(os.path.join(ASSETS, 'ground_splat.png'), True), load_image(os.path.join(ASSETS, 'ground_wet.png'), True)


def ground_material(splat, wet):
    """for Blender's own renders and for the bounce colour in the bake; the game draws the ground with its own shader"""
    m = bpy.data.materials.new('ground')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get('Principled BSDF')
    s = nt.nodes.new('ShaderNodeTexImage'); s.image = splat
    w = nt.nodes.new('ShaderNodeTexImage'); w.image = wet
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(s.outputs['Color'], sep.inputs[0])
    wsep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(w.outputs['Color'], wsep.inputs[0])
    cols = [(0.040, 0.031, 0.023), (0.12, 0.115, 0.10), (0.055, 0.06, 0.028), (0.022, 0.023, 0.025), (0.10, 0.085, 0.05)]
    prev = None
    for i, (fac, c) in enumerate([(sep.outputs[0], cols[1]), (sep.outputs[1], cols[2]), (sep.outputs[2], cols[3]), (wsep.outputs[2], cols[4])]):
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
        if prev is None:
            mx.inputs[6].default_value = (*cols[0], 1)
        else:
            nt.links.new(prev, mx.inputs[6])
        mx.inputs[7].default_value = (*c, 1)
        nt.links.new(fac, mx.inputs[0])
        prev = mx.outputs[2]
    dark = nt.nodes.new('ShaderNodeMix'); dark.data_type = 'RGBA'
    nt.links.new(prev, dark.inputs[6])
    dark.inputs[7].default_value = (0.012, 0.012, 0.012, 1)
    nt.links.new(wsep.outputs[0], dark.inputs[0])
    nt.links.new(dark.outputs[2], b.inputs['Base Color'])
    r = nt.nodes.new('ShaderNodeMapRange')
    r.inputs[1].default_value = 0.0; r.inputs[2].default_value = 1.0; r.inputs[3].default_value = 0.6; r.inputs[4].default_value = 0.03
    nt.links.new(wsep.outputs[0], r.inputs[0])
    nt.links.new(r.outputs[0], b.inputs['Roughness'])
    m.use_backface_culling = True
    return m


def build_ground():
    splat, wet = make_masks()
    gm = ground_material(splat, wet)
    step = 1.4
    W, D = BND['maxX'] - BND['minX'], BND['maxZ'] - BND['minZ']
    nx, nz = int(W / step), int(D / step)
    creek = next(l for l in L['escape']['lanes'] if l['kind'] == 'creek')
    out = []
    split_z = (creek['z0'] + creek['z1']) / 2
    for name, z0, z1 in (('ground_n', BND['minZ'], split_z), ('ground_s', split_z, BND['maxZ'])):
        bm = bmesh.new()
        rows = max(2, int(round((z1 - z0) / step)))
        uv = bm.loops.layers.uv.new('UVMap')
        lm = bm.loops.layers.uv.new('lm')
        grid = [[None] * (nx + 1) for _ in range(rows + 1)]
        for j in range(rows + 1):
            z = z0 + (z1 - z0) * j / rows
            for i in range(nx + 1):
                x = BND['minX'] + W * i / nx
                y = 0.0
                if creek['z0'] - 0.2 < z < creek['z1'] + 0.2:
                    a = min(z - creek['z0'], creek['z1'] - z)
                    y = -0.85 * float(smooth(0.0, 1.9, np.array(a))) + 0.05 * math.sin(x * 0.7) * float(smooth(0.5, 2.0, np.array(a)))
                grid[j][i] = bm.verts.new(B(x, z, y))
        for j in range(rows):
            for i in range(nx):
                f = bm.faces.new([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]])
                for loop in f.loops:
                    p = loop.vert.co
                    gx, gz = p.x, -p.y
                    loop[uv].uv = ((gx - BND['minX']) / W, (BND['maxZ'] - gz) / D)
                    loop[lm].uv = ((gx - BND['minX']) / W, (z1 - gz) / (z1 - z0))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me); bm.free()
        for p in me.polygons:
            p.use_smooth = True
        if me.polygons and me.polygons[0].normal.z < 0:
            me.flip_normals()
        me.materials.append(gm)
        ob = bpy.data.objects.new(name, me)
        scene.collection.objects.link(ob)
        ob['kind'] = 'ground'
        out.append(ob)
    # the creek's water, and the far rim that closes the horizon
    w = Mesh('water')
    w.box(M['water'], (0, -(creek['z0'] + creek['z1']) / 2, -0.10), (BND['maxX'] - BND['minX'], creek['z1'] - creek['z0'] - 0.3, 0.04))      # the creek runs high after the storm
    wo = w.finish(); wo['kind'] = 'water'
    GLOW.append(wo)
    skirt = Mesh('far_fields')                              # dark land beyond the map, out to the fog
    skirt.box(M['far'], (0, -(BND['minZ'] + BND['maxZ']) / 2, -0.35), (900, 900, 0.5))
    so = skirt.finish(); so['kind'] = 'unbaked'
    UNBAKED.append(so)
    return out


# ================================================================ windows and doors
def pane(mesh, mat, wall, off, a, zc, w, h, depth=0.02):
    """one flat glowing or dark pane with its own 0..1 picture. wall: S N E W; off = where that wall is"""
    a0, a1, z0, z1 = a - w / 2, a + w / 2, zc - h / 2, zc + h / 2
    if wall == 'S':
        pts = [(a0, off - depth, z0), (a1, off - depth, z0), (a1, off - depth, z1), (a0, off - depth, z1)]
    elif wall == 'N':
        pts = [(a1, off + depth, z0), (a0, off + depth, z0), (a0, off + depth, z1), (a1, off + depth, z1)]
    elif wall == 'E':
        pts = [(off + depth, a0, z0), (off + depth, a1, z0), (off + depth, a1, z1), (off + depth, a0, z1)]
    else:
        pts = [(off - depth, a1, z0), (off - depth, a0, z0), (off - depth, a0, z1), (off - depth, a1, z1)]
    mesh.quads.append((mat, pts))


def frame(mesh, wall, off, a, zc, w, h, t=0.09, d=0.07, sill=True, mat=None):
    mat = mat or M['trim']

    def P(aa, zz, depth):
        return {'S': (aa, off - depth, zz), 'N': (aa, off + depth, zz), 'E': (off + depth, aa, zz), 'W': (off - depth, aa, zz)}[wall]

    def SZ(sa, sb, sd):
        return (sa, sd, sb) if wall in 'SN' else (sd, sa, sb)

    mesh.box(mat, P(a, zc + h / 2 + t / 2, d / 2), SZ(w + 2 * t, t, d))
    if sill:
        mesh.box(mat, P(a, zc - h / 2 - t / 2, d / 2 + 0.02), SZ(w + 2 * t + 0.1, t, d + 0.05))
    for s in (-1, 1):
        mesh.box(mat, P(a + s * (w / 2 + t / 2), zc, d / 2), SZ(t, h + (0 if sill else t), d))


class QuadMesh:
    """flat one-sided pictures (window panes): explicit corners, explicit 0..1 UVs, no normal guessing"""

    def __init__(self, name, x, z, rot):
        self.name, self.at, self.rot, self.quads = name, B(x, z), rot, []

    def finish(self):
        if not self.quads:
            return None
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new('UVMap')
        mats = []
        for mat, pts in self.quads:
            if mat not in mats:
                mats.append(mat)
            f = bm.faces.new([bm.verts.new(Vector(p)) for p in pts])
            f.material_index = mats.index(mat)
            for loop, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                loop[uv].uv = t
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me); bm.free()
        for m in mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me)
        ob.location = self.at
        ob.rotation_euler = (0, 0, self.rot)
        scene.collection.objects.link(ob)
        return ob


def point_light(name, x, y, z, color, watts, size=0.12, local=None):
    d = bpy.data.lights.new(name, 'POINT')
    d.energy = watts
    d.color = color
    d.shadow_soft_size = size
    o = bpy.data.objects.new(name, d)
    o.location = B(x, z, y)
    scene.collection.objects.link(o)
    LIGHTS.append(o)
    return o


def hexcol(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(pow(v, 2.2) for v in c)


# ================================================================ buildings
def farmhouse():
    c = COL['farmhouse']
    W, D, H, F = c['w'], c['d'], 5.7, 0.5
    m = Mesh('farmhouse', c['x'], c['z'], c['rotY'])
    g = QuadMesh('farmhouse_glow', c['x'], c['z'], c['rotY'])
    dk = QuadMesh('farmhouse_glass', c['x'], c['z'], c['rotY'])
    m.box(M['concrete'], (0, 0, F / 2), (W + 0.12, D + 0.12, F))
    m.box(M['siding'], (0, 0, F + H / 2), (W, D, H))
    rise = 3.3
    top = F + H
    for sx in (-1, 1):
        m.prism(M['siding'], [(sx * W / 2, -D / 2, top), (sx * W / 2, D / 2, top), (sx * W / 2, 0, top + rise)], (-sx * 0.2, 0, 0))
    m.gable(M['shingles'], top, W, D, rise, ov=0.45, ridge='x')
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box(M['trim'], (sx * (W / 2 + 0.01), sy * (D / 2 + 0.01), F + H / 2), (0.16, 0.16, H))
    for sy in (-1, 1):
        m.box(M['trim'], (0, sy * (D / 2 + 0.45), top - 0.45 * rise / (D / 2) - 0.12), (W + 0.9, 0.05, 0.2))
    m.box(M['brick'], (W / 2 - 1.3, 0.9, top + rise * 0.55 + 0.6), (0.85, 0.85, rise + 1.6))
    CHIMNEYS.append({'id': 'farmhouse', 'x': c['x'] + W / 2 - 1.3, 'y': round(top + rise * 0.55 + 0.6 + (rise + 1.6) / 2, 3), 'z': c['z'] - 0.9})
    m.box(M['concrete'], (W / 2 - 1.3, 0.9, top + rise * 0.55 + 1.45 + rise / 2 - 0.05), (1.0, 1.0, 0.12))
    S = -D / 2
    # front (south): door, two lit windows down, three up (one lit)
    frame(m, 'S', S, 0, F + 1.05, 1.0, 2.1, sill=False)
    m.box(M['door_red'], (0, S - 0.03, F + 1.05), (1.0, 0.06, 2.1))
    m.box(M['iron'], (0.36, S - 0.07, F + 1.0), (0.05, 0.04, 0.05))
    for a, lit in ((-3.4, 'window_a'), (3.4, 'window_b')):
        frame(m, 'S', S, a, F + 1.6, 1.25, 1.6)
        pane(g, M[lit], 'S', S, a, F + 1.6, 1.25, 1.6)
    for a, lit in ((-3.4, None), (0, 'window_a'), (3.4, None)):
        frame(m, 'S', S, a, F + 4.2, 1.1, 1.4)
        pane(g if lit else dk, M[lit] if lit else M['glass'], 'S', S, a, F + 4.2, 1.1, 1.4)
    for wall, off in (('E', W / 2), ('W', -W / 2)):
        for a, zc, lit in ((-2.0, F + 1.6, None), (2.0, F + 1.6, 'window_b' if wall == 'E' else None), (0, F + 4.2, None)):
            frame(m, wall, off, a, zc, 1.1, 1.5)
            pane(g if lit else dk, M[lit] if lit else M['glass'], wall, off, a, zc, 1.1, 1.5)
        frame(m, wall, off, 0, top + rise * 0.45, 0.7, 0.8)
        pane(dk, M['glass'], wall, off, 0, top + rise * 0.45, 0.7, 0.8)
    for a in (-3.4, 0, 3.4):
        frame(m, 'N', D / 2, a, F + 1.6, 1.1, 1.5)
        pane(dk, M['glass'], 'N', D / 2, a, F + 1.6, 1.1, 1.5)
    # porch: deck, steps, posts, rail, roof
    p = COL['porch']
    PD = p['d']
    py = S - PD / 2
    deck = F
    m.box(M['greywood'], (0, py, deck - 0.06), (W, PD, 0.12))
    m.box(M['concrete'], (0, py, (deck - 0.12) / 2), (W - 0.2, PD - 0.2, deck - 0.12))
    for k in range(3):
        m.box(M['greywood'], (0, S - PD - 0.16 - 0.3 * k, deck - 0.12 - 0.16 * (k + 0.5) + 0.04), (2.2, 0.3, 0.07))
        m.box(M['greywood'], (0, S - PD - 0.16 - 0.3 * k, (deck - 0.16 * (k + 1)) / 2), (2.0, 0.26, max(0.05, deck - 0.16 * (k + 1))))
    posts = [-W / 2 + 0.2, -W / 4, -1.25, 1.25, W / 4, W / 2 - 0.2]
    for a in posts:
        m.box(M['trim'], (a, S - PD + 0.12, deck + 1.3), (0.13, 0.13, 2.6))
    rail_spans = [(posts[0], posts[1]), (posts[1], posts[2]), (posts[3], posts[4]), (posts[4], posts[5])]
    for a0, a1 in rail_spans:
        for zz in (deck + 0.18, deck + 0.9):
            m.box(M['trim'], ((a0 + a1) / 2, S - PD + 0.12, zz), (a1 - a0, 0.05, 0.07))
        n = int((a1 - a0) / 0.16)
        for k in range(1, n):
            m.box(M['trim'], (a0 + (a1 - a0) * k / n, S - PD + 0.12, deck + 0.54), (0.03, 0.03, 0.72))
    for sx in (-1, 1):
        for zz in (deck + 0.18, deck + 0.9):
            m.box(M['trim'], (sx * (W / 2 - 0.2), py + 0.06, zz), (0.05, PD - 0.24, 0.07))
    m.slab(M['shingles'], (0, S - PD - 0.3, deck + 2.62), (0, S + 0.02, deck + 3.25), (W + 0.5, 0, 0), 0.1)
    m.box(M['trim'], (0, S - PD + 0.12, deck + 2.56), (W, 0.1, 0.16))
    m.box(M['trim'], (0, S - 0.2, deck + 3.0), (W, 0.02, 0.3))
    # porch lamp by the door
    gb = Mesh('farmhouse_bulbs', c['x'], c['z'], c['rotY'])
    gb.box(M['iron'], (0.8, S - 0.08, F + 2.15), (0.14, 0.1, 0.22))
    gb.sphere(M['bulb'], (0.8, S - 0.16, F + 2.08), 0.06)
    STATIC['buildings'].append(m.finish())
    GLOW.extend([g.finish(), dk.finish(), gb.finish()])


def barn():
    w, e, bk = COL['barn_west'], COL['barn_east'], COL['barn_back']
    cx = (w['x'] + e['x']) / 2
    z_front = COL['barn_front_w']['z'] + 0.25
    z_back = w['z'] - w['d'] / 2
    cz = (z_front + z_back) / 2
    W, D = (e['x'] - w['x']) + 0.5, z_front - z_back
    H, F = 5.0, 0.4
    m = Mesh('barn', cx, cz, 0)
    hy = D / 2
    S, N = -hy, hy
    DW, DH = 4.2, 4.3
    m.box(M['concrete'], (0, 0, F / 2), (W + 0.14, D + 0.14, F))
    # side and back walls, front wall around the door
    for sx in (-1, 1):
        m.box(M['barn'], (sx * (W / 2 - 0.12), 0, F + H / 2), (0.24, D, H))
    m.box(M['barn'], (0, N - 0.12, F + H / 2), (W, 0.24, H))
    side = (W - DW) / 2
    for sx in (-1, 1):
        m.box(M['barn'], (sx * (DW / 2 + side / 2), S + 0.12, F + H / 2), (side, 0.24, H))
    m.box(M['barn'], (0, S + 0.12, F + DH + (H - DH) / 2), (DW, 0.24, H - DH))
    # gambrel: break and ridge
    bx, bz, rz = W / 2 - 2.9, F + H + 2.6, F + H + 4.4
    for y_, off in ((S, (0, 0.24, 0)), (N - 0.24, (0, 0.24, 0))):
        m.prism(M['barn'], [(-W / 2, y_, F + H), (W / 2, y_, F + H), (bx, y_, bz), (0, y_, rz), (-bx, y_, bz)], off)
    ov = 0.5
    m.swap = True
    for sx in (-1, 1):
        m.slab(M['tin'], (sx * (W / 2 + 0.35), 0, F + H - 0.3), (sx * bx, 0, bz + 0.05), (0, D + 2 * ov, 0), 0.1)
        m.slab(M['tin'], (sx * (bx + 0.05), 0, bz), (0, 0, rz + 0.06), (0, D + 2 * ov, 0), 0.1)
    m.swap = False
    m.box(M['tin'], (0, 0, rz + 0.1), (0.5, D + 2 * ov, 0.08))
    # trim: corners, door surround, loft door with a cross
    for sx in (-1, 1):
        for y_ in (S - 0.01, N + 0.01):
            m.box(M['trim'], (sx * (W / 2 + 0.01), y_, F + H / 2), (0.2, 0.2, H))
        m.box(M['trim'], (sx * (DW / 2 + 0.1), S - 0.02, F + DH / 2), (0.2, 0.08, DH))
    m.box(M['trim'], (0, S - 0.02, F + DH + 0.1), (DW + 0.4, 0.08, 0.2))
    m.box(M['iron'], (0, S - 0.1, F + DH + 0.32), (W - 1.0, 0.06, 0.08))
    for sx in (-1, 1):                                    # the sliding doors, pushed open
        dx = sx * (DW / 2 + 1.25)
        m.box(M['barn'], (dx, S - 0.14, F + DH / 2 + 0.05), (2.2, 0.08, DH))
        for a, b in (((-1.05, -DH / 2), (1.05, DH / 2)), ((-1.05, DH / 2), (1.05, -DH / 2))):
            m.slab(M['trim'], (dx + a[0], S - 0.2, F + DH / 2 + 0.05 + a[1]), (dx + b[0], S - 0.2, F + DH / 2 + 0.05 + b[1]), (0, 0, 0.14), 0.03)
        for zz in (F + 0.12, F + DH - 0.02):
            m.box(M['trim'], (dx, S - 0.19, zz), (2.2, 0.03, 0.14))
        for xx in (dx - 1.03, dx + 1.03):
            m.box(M['trim'], (xx, S - 0.19, F + DH / 2 + 0.05), (0.14, 0.03, DH))
    lz = F + H + 1.5
    m.box(M['barn'], (0, S - 0.03, lz), (1.6, 0.06, 1.8))
    frame(m, 'S', S, 0, lz, 1.6, 1.8, sill=False)
    for a, b in (((-0.8, -0.9), (0.8, 0.9)), ((-0.8, 0.9), (0.8, -0.9))):
        m.slab(M['trim'], (a[0], S - 0.08, lz + a[1]), (b[0], S - 0.08, lz + b[1]), (0, 0, 0.12), 0.03)
    # inside: floor, loft floor, the back wall of the part you can walk into, hay
    inner = z_front - bk['z']                              # how deep the open part is
    m.box(M['concrete'], (0, 0, F - 0.04), (W - 0.5, D - 0.5, 0.08))
    m.box(M['greywood'], (0, 0, F + DH + 0.25), (W - 0.5, D - 0.5, 0.12))
    m.box(M['greywood'], (0, S + inner + 0.12, F + (DH + 0.2) / 2), (W - 0.5, 0.24, DH + 0.2))
    for (bx_, by_, n) in ((-W / 2 + 1.3, S + inner - 0.9, 3), (W / 2 - 1.2, S + inner - 0.8, 2), (W / 2 - 1.2, S + 1.6, 1)):
        for k in range(n):
            m.box(M['hay'], (bx_ + 0.05 * rnd.uniform(-1, 1), by_, F + 0.23 + 0.46 * k), (1.1, 0.55 + 0.9 * (k == 0), 0.48), rot=rot_z(rnd.uniform(-0.08, 0.08)))
    for k in range(5):
        m.cyl(M['greywood'], (-W / 2 + 0.5, S + 0.8 + k * 1.1, F), (-W / 2 + 0.5, S + 0.8 + k * 1.1, F + DH), 0.08, segs=6)
    # cupola
    m.box(M['barn'], (0, 0, rz + 0.7), (1.3, 1.3, 1.2))
    m.gable(M['tin'], rz + 1.3, 1.3, 1.3, 0.7, ov=0.25, ridge='y')
    # lamps: one over the door, one bare bulb inside
    gb = Mesh('barn_bulbs', cx, cz, 0)
    gb.cyl(M['iron'], (0, S - 0.05, F + DH + 1.0), (0, S - 0.75, F + DH + 1.15), 0.025, segs=6)
    gb.cyl(M['iron'], (0, S - 0.75, F + DH + 1.2), (0, S - 0.75, F + DH + 0.98), 0.03, 0.26, segs=12)
    gb.sphere(M['bulb_cool'], (0, S - 0.75, F + DH + 0.98), 0.08)
    gb.cyl(M['iron'], (0, S + 3.0, F + DH + 0.2), (0, S + 3.0, F + 3.75), 0.008, segs=4)
    gb.sphere(M['bulb'], (0, S + 3.0, F + 3.68), 0.07)
    STATIC['buildings'].append(m.finish())
    GLOW.append(gb.finish())


def silo():
    c = COL['silo']
    R, H = c['r'] - 0.15, c['h']
    m = Mesh('silo', c['x'], c['z'], 0)
    m.cyl(M['concrete'], (0, 0, 0), (0, 0, H), R, segs=28)
    k = 0.6
    while k < H:
        m.cyl(M['iron'], (0, 0, k), (0, 0, k + 0.05), R + 0.025, segs=28)
        k += 0.85
    m.cyl(M['tin'], (0, 0, H), (0, 0, H + 0.9), R + 0.12, R * 0.72, segs=28)
    m.cyl(M['tin'], (0, 0, H + 0.9), (0, 0, H + 1.5), R * 0.72, R * 0.3, segs=28)
    m.cyl(M['tin'], (0, 0, H + 1.5), (0, 0, H + 1.75), R * 0.3, 0.05, segs=28)
    for s in (-1, 1):
        m.box(M['iron'], (s * 0.22, -R - 0.12, H / 2 + 0.4), (0.035, 0.035, H))
    for k in range(int(H / 0.35)):
        m.box(M['iron'], (0, -R - 0.12, 0.6 + k * 0.35), (0.44, 0.03, 0.03))
    STATIC['buildings'].append(m.finish(smooth=False))


def shed():
    n, s, e = COL['shed_north'], COL['shed_south'], COL['shed_east']
    cx, cz = n['x'], e['z']
    W, D = n['w'], (s['z'] - n['z']) + 0.4
    m = Mesh('shed', cx, cz, 0)
    Hf, Hb = 3.6, 2.9                                      # open west front is the high side
    for sy in (-1, 1):
        m.prism(M['tin'], [(-W / 2, sy * D / 2 - 0.1, 0), (W / 2, sy * D / 2 - 0.1, 0), (W / 2, sy * D / 2 - 0.1, Hb), (-W / 2, sy * D / 2 - 0.1, Hf)], (0, 0.2, 0))
    m.box(M['tin'], (W / 2 - 0.1, 0, Hb / 2), (0.2, D, Hb))
    m.swap = True
    m.slab(M['tin'], (-W / 2 - 0.5, 0, Hf + 0.1 + 0.5 * (Hf - Hb) / W), (W / 2 + 0.3, 0, Hb + 0.1 - 0.3 * (Hf - Hb) / W), (0, D + 0.6, 0), 0.08)
    m.swap = False
    for k in range(4):
        y_ = -D / 2 + 0.2 + (D - 0.4) * k / 3
        m.box(M['greywood'], (-W / 2 + 0.1, y_, Hf / 2), (0.18, 0.18, Hf))
    m.box(M['greywood'], (-W / 2 + 0.1, 0, Hf - 0.1), (0.14, D, 0.2))
    m.box(M['concrete'], (0, 0, 0.02), (W, D, 0.04))
    m.box(M['greywood'], (W / 2 - 0.6, -D / 2 + 1.6, 0.85), (0.8, 2.6, 0.08))      # workbench
    for sy in (-1, 1):
        m.box(M['greywood'], (W / 2 - 0.6, -D / 2 + 1.6 + sy * 1.2, 0.42), (0.7, 0.08, 0.84))
    m.box(M['iron'], (W / 2 - 0.55, -D / 2 + 1.2, 1.05), (0.3, 0.5, 0.3))
    for k in range(3):                                     # an old disc harrow, read as dark steel shapes
        m.cyl(M['iron'], (0.6, 1.4 + k * 0.7, 0.5), (0.68, 1.4 + k * 0.7, 0.5), 0.5, segs=14)
    m.cyl(M['iron'], (0.64, 0.9, 0.5), (0.64, 3.4, 0.5), 0.04, segs=6)
    m.cyl(M['iron'], (0.64, 2.1, 0.5), (-1.6, 2.1, 0.75), 0.04, segs=6)
    gb = Mesh('shed_bulbs', cx, cz, 0)
    gb.cyl(M['iron'], (-0.6, 0, 3.2), (-0.6, 0, 2.86), 0.008, segs=4)
    gb.sphere(M['bulb'], (-0.6, 0, 2.8), 0.06)
    STATIC['buildings'].append(m.finish())
    GLOW.append(gb.finish())


def coop():
    c = COL['coop']
    W, D, H = c['w'], c['d'], 1.9
    m = Mesh('coop', c['x'], c['z'], c['rotY'])
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box(M['greywood'], (sx * (W / 2 - 0.1), sy * (D / 2 - 0.1), 0.25), (0.12, 0.12, 0.5))
    m.box(M['greywood'], (0, 0, 0.5 + H / 2), (W, D, H))
    for sx in (-1, 1):
        m.prism(M['greywood'], [(sx * W / 2, -D / 2, 0.5 + H), (sx * W / 2, D / 2, 0.5 + H), (sx * W / 2, 0, 0.5 + H + 0.8)], (-sx * 0.1, 0, 0))
    m.gable(M['tin'], 0.5 + H, W, D, 0.8, ov=0.25, ridge='x', thick=0.06)
    m.slab(M['greywood'], (0.9, -D / 2 - 1.3, 0.02), (0.9, -D / 2, 0.6), (0.5, 0, 0), 0.04)
    m.box(M['iron'], (-0.7, -D / 2 - 0.01, 1.5), (1.0, 0.03, 0.7))
    frame(m, 'S', -D / 2, -0.7, 1.5, 1.0, 0.7, t=0.06, d=0.05, sill=False, mat=M['greywood'])
    STATIC['props'].append(m.finish())


def dummy_house():
    c = COL['dummy_house']
    W, D, H, F = c['w'], c['d'], 2.9, 0.3
    m = Mesh('dummy_house', c['x'], c['z'], 0)
    g = QuadMesh('dummy_glow', c['x'], c['z'], 0)
    dk = QuadMesh('dummy_glass', c['x'], c['z'], 0)
    m.box(M['concrete'], (0, 0, F / 2), (W + 0.1, D + 0.1, F))
    m.box(M['siding_dummy'], (0, 0, F + H / 2), (W, D, H))
    rise, top = 2.9, F + H
    for sx in (-1, 1):
        m.prism(M['siding_dummy'], [(sx * W / 2, -D / 2, top), (sx * W / 2, D / 2, top), (sx * W / 2, 0, top + rise)], (-sx * 0.2, 0, 0))
    m.gable(M['shingles'], top, W, D, rise, ov=0.4, ridge='x')
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box(M['trim'], (sx * (W / 2 + 0.01), sy * (D / 2 + 0.01), F + H / 2), (0.14, 0.14, H))
    m.box(M['brick'], (-W / 2 + 1.1, -0.6, top + rise * 0.6 + 0.4), (0.7, 0.7, rise + 1.0))
    CHIMNEYS.append({'id': 'dummy_house', 'x': c['x'] - W / 2 + 1.1, 'y': round(top + rise * 0.6 + 0.4 + (rise + 1.0) / 2, 3), 'z': c['z'] + 0.6})
    N = D / 2                                              # the door is on the north side: the turkey comes from the north
    frame(m, 'N', N, 0, F + 1.02, 0.95, 2.04, sill=False)
    m.box(M['door_green'], (0, N + 0.03, F + 1.02), (0.95, 0.06, 2.04))
    m.box(M['galv'], (-0.33, N + 0.07, F + 1.0), (0.05, 0.04, 0.05))
    m.box(M['stone'], (0, N + 0.75, 0.05), (1.9, 1.4, 0.1))
    for a, lit in ((-2.3, 'window_a'), (2.3, 'window_b')):
        frame(m, 'N', N, a, F + 1.5, 1.05, 1.3)
        pane(g, M[lit], 'N', N, a, F + 1.5, 1.05, 1.3)
    frame(m, 'N', N, 0, top + rise * 0.42, 0.7, 0.8)
    pane(dk, M['glass'], 'N', N, 0, top + rise * 0.42, 0.7, 0.8)
    for wall, off in (('E', W / 2), ('W', -W / 2)):
        frame(m, wall, off, 0, F + 1.5, 1.0, 1.3)
        pane(dk, M['glass'], wall, off, 0, F + 1.5, 1.0, 1.3)
    # a small roof over the door
    m.slab(M['shingles'], (0, N + 1.0, F + 2.35), (0, N - 0.02, F + 2.85), (1.9, 0, 0), 0.08)
    for sx in (-1, 1):
        m.slab(M['trim'], (sx * 0.85, N + 0.95, F + 2.32), (sx * 0.85, N + 0.02, F + 1.75), (0.06, 0, 0), 0.06)
    gb = Mesh('dummy_bulbs', c['x'], c['z'], 0)
    gb.box(M['iron'], (0.78, N + 0.07, F + 2.05), (0.13, 0.1, 0.2))
    gb.sphere(M['bulb'], (0.78, N + 0.15, F + 1.98), 0.055)
    STATIC['south'].append(m.finish())
    GLOW.extend([g.finish(), dk.finish(), gb.finish()])
    # the sign: two posts, a painted board, letters as real shapes, and its own little lamp. It faces north.
    sg = L['escape']['finish']['signAt']
    SIGN_ROT = sg.get('rotY', 0.35)                        # which way the board faces (0 = north)
    s = Mesh('dummy_sign', sg['x'], sg['z'], SIGN_ROT)
    BW, BH, BZ = 2.5, 0.72, 1.5
    for sx in (-1, 1):
        s.box(M['greywood'], (sx * (BW / 2 - 0.12), -0.07, (BZ + BH / 2) / 2), (0.1, 0.1, BZ + BH / 2))
    s.box(M['sign_board'], (0, 0, BZ), (BW, 0.045, BH))
    s.box(M['greywood'], (0, 0.0, BZ + BH / 2 + 0.03), (BW + 0.1, 0.07, 0.06))
    so = s.finish()
    STATIC['south'].append(so)
    bpy.ops.object.text_add(location=(0, 0, 0))
    t = bpy.context.active_object
    t.data.body = L['escape']['finish']['signText']
    t.data.align_x = 'CENTER'
    t.data.align_y = 'CENTER'
    t.data.size = 0.3
    t.data.extrude = 0.006
    bpy.ops.object.convert(target='MESH')
    t = bpy.context.active_object
    width = t.dimensions.x
    k = min(1.0, (BW - 0.3) / max(width, 0.01))
    t.scale = (k, k, 1)
    # stand it up on the north face of the board, reading left to right for someone looking south
    t.rotation_euler = (math.radians(90), 0, math.radians(180))
    t.location = Vector((0, 0.035, BZ))
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    t.rotation_euler = (0, 0, SIGN_ROT)
    t.location = B(sg['x'], sg['z'])
    t.data.materials.append(M['sign_text'])
    t.name = 'dummy_sign_text'
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    GLOW.append(t)
    lb = Mesh('sign_bulbs', sg['x'], sg['z'], SIGN_ROT)
    lb.cyl(M['iron'], (0, 0.0, BZ + BH / 2 + 0.06), (0, 0.42, BZ + BH / 2 + 0.3), 0.012, segs=5)
    lb.cyl(M['iron'], (0, 0.42, BZ + BH / 2 + 0.34), (0, 0.42, BZ + BH / 2 + 0.22), 0.02, 0.1, segs=10)
    lb.sphere(M['bulb'], (0, 0.42, BZ + BH / 2 + 0.22), 0.035)
    GLOW.append(lb.finish())
    wx, wz = sg['x'] - 0.42 * math.sin(SIGN_ROT), sg['z'] - 0.42 * math.cos(SIGN_ROT)
    point_light('sign_lamp', wx, BZ + BH / 2 + 0.2, wz, (1.0, 0.75, 0.5), 22, size=0.05)


def windmill():
    c = COL['windmill']
    m = Mesh('windmill', c['x'], c['z'], c['rotY'])
    Hh, b, t = 11.0, 1.15, 0.22
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for sx, sy in corners:
        m.cyl(M['galv'], (sx * b, sy * b, 0), (sx * t, sy * t, Hh), 0.045, 0.03, segs=5)
    levels = 6
    for k in range(levels):
        f0, f1 = k / levels, (k + 1) / levels
        r0, r1 = b + (t - b) * f0, b + (t - b) * f1
        z0, z1 = Hh * f0, Hh * f1
        for i in range(4):
            a, bb = corners[i], corners[(i + 1) % 4]
            m.cyl(M['galv'], (a[0] * r1, a[1] * r1, z1), (bb[0] * r1, bb[1] * r1, z1), 0.015, segs=4)
            m.cyl(M['galv'], (a[0] * r0, a[1] * r0, z0), (bb[0] * r1, bb[1] * r1, z1), 0.012, segs=4)
    m.box(M['galv'], (0, 0, Hh + 0.1), (0.6, 0.6, 0.06))
    m.cyl(M['galv'], (0, 0.5, Hh + 0.5), (0, -1.9, Hh + 0.5), 0.03, segs=5)
    m.prism(M['galv'], [(0, -1.2, Hh + 0.15), (0, -2.3, Hh + 0.0), (0, -2.3, Hh + 1.0), (0, -1.2, Hh + 0.85)], (0.02, 0, 0))
    UNBAKED.append(m.finish())
    wheel = Mesh('windmill_wheel', 0, 0, 0)
    for k in range(18):
        a = 2 * math.pi * k / 18
        wheel.slab(M['galv'], (0.25 * math.cos(a), 0, 0.25 * math.sin(a)), (1.25 * math.cos(a), 0.1, 1.25 * math.sin(a)), (-0.3 * math.sin(a), 0.0, 0.3 * math.cos(a)), 0.008)
    wheel.cyl(M['galv'], (0, -0.05, 0), (0, 0.1, 0), 0.26, segs=12)
    wo = wheel.finish()
    hub = Vector((0, 0.62, Hh + 0.5))
    hub.rotate(Matrix.Rotation(c['rotY'], 3, 'Z'))
    wo.location = B(c['x'], c['z']) + hub
    wo.rotation_euler = (0, 0, c['rotY'])
    wo['kind'] = 'spin'
    UNBAKED.append(wo)


# ================================================================ fences, poles, trees, small things
def fences():
    m = Mesh('fences')
    for f in L['fences']:
        a, b = B(f['x1'], f['z1']), B(f['x2'], f['z2'])
        d = b - a
        n = max(1, int(round(d.length / 2.5)))
        u = d.normalized()
        ang = math.atan2(u.y, u.x)
        for k in range(n + 1):
            p = a + d * (k / n)
            lean = Matrix.Rotation(rnd.uniform(-0.05, 0.05), 4, 'X') @ Matrix.Rotation(rnd.uniform(-0.05, 0.05), 4, 'Y')
            m.box(M['greywood'], (p.x, p.y, 0.62), (0.13, 0.13, 1.3 + rnd.uniform(-0.05, 0.08)), rot=lean)
        for k in range(n):
            p0, p1 = a + d * (k / n), a + d * ((k + 1) / n)
            for zz in (0.38, 0.72, 1.06):
                sag = rnd.uniform(-0.03, 0.03)
                m.slab(M['greywood'], (p0.x, p0.y, zz + sag), (p1.x, p1.y, zz - sag), (0, 0, 0.1), 0.035)
    gate = L['exits'][2]
    for sx in (-1, 1):                                    # the open south gate: two tall posts and the gate leaf swung in
        m.box(M['greywood'], (gate['x'] + sx * 3.0, -gate['z'], 0.85), (0.2, 0.2, 1.7))
    hinge = Vector((gate['x'] - 3.0, -gate['z'] + 0.12, 0))
    swing = Vector((0.32, 1.0, 0)).normalized() * 2.8
    for zz in (0.3, 0.6, 0.9, 1.2):
        m.slab(M['greywood'], (hinge.x, hinge.y, zz), (hinge.x + swing.x, hinge.y + swing.y, zz), (0, 0, 0.09), 0.03)
    m.slab(M['greywood'], (hinge.x, hinge.y, 0.3), (hinge.x + swing.x, hinge.y + swing.y, 1.2), (0, 0, 0.09), 0.03)
    o = m.finish(); o['kind'] = 'unbaked'
    UNBAKED.append(o)


def pole_lamp(mesh, glow, x, z, y, arm_dir=(1, 0), cool=False, trunk=True, bulb=None):
    p = B(x, z)
    if trunk:
        mesh.cyl(M['bark'], (p.x, p.y, 0), (p.x, p.y, y + 0.9), 0.14, 0.1, segs=8)
    ax, ay = arm_dir
    mesh.cyl(M['iron'], (p.x, p.y, y + 0.55), (p.x + ax * 1.5, p.y + ay * 1.5, y + 0.3), 0.03, segs=6)
    glow.cyl(M['iron'], (p.x + ax * 1.5, p.y + ay * 1.5, y + 0.36), (p.x + ax * 1.5, p.y + ay * 1.5, y + 0.2), 0.1, 0.24, segs=12)
    glow.sphere(M[bulb or ('bulb_cool' if cool else 'bulb')], (p.x + ax * 1.5, p.y + ay * 1.5, y + 0.19), 0.11, scale=(1, 1, 0.5))


def poles_and_wires():
    m = Mesh('poles')
    g = Mesh('pole_bulbs')
    lamps = {l['id']: l for l in L['lamps']}
    pole_lamp(m, g, lamps['yard']['x'] - 1.5, lamps['yard']['z'], lamps['yard']['y'], (1, 0))
    pole_lamp(m, g, lamps['highway_w']['x'], lamps['highway_w']['z'] - 1.5, lamps['highway_w']['y'], (0, -1))
    pole_lamp(m, g, lamps['highway_e']['x'], lamps['highway_e']['z'] + 1.5, lamps['highway_e']['y'], (0, 1))
    for l in L['lamps']:                                  # the lamps along the turkey's way out: own poles, or arms on the power poles
        at = l.get('pole') or l.get('arm')
        if not at:
            continue
        dx, dy = l['x'] - at['x'], -(l['z'] - at['z'])
        n = math.hypot(dx, dy) or 1.0
        pole_lamp(m, g, at['x'], at['z'], l['y'], (dx / n, dy / n), trunk='pole' in l, bulb='bulb_merc' if l['color'].lower() == '#cfe6ff' else None)
    line = []
    for x in range(-66, 67, 33):                          # the power line along the north side of the gravel road
        p = B(x, 32.6)
        m.cyl(M['bark'], (p.x, p.y, 0), (p.x, p.y, 8.2), 0.13, 0.09, segs=7)
        m.box(M['bark'], (p.x, p.y, 7.7), (0.1, 1.8, 0.1))
        for sy in (-0.75, 0.75):
            m.cyl(M['glass'], (p.x, p.y + sy, 7.75), (p.x, p.y + sy, 7.92), 0.035, segs=6)
        line.append(p)
    w = Mesh('wires')
    for a, b in zip(line[:-1], line[1:]):
        for sy in (-0.75, 0.75):
            prev = None
            for k in range(9):
                t = k / 8
                q = Vector((a.x + (b.x - a.x) * t, a.y + sy, 7.92 - 1.1 * 4 * t * (1 - t)))
                if prev is not None:
                    w.cyl(M['wire'], prev, q, 0.014, segs=3, caps=False)
                    LINES.append([round(v, 3) for v in (prev.x, prev.z, -prev.y, q.x, q.z, -q.y)])
                prev = q
    STATIC['props'].append(m.finish())
    GLOW.append(g.finish())
    wo = w.finish(); wo['kind'] = 'unbaked'
    UNBAKED.append(wo)


def tree(m, base, height, seed, girth=1.0, deep=4):
    r = random.Random(seed)
    bark = M['bark_tree']

    def branch(p, d, length, radius, depth):
        d = d.normalized()
        end = p + d * length
        m.cyl(bark, p, end, radius, radius * 0.68, segs=6 if depth < 2 else 3, caps=False)
        if depth >= deep or radius < 0.012:
            return
        kids = 3 if depth < 1 else r.choice((2, 3, 3))
        for k in range(kids):
            axis = Vector((r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-0.25, 0.5))).normalized()
            ang = r.uniform(0.35, 0.8) * (1 if depth else 0.75)
            nd = d.copy()
            nd.rotate(Matrix.Rotation(ang, 3, axis.cross(d).normalized() if axis.cross(d).length > 0.01 else Vector((1, 0, 0))))
            nd = (nd + Vector((0, 0, 0.22))).normalized()
            branch(end, nd, length * r.uniform(0.55, 0.8), radius * r.uniform(0.45, 0.62), depth + 1)
        if depth < 3:                                        # the leader carries on
            branch(end, (d + Vector((r.uniform(-0.2, 0.2), r.uniform(-0.2, 0.2), 0.4))).normalized(), length * 0.75, radius * 0.7, depth + 1)

    trunk = height * 0.26
    m.cyl(bark, (base.x, base.y, -0.1), (base.x, base.y, 0.5), 0.3 * girth * height / 9, 0.19 * girth * height / 9, segs=8, caps=False)
    branch(Vector((base.x, base.y, 0.45)), Vector((r.uniform(-0.06, 0.06), r.uniform(-0.06, 0.06), 1)), trunk, 0.19 * girth * height / 9, 0)


TREES_VERSION = 3


def trees():
    oak = COL['oak']
    cache = os.path.join(OUT, f'trees_v{TREES_VERSION}.blend')
    if os.path.exists(cache):
        with bpy.data.libraries.load(cache) as (src, dst):
            dst.objects = [n for n in src.objects if n == 'trees']
        o = dst.objects[0]
        scene.collection.objects.link(o)
        o.data.materials.clear()
        o.data.materials.append(M['bark_tree'])
        o['kind'] = 'unbaked'
        UNBAKED.append(o)
        say('trees: from cache')
        swing_only = True
    else:
        swing_only = False
    m = Mesh('trees')
    if not swing_only:
        tree(m, B(oak['x'], oak['z']), 13, 5, girth=1.5, deep=5)
    spots = []
    for k in range(13):                                    # the woods west of the yard
        spots.append((-41 - rnd.uniform(0, 16), -64 + k * 5.2 + rnd.uniform(-1.5, 1.5), rnd.uniform(8, 13)))
    for k in range(9):                                     # behind the house and barn
        spots.append((-34 + k * 8.5 + rnd.uniform(-2, 2), -66.5 - rnd.uniform(0, 3), rnd.uniform(8, 12)))
    for x, z, h in ((-30, 14.5, 9), (-12, 15.5, 7.5), (22, 30.5, 8.5), (-34, 30, 10), (33, 15, 8), (44, -30, 9), (48, 4, 10), (-50, 42, 9), (52, 46, 9.5), (-46, 76, 10),
                    (40, 77, 9), (-9, 104, 9), (9.5, 106, 8), (-22, 96, 10), (24, 99, 9), (-40, 100, 11), (41, 104, 10), (-57, 60, 9), (58, 88, 10)):
        spots.append((x, z, h))
    for k in range(46):
        a = 2 * math.pi * k / 46 + rnd.uniform(-0.05, 0.05)
        R = rnd.uniform(96, 128)
        spots.append((R * math.cos(a), 20 + R * 1.15 * math.sin(a), rnd.uniform(9, 15)))
    if not swing_only:
        for i, (x, z, h) in enumerate(spots):
            near = abs(x) < 36 and -64 < z < 108
            tree(m, B(x, z), h, 100 + i, deep=4 if near else 3)
        o = m.finish(); o['kind'] = 'unbaked'
        UNBAKED.append(o)
        bpy.data.libraries.write(cache, {o})
        say('trees: built and cached,', sum(len(p.vertices) - 2 for p in o.data.polygons), 'triangles')
    # the tire swing on the oak
    s = Mesh('swing', oak['x'], oak['z'], 0)
    s.cyl(M['bark'], (0.2, 0.05, 4.5), (2.75, 0.33, 5.62), 0.2, 0.08, segs=7)      # the limb the rope hangs from (the rope used to end in the air)
    s.cyl(M['iron'], (2.2, 0.3, 5.4), (2.2, 0.3, 1.25), 0.015, segs=6)
    LINES.append([oak['x'] + 2.2, 5.4, oak['z'] - 0.3, oak['x'] + 2.2, 1.25, oak['z'] - 0.3])
    s.cyl(M['glass'], (2.2, 0.12, 0.95), (2.2, 0.48, 0.95), 0.36, segs=14)
    STATIC['props'].append(s.finish())


def windbreak():
    # three staggered rows of spruce south of the last road: the woods the turkey runs for. They hide what stands behind them.
    # The way through is kinked (it leaves further west than it enters), so nobody sees the house or its sign from the road.
    r = random.Random(77)
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')
    normals = []                                              # one per vertex, in the order they are made
    count = 0

    def vert(p, n):
        normals.append(n)
        return bm.verts.new(p)

    rows = ((90.0, (-10.9, -7.5)), (92.0, (-12.9, -7.5)), (94.0, (-12.9, -9.5)))      # z of the row, and the passage it leaves open
    for row, (zrow, (g0, g1)) in enumerate(rows):
        x = -46.0 + row * 0.63
        while x < 46.0:
            rad, h = r.uniform(1.6, 2.2), r.uniform(7.5, 10.5)
            xx, zz = x + r.uniform(-0.3, 0.3), zrow + r.uniform(-0.3, 0.3)
            x += r.uniform(1.7, 2.1)
            if g0 - 0.75 * rad < xx < g1 + 0.75 * rad:
                continue
            b = B(xx, zz)
            base, tiers, seg = 0.8, 12, 10
            ring0 = [vert((b.x + 0.14 * math.cos(2 * math.pi * k / 6), b.y + 0.14 * math.sin(2 * math.pi * k / 6), -0.05), (math.cos(2 * math.pi * k / 6), math.sin(2 * math.pi * k / 6), 0.0)) for k in range(6)]
            ring1 = [vert((b.x + 0.10 * math.cos(2 * math.pi * k / 6), b.y + 0.10 * math.sin(2 * math.pi * k / 6), base + 0.8), (math.cos(2 * math.pi * k / 6), math.sin(2 * math.pi * k / 6), 0.0)) for k in range(6)]
            for k in range(6):
                f = bm.faces.new([ring0[k], ring0[(k + 1) % 6], ring1[(k + 1) % 6], ring1[k]]); f.material_index = 1
            lx, ly = r.uniform(-0.025, 0.025), r.uniform(-0.025, 0.025)
            for t in range(tiers):
                f0 = t / tiers
                z0 = base + (h - base) * f0 * 0.93
                R = rad * (1 - f0) ** 0.7 + 0.1
                ztip = min(h, z0 + (h - base) / tiers * 2.6)
                cx, cy = b.x + lx * z0, b.y + ly * z0
                tip = vert((cx + lx * (ztip - z0), cy + ly * (ztip - z0), ztip), (0.0, 0.0, 1.0))
                a0 = r.uniform(0, 6.28)
                ring = []
                for k in range(seg):
                    a = a0 + 2 * math.pi * k / seg
                    rr = R * (1.0 if k % 2 == 0 else 0.7) * r.uniform(0.84, 1.14)
                    droop = (0.3 if k % 2 == 0 else 0.05) * (h - base) / tiers
                    nn = Vector((math.cos(a), math.sin(a), 0.5)).normalized()
                    ring.append(vert((cx + rr * math.cos(a), cy + rr * math.sin(a), z0 - droop), (nn.x, nn.y, nn.z)))
                for k in range(seg):
                    f = bm.faces.new([ring[k], ring[(k + 1) % seg], tip]); f.material_index = 0
            count += 1
    me = bpy.data.meshes.new('windbreak')
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    try:
        me.normals_split_custom_set_from_vertices(normals)      # soft, even shading: a dark mass with a ragged edge, not stacked cones
    except Exception as e:
        say('windbreak: custom normals not set', repr(e)[:80])
    me.materials.append(M['needles']); me.materials.append(M['bark_tree'])
    ob = bpy.data.objects.new('windbreak', me)
    scene.collection.objects.link(ob)
    ob['kind'] = 'unbaked'
    UNBAKED.append(ob)
    say('windbreak:', count, 'spruce,', len(me.polygons), 'faces')


def props():
    m = Mesh('props')
    for bid in ('bale_a', 'bale_b', 'bale_c'):
        c = COL[bid]
        p = B(c['x'], c['z'])
        a = rnd.uniform(0, math.pi)
        dx, dy = 0.62 * math.cos(a), 0.62 * math.sin(a)
        m.cyl(M['hay'], (p.x - dx, p.y - dy, 0.76), (p.x + dx, p.y + dy, 0.76), 0.78, segs=20)
        for f in (-0.62, 0.0, 0.62):                                 # twine round the bale
            m.cyl(M['twine'], (p.x + dx * (f - 0.03), p.y + dy * (f - 0.03), 0.76), (p.x + dx * (f + 0.03), p.y + dy * (f + 0.03), 0.76), 0.784, segs=20)
    c = COL['bale_stack']
    p = B(c['x'], c['z'])
    for k, (ox, oz) in enumerate(((-0.6, 0.22), (0.6, 0.22), (0, 0.66), (-0.62, 0.22), (0.05, 1.1))):
        if k == 3:
            continue
        m.box(M['hay'], (p.x + ox, p.y + rnd.uniform(-0.05, 0.05), oz), (1.15, 0.5, 0.46), rot=rot_z(rnd.uniform(-0.06, 0.06)))
    for sid in ('shock_a', 'shock_b', 'shock_c'):
        c = COL[sid]
        p = B(c['x'], c['z'])
        m.cyl(M['hay'], (p.x, p.y, 0), (p.x, p.y, 1.75), 0.78, 0.2, segs=11, caps=False)
        m.cyl(M['hay'], (p.x, p.y, 1.7), (p.x, p.y, 2.35), 0.2, 0.55, segs=9, caps=False)
        m.cyl(M['straw'], (p.x, p.y, 1.62), (p.x, p.y, 1.72), 0.22, segs=9)
    for k in range(7):                                    # more shocks out in the cut field, away from play
        p = B(rnd.uniform(-60, 60), rnd.uniform(46, 56))
        if abs(p.x) < 32:
            p.x += 34 * (1 if p.x > 0 else -1)
        m.cyl(M['hay'], (p.x, p.y, 0), (p.x, p.y, 1.75), 0.78, 0.2, segs=9, caps=False)
        m.cyl(M['hay'], (p.x, p.y, 1.7), (p.x, p.y, 2.3), 0.2, 0.5, segs=7, caps=False)
    c = COL['scarecrow']
    p = B(c['x'], c['z'])
    m.box(M['greywood'], (p.x, p.y, 1.05), (0.08, 0.08, 2.1))
    m.box(M['greywood'], (p.x, p.y, 1.55), (1.5, 0.06, 0.06))
    m.box(M['cloth'], (p.x, p.y, 1.3), (0.5, 0.2, 0.75), rot=rot_z(0.1))
    for sx in (-1, 1):
        m.box(M['cloth'], (p.x + sx * 0.55, p.y, 1.53), (0.6, 0.16, 0.18), rot=rot_y(sx * 0.12))
        m.cyl(M['straw'], (p.x + sx * 0.82, p.y, 1.5), (p.x + sx * 1.0, p.y, 1.38), 0.05, 0.1, segs=6)
    m.sphere(M['straw'], (p.x, p.y, 1.86), 0.17, u=10, v=7)
    m.cyl(M['cloth_blue'], (p.x, p.y, 1.95), (p.x, p.y, 1.99), 0.3, segs=14)
    m.cyl(M['cloth_blue'], (p.x, p.y, 1.98), (p.x, p.y, 2.16), 0.17, 0.13, segs=12)
    c = COL['woodpile']
    p = B(c['x'], c['z'])
    for row in range(5):
        n = 13 - row
        for k in range(n):
            y_ = p.y - c['d'] / 2 + 0.16 + (c['d'] - 0.3) * (k + 0.5 * (row % 2)) / 13
            r_ = rnd.uniform(0.12, 0.15)
            m.cyl(M['bark'], (p.x - 0.5 + rnd.uniform(-0.05, 0.05), y_, 0.12 + row * 0.21), (p.x + 0.5 + rnd.uniform(-0.05, 0.05), y_, 0.12 + row * 0.21), r_, segs=7)
    c = COL['trough']
    p = B(c['x'], c['z'])
    R = rot_z(c['rotY'])
    m.box(M['galv'], (p.x, p.y, 0.33), (c['w'], c['d'], 0.6), rot=R)
    m.box(M['water'], (p.x, p.y, 0.6), (c['w'] - 0.08, c['d'] - 0.08, 0.06), rot=R)
    c = COL['wheelbarrow']
    p = B(c['x'], c['z'])
    R = rot_z(c['rotY'])
    m.box(M['door_green'], (p.x, p.y, 0.5), (0.7, 1.0, 0.3), rot=R @ rot_x(0.12))
    front = Vector((0, -0.66, 0)); front.rotate(Matrix.Rotation(c['rotY'], 3, 'Z'))
    axle = Vector((0.07, 0, 0)); axle.rotate(Matrix.Rotation(c['rotY'], 3, 'Z'))
    m.cyl(M['glass'], (p.x + front.x - axle.x, p.y + front.y - axle.y, 0.2), (p.x + front.x + axle.x, p.y + front.y + axle.y, 0.2), 0.2, segs=12)
    for k in range(3):
        m.sphere(M['pumpkin'], (p.x + rnd.uniform(-0.15, 0.15), p.y + rnd.uniform(-0.25, 0.25), 0.72), 0.17, scale=(1, 1, 0.8), u=10, v=7)
    patch = [h for h in L['hides'] if h['id'] == 'pumpkins'][0]
    for k in range(26):
        x, z = patch['x'] + rnd.uniform(-5.5, 5.5), patch['z'] + rnd.uniform(-4, 4)
        r_ = rnd.uniform(0.14, 0.3)
        q = B(x, z)
        m.sphere(M['pumpkin'], (q.x, q.y, r_ * 0.78), r_, scale=(1, 1, 0.8), u=12, v=8)
        m.cyl(M['stem'], (q.x, q.y, r_ * 1.5), (q.x + 0.02, q.y, r_ * 1.5 + 0.07), 0.02, 0.014, segs=5)
    for (x, z) in ((-17.6, -34.4), (-20.5, -34.5), (-0.9, 97.2), (1.0, 97.4), (1.3, 97.0)):       # pumpkins beside the steps, on the ground
        q = B(x, z)
        m.sphere(M['pumpkin'], (q.x, q.y, 0.14), 0.2, scale=(1, 1, 0.8), u=12, v=8)      # on the ground beside them (half height 0.16: a touch sunk)
    STATIC['props'].append(m.finish())
    # south: the mailbox and the ford stones
    s = Mesh('south_props')
    c = COL['mailbox']
    p = B(c['x'], c['z'])
    s.box(M['greywood'], (p.x, p.y, 0.55), (0.1, 0.1, 1.1))
    s.box(M['galv'], (p.x, p.y, 1.2), (0.2, 0.5, 0.18))
    s.cyl(M['galv'], (p.x, p.y - 0.25, 1.29), (p.x, p.y + 0.25, 1.29), 0.1, segs=10)
    s.box(M['door_red'], (p.x + 0.115, p.y - 0.05, 1.32), (0.02, 0.05, 0.16))
    for st in next(l for l in L['escape']['lanes'] if l['kind'] == 'creek')['stones']:
        q = B(st['x'], st['z'])
        s.sphere(M['stone'], (q.x, q.y, -0.2), 0.62, scale=(1.0, 0.9, 0.42), u=10, v=6)
    for k in range(40):                                   # rocks along the creek banks
        x = rnd.uniform(-66, 66)
        z = rnd.choice((18.4, 27.6)) + rnd.uniform(-0.5, 0.5)
        q = B(x, z)
        r_ = rnd.uniform(0.15, 0.42)
        s.sphere(M['stone'], (q.x, q.y, -0.05), r_, scale=(1, rnd.uniform(0.7, 1.2), 0.6), u=7, v=5)
    STATIC['south'].append(s.finish())


def tufts():
    # dry grass and weeds where nobody mows: fence lines, creek banks, road shoulders, the drive, the field edges
    N = 512
    rng = np.random.default_rng(5)
    img = np.zeros((N, N, 4), np.float32)
    ys = np.arange(N)[:, None] / (N - 1.0)
    xs = np.arange(N)[None, :] / (N - 1.0)
    for k in range(90):
        x0, lean, h, w = rng.uniform(0.06, 0.94), rng.uniform(-0.2, 0.2), rng.uniform(0.4, 0.98), rng.uniform(0.005, 0.012)
        cx = x0 + lean * ys ** 1.6
        half = w * np.clip(1 - ys / h, 0, 1) ** 0.7
        a = (np.abs(xs - cx) < half) & (ys < h)
        col = (np.array([0.13, 0.11, 0.055]) if rng.random() < 0.62 else np.array([0.05, 0.07, 0.03])) * rng.uniform(0.6, 1.0)
        shade = 0.5 + 0.5 * ys
        for c in range(3):
            img[:, :, c] = np.where(a, col[c] * shade, img[:, :, c])
        img[:, :, 3] = np.maximum(img[:, :, 3], a.astype(np.float32))
    img[:, :, :3] = np.where(img[:, :, 3:4] > 0, img[:, :, :3], np.array([0.14, 0.12, 0.06], np.float32)) ** (1 / 2.2)
    tex = save_png('tufts_a', img, os.path.join(TEX, 'tufts_a.png'))
    m = bpy.data.materials.new('tufts')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get('Principled BSDF')
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = tex
    nt.links.new(n.outputs['Color'], b.inputs['Base Color']); nt.links.new(n.outputs['Alpha'], b.inputs['Alpha'])
    b.inputs['Roughness'].default_value = 0.9
    m.use_backface_culling = True
    r = random.Random(41)
    spots = []
    for f in L['fences']:
        dx, dz = f['x2'] - f['x1'], f['z2'] - f['z1']
        cnt = int(math.hypot(dx, dz) / 0.55)
        for k in range(cnt):
            if r.random() < 0.7:
                t = (k + r.random()) / cnt
                spots.append((f['x1'] + dx * t + r.uniform(-0.25, 0.25), f['z1'] + dz * t + r.uniform(-0.25, 0.25)))
    x = BND['minX'] + 2
    while x < BND['maxX'] - 2:
        for z, lo, hi, p in ((17.4, -0.5, 0.3, 0.6), (28.6, -0.3, 0.5, 0.6), (60.9, -0.35, 0.3, 0.4), (73.1, -0.3, 0.35, 0.4), (78.9, -0.35, 0.3, 0.4), (87.1, -0.25, 0.3, 0.45),
                             (43.3, -0.5, 0.4, 0.45), (58.8, -0.4, 0.5, 0.45), (5.4, -0.4, 0.4, 0.3), (12.7, -0.4, 0.4, 0.3)):
            if r.random() < p and not (abs(x) < 3.4 and z < 34) and not (z > 86 and abs(x + 9) < 2.6):
                spots.append((x + r.uniform(-0.3, 0.3), z + r.uniform(lo, hi)))
        x += 0.75
    z = 0.8
    while z < 33.5:
        for sx in (-1, 1):
            if r.random() < 0.5 and not (5.4 < z < 12.8) and not (17 < z < 29):
                spots.append((sx * (2.95 + r.uniform(0, 0.35)), z + r.uniform(-0.3, 0.3)))
        z += 0.8
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    for (x, z) in spots:
        b0 = B(x, z)
        w, h, yaw, u0 = r.uniform(0.35, 0.7), r.uniform(0.22, 0.5), r.uniform(0, math.pi), r.choice((0.0, 0.5))
        for q in range(2):
            a = yaw + q * math.pi / 2 + r.uniform(-0.3, 0.3)
            cx, cy = math.cos(a) * w / 2, math.sin(a) * w / 2
            pts = [(b0.x - cx, b0.y - cy, -0.02), (b0.x + cx, b0.y + cy, -0.02), (b0.x + cx, b0.y + cy, h), (b0.x - cx, b0.y - cy, h)]
            uvs = [(u0, 0), (u0 + 0.5, 0), (u0 + 0.5, 1), (u0, 1)]
            for order in ((0, 1, 2, 3), (3, 2, 1, 0)):             # one face for each side, so both sides are lit the same
                f = bm.faces.new([bm.verts.new(pts[i]) for i in order])
                for loop, i in zip(f.loops, order):
                    loop[uv].uv = uvs[i]
    me = bpy.data.meshes.new('tufts')
    bm.to_mesh(me); bm.free()
    me.materials.append(m)
    try:
        me.normals_split_custom_set([(0.0, 0.0, 1.0)] * len(me.loops))      # lit like the ground they stand on, not like flat cards
    except Exception as e:
        say('tufts: custom normals not set', repr(e)[:80])
    ob = bpy.data.objects.new('tufts', me)
    scene.collection.objects.link(ob)
    ob['kind'] = 'unbaked'
    ob.visible_shadow = False
    UNBAKED.append(ob)
    say('tufts:', len(spots))


def far_woods():
    # a ragged dark line of far woods all round, so the misty fields never meet the sky in a ruler line
    r = random.Random(9)
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')
    for (rx, rz, lo, hi, n) in ((128.0, 150.0, 3.0, 5.5, 300), (160.0, 185.0, 4.5, 7.5, 260)):
        ring = []
        for k in range(n):
            a = 2 * math.pi * k / n
            ring.append((B(rx * math.cos(a), 21 + rz * math.sin(a)), lo + (hi - lo) * (0.5 + 0.25 * math.sin(k * 0.37 + rx) + 0.15 * math.sin(k * 1.13 + rz) + r.uniform(-0.1, 0.1))))      # a lumpy tree line, not peaks
        for k in range(n):
            (p0, h0), (p1, h1) = ring[k], ring[(k + 1) % n]
            bm.faces.new([bm.verts.new((p0.x, p0.y, -0.6)), bm.verts.new((p1.x, p1.y, -0.6)), bm.verts.new((p1.x, p1.y, h1)), bm.verts.new((p0.x, p0.y, h0))])
    me = bpy.data.meshes.new('far_woods')
    bm.to_mesh(me); bm.free()
    me.materials.append(M['far_woods'])
    ob = bpy.data.objects.new('far_woods', me)
    scene.collection.objects.link(ob)
    ob['kind'] = 'unbaked'
    ob.visible_shadow = False; ob.visible_diffuse = False; ob.visible_glossy = False       # it must not shade the farm from the sky
    UNBAKED.append(ob)


def road_paint():
    m = Mesh('road_paint')
    for z in (65.03, 65.27, 68.73, 68.97):                 # two painted strips between the three rows of traffic: a place to wait
        m.box(M['road_yellow'], (0, -z, 0.012), (BND['maxX'] - BND['minX'], 0.1, 0.012))
    for z in (62.35, 71.65):
        m.box(M['road_white'], (0, -z, 0.012), (BND['maxX'] - BND['minX'], 0.11, 0.012))
    x = BND['minX']
    while x < BND['maxX']:
        m.box(M['road_yellow'], (x + 1.5, -83, 0.012), (3.0, 0.1, 0.012))
        x += 9
    o = m.finish(); o['kind'] = 'paint'
    UNBAKED.append(o)


def casters():
    """stand-ins for the parked truck and tractor, so they leave shadows in the baked ground; not exported"""
    for cid in ('pickup_parked', 'tractor_parked'):
        c = COL[cid]
        m = Mesh('caster_' + cid, c['x'], c['z'], c['rotY'])
        m.box(M['iron'], (0, 0, c['h'] * 0.55), (c['w'], c['d'], c['h'] * 0.8))
        o = m.finish()
        o.visible_camera = False
        o.visible_glossy = False
        CASTERS.append(o)


# ================================================================ sky and lights
SUN_AZ, SUN_EL = math.radians(250), math.radians(3.5)        # low in the west-south-west (game: -x, a little +z)


def sun_vector():
    # azimuth measured from Blender +y (north) clockwise; 250 degrees = west-south-west
    return Vector((math.sin(SUN_AZ) * math.cos(SUN_EL), math.cos(SUN_AZ) * math.cos(SUN_EL), math.sin(SUN_EL)))


def make_world():
    w = bpy.data.worlds.new('dusk')
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes.get('Background')
    sv = sun_vector()
    hdri = os.environ.get('TT_HDRI', 'qwantani_dusk_2')              # a real dusk sky (Poly Haven, CC0); 'none' = the sky made by nodes below
    hpath = os.path.join(PH, hdri, hdri + '_4k.hdr')
    if hdri != 'none' and os.path.exists(hpath):
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); env = nt.nodes.new('ShaderNodeTexEnvironment')
        env.image = bpy.data.images.load(hpath)
        mp.inputs['Rotation'].default_value = (0, 0, math.radians(float(os.environ.get('TT_HDRI_ROT', '116.1'))))     # turns its glow to our west-south-west
        nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
        nt.links.new(env.outputs['Color'], bg.inputs['Color'])
        bg.inputs['Strength'].default_value = float(os.environ.get('TT_SKY_GAIN', '0.178'))                       # open ground then gets about 0.2 (light / pi)
        say('sky: photo sky', hdri)
        return
    try:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        nrm = nt.nodes.new('ShaderNodeVectorMath'); nrm.operation = 'NORMALIZE'
        nt.links.new(tc.outputs['Generated'], nrm.inputs[0])
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(nrm.outputs[0], sep.inputs[0])
        el = nt.nodes.new('ShaderNodeMath'); el.operation = 'MULTIPLY_ADD'
        nt.links.new(sep.outputs['Z'], el.inputs[0]); el.inputs[1].default_value = 0.5; el.inputs[2].default_value = 0.5
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        cr = ramp.color_ramp
        cr.elements[0].position = 0.0; cr.elements[0].color = (0.010, 0.012, 0.016, 1)
        cr.elements[1].position = 1.0; cr.elements[1].color = (0.006, 0.011, 0.032, 1)
        for pos, c in ((0.492, (0.010, 0.012, 0.016, 1)), (0.503, (0.115, 0.105, 0.115, 1)), (0.54, (0.050, 0.064, 0.105, 1)), (0.64, (0.018, 0.029, 0.066, 1))):
            e = cr.elements.new(pos); e.color = c
        nt.links.new(el.outputs[0], ramp.inputs[0])
        dot = nt.nodes.new('ShaderNodeVectorMath'); dot.operation = 'DOT_PRODUCT'
        nt.links.new(nrm.outputs[0], dot.inputs[0]); dot.inputs[1].default_value = sv
        pos_ = nt.nodes.new('ShaderNodeMath'); pos_.operation = 'MAXIMUM'
        nt.links.new(dot.outputs['Value'], pos_.inputs[0]); pos_.inputs[1].default_value = 0.0
        absz = nt.nodes.new('ShaderNodeMath'); absz.operation = 'ABSOLUTE'
        nt.links.new(sep.outputs['Z'], absz.inputs[0])
        low = nt.nodes.new('ShaderNodeMapRange')            # 1 at the horizon, 0 by 25 degrees up
        nt.links.new(absz.outputs[0], low.inputs[0]); low.inputs[1].default_value = 0.0; low.inputs[2].default_value = 0.5; low.inputs[3].default_value = 1.0; low.inputs[4].default_value = 0.0
        wide = nt.nodes.new('ShaderNodeMath'); wide.operation = 'POWER'
        nt.links.new(pos_.outputs[0], wide.inputs[0]); wide.inputs[1].default_value = 2.2
        tight = nt.nodes.new('ShaderNodeMath'); tight.operation = 'POWER'
        nt.links.new(pos_.outputs[0], tight.inputs[0]); tight.inputs[1].default_value = 40.0
        lowp = nt.nodes.new('ShaderNodeMath'); lowp.operation = 'POWER'
        nt.links.new(low.outputs[0], lowp.inputs[0]); lowp.inputs[1].default_value = 2.5
        g1 = nt.nodes.new('ShaderNodeMath'); g1.operation = 'MULTIPLY'
        nt.links.new(wide.outputs[0], g1.inputs[0]); nt.links.new(lowp.outputs[0], g1.inputs[1])
        glow = nt.nodes.new('ShaderNodeMix'); glow.data_type = 'RGBA'; glow.blend_type = 'ADD'
        nt.links.new(g1.outputs[0], glow.inputs[0])
        nt.links.new(ramp.outputs['Color'], glow.inputs[6]); glow.inputs[7].default_value = (1.5, 0.44, 0.10, 1)
        glow2 = nt.nodes.new('ShaderNodeMix'); glow2.data_type = 'RGBA'; glow2.blend_type = 'ADD'
        nt.links.new(tight.outputs[0], glow2.inputs[0])
        nt.links.new(glow.outputs[2], glow2.inputs[6]); glow2.inputs[7].default_value = (3.0, 1.2, 0.35, 1)
        # clouds: torn bands, dark underneath, burning along the edge that faces the sun
        stretchv = nt.nodes.new('ShaderNodeVectorMath'); stretchv.operation = 'MULTIPLY'
        nt.links.new(nrm.outputs[0], stretchv.inputs[0]); stretchv.inputs[1].default_value = (1.0, 1.0, 5.5)
        noise = nt.nodes.new('ShaderNodeTexNoise')
        nt.links.new(stretchv.outputs[0], noise.inputs['Vector'])
        noise.inputs['Scale'].default_value = 1.7; noise.inputs['Detail'].default_value = 10.0; noise.inputs['Roughness'].default_value = 0.66
        cm = nt.nodes.new('ShaderNodeMapRange')
        nt.links.new(noise.outputs[0], cm.inputs[0]); cm.inputs[1].default_value = 0.43; cm.inputs[2].default_value = 0.60; cm.inputs[3].default_value = 0.0; cm.inputs[4].default_value = 1.0
        up = nt.nodes.new('ShaderNodeMapRange')
        nt.links.new(sep.outputs['Z'], up.inputs[0]); up.inputs[1].default_value = 0.015; up.inputs[2].default_value = 0.09; up.inputs[3].default_value = 0.0; up.inputs[4].default_value = 1.0
        cmask = nt.nodes.new('ShaderNodeMath'); cmask.operation = 'MULTIPLY'
        nt.links.new(cm.outputs[0], cmask.inputs[0]); nt.links.new(up.outputs[0], cmask.inputs[1])
        edge = nt.nodes.new('ShaderNodeMapRange')           # the thin part of a cloud lights up
        nt.links.new(noise.outputs[0], edge.inputs[0]); edge.inputs[1].default_value = 0.43; edge.inputs[2].default_value = 0.53; edge.inputs[3].default_value = 1.0; edge.inputs[4].default_value = 0.0
        lit = nt.nodes.new('ShaderNodeMath'); lit.operation = 'MULTIPLY'
        nt.links.new(edge.outputs[0], lit.inputs[0]); nt.links.new(g1.outputs[0], lit.inputs[1])
        ccol = nt.nodes.new('ShaderNodeMix'); ccol.data_type = 'RGBA'
        nt.links.new(lit.outputs[0], ccol.inputs[0])
        ccol.inputs[6].default_value = (0.008, 0.010, 0.017, 1); ccol.inputs[7].default_value = (1.6, 0.46, 0.12, 1)
        sky = nt.nodes.new('ShaderNodeMix'); sky.data_type = 'RGBA'
        cfac = nt.nodes.new('ShaderNodeMath'); cfac.operation = 'MULTIPLY'
        nt.links.new(cmask.outputs[0], cfac.inputs[0]); cfac.inputs[1].default_value = 0.92
        nt.links.new(cfac.outputs[0], sky.inputs[0])
        nt.links.new(glow2.outputs[2], sky.inputs[6]); nt.links.new(ccol.outputs[2], sky.inputs[7])
        nt.links.new(sky.outputs[2], bg.inputs['Color'])
        bg.inputs['Strength'].default_value = 1.6
        say('sky: nodes built')
    except Exception as e:
        say('sky nodes failed, flat dusk:', repr(e))
        bg.inputs['Color'].default_value = (0.05, 0.07, 0.13, 1)
        bg.inputs['Strength'].default_value = 1.0


WATTS = {'yard': 1500, 'porch': 110, 'barn_door': 420, 'barn_inside': 170, 'shed': 150, 'highway_w': 2200, 'highway_e': 2200, 'dummy_porch': 100,
         'gate': 950, 'ford': 900, 'creek_e': 900, 'gravel_w': 1000, 'gravel_m': 1000, 'gravel_e': 1000, 'last_gap': 950, 'last_e': 1100}


def lights():
    sv = sun_vector()
    d = bpy.data.lights.new('sun', 'SUN')
    d.energy = 0.6
    d.color = (1.0, 0.46, 0.20)
    d.angle = math.radians(16.0)
    o = bpy.data.objects.new('sun', d)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(sv).to_euler()
    scene.collection.objects.link(o)
    watts = WATTS
    for lp in L['lamps']:
        point_light(lp['id'], lp['x'], lp['y'] - 0.05, lp['z'], hexcol(lp['color']), watts.get(lp['id'], 400), size=0.12)
    # warm spill from the lit windows
    for (x, z, y, w_) in ((-22.4, -37.9, 2.1, 45), (-15.6, -37.9, 2.1, 45), (-2.3, 98.7, 1.8, 40), (2.3, 98.7, 1.8, 40)):
        point_light('window_spill', x, y, z, (1.0, 0.6, 0.3), w_, size=0.5)


# ================================================================ build it all
say('building')
GROUND = build_ground()
farmhouse(); barn(); silo(); shed(); coop(); dummy_house(); windmill()
fences(); poles_and_wires(); trees(); windbreak(); props(); road_paint(); casters(); far_woods()
if os.environ.get('TT_TUFTS', '0') == '1':
    tufts()
make_world(); lights()
for o in GLOW:
    if o is not None:
        o.visible_shadow = False
        o.visible_diffuse = False
        o.visible_glossy = True
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in scene.objects if o.type == 'MESH')
say('built:', len([o for o in scene.objects if o.type == 'MESH']), 'meshes,', tris, 'triangles')


def add_camera(name, eye, target, lens=24):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_end = 600
    ob = bpy.data.objects.new(name, cd)
    ob.location = B(eye[0], eye[2], eye[1])
    d = B(target[0], target[2], target[1]) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(ob)
    return ob


if MODE == 'preview':
    scene.cycles.samples = 48
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 88
    try:
        scene.view_settings.view_transform = 'AgX'
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception as e:
        say('view transform:', e)
    scene.view_settings.exposure = float(os.environ.get('TT_EXPOSURE', '2.6'))
    shots = {
        'yard': ((-3.5, 1.9, -3.5), (1.0, 2.6, -36), 22),
        'barn': ((8.5, 1.6, -24.5), (17, 2.6, -37), 24),
        'house': ((-10, 1.6, -27), (-19, 2.8, -38), 24),
        'highway': ((-3, 1.5, 57.5), (2, 1.2, 100), 26),
        'dummy': ((-4.5, 1.5, 91), (1.5, 1.6, 100), 28),
        'creek': ((-10, 2.2, 14), (6, 0.2, 26), 22),
        'top': ((0, 150, 30), (0, 0, 18), 20),
    }
    want = os.environ.get('TT_SHOTS', 'yard,barn,highway,dummy').split(',')
    for name in want:
        eye, target, lens = shots[name]
        scene.camera = add_camera('cam_' + name, eye, target, lens)
        scene.render.filepath = os.path.join(OUT, f'preview_{name}.jpg')
        t = time.time()
        bpy.ops.render.render(write_still=True)
        say(f'rendered {name} in {time.time() - t:.1f}s')
    say('DONE preview')

elif MODE == 'bake':
    exec(open(os.path.join(HERE, 'farm_bake.py'), encoding='utf-8').read())
