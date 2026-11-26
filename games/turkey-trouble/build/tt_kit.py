# Turkey Trouble: the modelling kit used by farm.py (and turkey.py). Blender 5.1, headless.
# Local building space is Blender's: +x east, +y north, +z up. The game's z (south) is Blender's -y.
import bpy, bmesh, os, math, time
import numpy as np
from mathutils import Vector, Matrix

T0 = time.time()


def say(*a):
    print(f'[farm {time.time() - T0:6.1f}s]', *a, flush=True)


def use_gpu(scene):
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for kind in ('OPTIX', 'CUDA'):
            try:
                prefs.compute_device_type = kind
                (prefs.refresh_devices if hasattr(prefs, 'refresh_devices') else prefs.get_devices)()
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


def B(x, z, y=0.0):
    """game (x east, z south, y up) -> Blender"""
    return Vector((x, -z, y))


# ---------------------------------------------------------------- images and materials
def save_png(name, arr, path, non_color=False):
    """arr: H x W x 3 or 4 (or H x W), values 0..1 as they should be stored. Row 0 is the bottom row."""
    a = np.asarray(arr, dtype=np.float32)
    if a.ndim == 2:
        a = np.dstack([a, a, a])
    h, w = a.shape[:2]
    alpha = a.shape[2] == 4
    buf = np.ones((h, w, 4), np.float32)
    buf[:, :, :a.shape[2]] = np.clip(a, 0, 1)
    img = bpy.data.images.new(name, w, h, alpha=alpha, float_buffer=False)
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(buf.ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    return img


def load_image(path, non_color=False):
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    return img


MATS = {}


def material(name, color=(0.5, 0.5, 0.5), rough=0.8, metal=0.0, albedo=None, normal=None, normal_strength=1.0,
             rough_img=None, emit=None, emit_strength=0.0, emit_img=None, tile=1.0, alpha_img=False):
    """A Principled material. tile = metres one copy of the texture covers (used by the kit's cube projection)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if albedo is not None:
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = albedo
        nt.links.new(n.outputs['Color'], b.inputs['Base Color'])
    if rough_img is not None:
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = rough_img
        nt.links.new(n.outputs['Color'], b.inputs['Roughness'])
    if normal is not None:
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = normal
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal_strength
        nt.links.new(n.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if emit is not None or emit_img is not None:
        b.inputs['Emission Color'].default_value = (*(emit or (1, 1, 1)), 1)
        b.inputs['Emission Strength'].default_value = emit_strength
        if emit_img is not None:
            n = nt.nodes.new('ShaderNodeTexImage'); n.image = emit_img
            nt.links.new(n.outputs['Color'], b.inputs['Emission Color'])
            nt.links.new(n.outputs['Color'], b.inputs['Base Color'])
    m['tile'] = tile
    MATS[name] = m
    return m


# ---------------------------------------------------------------- a mesh being built
class Mesh:
    """Collects closed shapes into one mesh, in LOCAL space, then places it. UVs are cube-projected in local space,
    scaled by each material's 'tile'. Shapes made while `swap` is True get their top-down UVs turned a quarter."""

    def __init__(self, name, x=0.0, z=0.0, rot_y=0.0, y=0.0):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []
        self.at = B(x, z, y)
        self.rot = rot_y
        self.swap = False
        self.flag = self.bm.faces.layers.int.new('swap')
        self.round = self.bm.faces.layers.int.new('round')

    def mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _tag(self, verts, mat, round_=False):
        idx = self.mi(mat)
        faces = set(f for v in verts for f in v.link_faces)
        for f in faces:
            f.material_index = idx
            f[self.flag] = 1 if self.swap else 0
            f[self.round] = 1 if round_ else 0
        return faces

    def box(self, mat, c, size, rot=None):
        """c = centre (x, y, z), size = (sx, sy, sz); rot = optional 4x4 rotation applied about the centre"""
        M = Matrix.Translation(Vector(c)) @ (rot if rot is not None else Matrix.Identity(4)) @ Matrix.Diagonal((size[0], size[1], size[2], 1.0))
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)
        self._tag(r['verts'], mat)
        return r['verts']

    def cyl(self, mat, p0, p1, r0, r1=None, segs=10, caps=True):
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        L = d.length
        if L < 1e-6:
            return []
        rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
        M = Matrix.Translation((p0 + p1) / 2) @ rot
        r = bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=segs, radius1=r0, radius2=(r0 if r1 is None else r1), depth=L, matrix=M)
        faces = self._tag(r['verts'], mat, round_=segs >= 5)
        if caps:
            for f in faces:
                if len(f.verts) > 4:
                    f[self.round] = 0
        return r['verts']

    def prism(self, mat, pts, offset):
        """a closed shape: polygon pts (list of (x, y, z)) pushed along offset (x, y, z)"""
        o = Vector(offset)
        a = [self.bm.verts.new(Vector(p)) for p in pts]
        b = [self.bm.verts.new(Vector(p) + o) for p in pts]
        n = len(pts)
        faces = [self.bm.faces.new(a), self.bm.faces.new(list(reversed(b)))]
        for i in range(n):
            faces.append(self.bm.faces.new([a[i], b[i], b[(i + 1) % n], a[(i + 1) % n]]))
        idx = self.mi(mat)
        for f in faces:
            f.material_index = idx
            f[self.flag] = 1 if self.swap else 0
        return a + b

    def sphere(self, mat, c, r, scale=(1, 1, 1), u=10, v=6):
        M = Matrix.Translation(Vector(c)) @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=u, v_segments=v, radius=r, matrix=M)
        self._tag(res['verts'], mat, round_=True)
        return res['verts']

    def slab(self, mat, a, b, width_vec, thick):
        """a thin board from point a to point b: width_vec is its full width as a vector, thick its thickness"""
        a, b, w = Vector(a), Vector(b), Vector(width_vec)
        d = b - a
        n = d.cross(w).normalized() * thick
        pts = [a - w / 2, a + w / 2, b + w / 2, b - w / 2]
        return self.prism(mat, [p - n / 2 for p in pts], n)

    def gable(self, mat, base_z, w, d, rise, ov=0.4, thick=0.14, ridge='x'):
        """two roof slopes over a w (x) by d (y) box whose wall top is at base_z"""
        if ridge == 'x':
            hs = d / 2
            for s in (-1, 1):
                eave = Vector((0, s * (hs + ov), base_z - ov * rise / hs))
                top = Vector((0, 0, base_z + rise))
                self.slab(mat, eave, top + Vector((0, 0, 0)), (w + 2 * ov, 0, 0), thick)
        else:
            hs = w / 2
            self.swap = True
            for s in (-1, 1):
                eave = Vector((s * (hs + ov), 0, base_z - ov * rise / hs))
                top = Vector((0, 0, base_z + rise))
                self.slab(mat, eave, top, (0, d + 2 * ov, 0), thick)
            self.swap = False

    def finish(self, smooth=False, collection=None):
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        uv = bm.loops.layers.uv.new('UVMap')
        tiles = [float(m.get('tile', 1.0)) for m in self.mats] or [1.0]
        for f in bm.faces:
            n = f.normal
            t = tiles[f.material_index] if f.material_index < len(tiles) else 1.0
            ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
            for loop in f.loops:
                p = loop.vert.co
                if az >= 0.72:
                    u, v = (p.y, p.x) if f[self.flag] else (p.x, p.y)
                elif ax > ay:
                    u, v = p.y, p.z
                else:
                    u, v = p.x, p.z
                loop[uv].uv = (u / t, v / t)
            f.smooth = smooth or bool(f[self.round])
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me)
        ob.location = self.at
        ob.rotation_euler = (0, 0, self.rot)
        (collection or bpy.context.scene.collection).objects.link(ob)
        return ob


def rot_x(a):
    return Matrix.Rotation(a, 4, 'X')


def rot_y(a):
    return Matrix.Rotation(a, 4, 'Y')


def rot_z(a):
    return Matrix.Rotation(a, 4, 'Z')


def join(objs, name):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    ob.data.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


def despeckle(px, size, passes=1):
    """px: size x size x 3 linear light. Takes out single bright pixels (fireflies), then a light blur."""
    a = px.copy()
    for _ in range(passes):
        stack = [np.roll(np.roll(a, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)]
        med = np.median(np.stack(stack, 0), axis=0)
        hot = a.sum(2) > med.sum(2) * 1.8 + 0.02
        a[hot] = med[hot]
    k = (np.roll(a, 1, 0) + np.roll(a, -1, 0) + np.roll(a, 1, 1) + np.roll(a, -1, 1)) * 0.125 + a * 0.5
    return k


def encode_lightmap(px, rng):
    """linear light / rng -> sRGB 8-bit values (0..1 floats)"""
    rgb = np.clip(px / rng, 0, 1)
    return np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(np.maximum(rgb, 1e-8), 1 / 2.4) - 0.055)
