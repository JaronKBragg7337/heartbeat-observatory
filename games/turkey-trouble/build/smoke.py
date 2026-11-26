# Turkey Trouble: pipeline smoke test. Run headless:
#   blender -b --factory-startup --python smoke.py -- <out_dir>
# Builds a tiny dusk scene, bakes its lighting into one lightmap on the GPU, renders a small panorama for reflections,
# and exports smoke.glb. It proves the whole pipe before the real farm is built. Nothing is downloaded.
import bpy, bmesh, sys, os, math, time
import numpy as np

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)
T0 = time.time()


def say(*a):
    print(f'[smoke {time.time() - T0:6.1f}s]', *a, flush=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'

# ---------------------------------------------------------------- GPU
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
                    return f'{kind}: ' + ', '.join(d.name for d in found)
            except Exception as e:
                say('device', kind, 'failed:', e)
    except Exception as e:
        say('no cycles prefs:', e)
    scene.cycles.device = 'CPU'
    return 'CPU'


say('device', use_gpu())
scene.cycles.samples = 96
scene.cycles.use_denoising = True
try:
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception as e:
    say('denoiser:', e)
scene.view_settings.view_transform = 'Standard'

# ---------------------------------------------------------------- helpers
def material(name, color, rough=0.8, metal=0.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = emit_strength
    return m


def box(name, size, loc, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    return o


# ---------------------------------------------------------------- the tiny scene
m_ground = material('ground', (0.09, 0.085, 0.08), rough=0.35)
m_wall = material('wall', (0.62, 0.6, 0.55), rough=0.85)
m_roof = material('roof', (0.12, 0.07, 0.06), rough=0.7)
m_post = material('post', (0.05, 0.05, 0.055), rough=0.5, metal=0.6)
m_glow = material('glow', (1, 0.7, 0.4), emit=(1.0, 0.62, 0.3), emit_strength=30.0)

bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
ground = bpy.context.active_object
ground.name = 'ground'
ground.data.materials.append(m_ground)
# a few cuts so vertex data is not four corners only
bm = bmesh.new(); bm.from_mesh(ground.data)
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=8, use_grid_fill=True)
bm.to_mesh(ground.data); bm.free()

house = box('house', (5, 4, 3), (-3, 2, 1.5), m_wall)
roof = box('roof', (5.6, 4.6, 0.3), (-3, 2, 3.15), m_roof)
window = box('window', (0.05, 1.2, 1.0), (-0.47, 2, 1.6), m_glow)
post = box('post', (0.12, 0.12, 4), (4, -2, 2), m_post)
bulb = box('bulb', (0.35, 0.35, 0.2), (4, -2, 4.05), m_glow)

bpy.ops.object.light_add(type='POINT', location=(4, -2, 3.85))
lamp = bpy.context.active_object
lamp.data.energy = 900
lamp.data.color = (1.0, 0.72, 0.42)
lamp.data.shadow_soft_size = 0.15
bpy.ops.object.light_add(type='SUN', location=(0, 0, 10), rotation=(math.radians(84), 0, math.radians(120)))
sun = bpy.context.active_object
sun.data.energy = 1.2
sun.data.color = (1.0, 0.55, 0.3)
sun.data.angle = math.radians(3)

# ---------------------------------------------------------------- dusk sky: Blender's own sunset image, turned down
world = bpy.data.worlds.new('dusk')
scene.world = world
world.use_nodes = True
nt = world.node_tree
bg = nt.nodes.get('Background')
env = nt.nodes.new('ShaderNodeTexEnvironment')
exr = os.path.join(bpy.utils.resource_path('LOCAL'), 'datafiles', 'studiolights', 'world', 'sunset.exr')
say('sky image exists:', os.path.exists(exr), exr)
try:
    env.image = bpy.data.images.load(exr)
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.35
except Exception as e:
    say('sky image failed, flat sky:', e)
    bg.inputs['Color'].default_value = (0.05, 0.07, 0.12, 1)
    bg.inputs['Strength'].default_value = 1.0

# ---------------------------------------------------------------- join the static things, second UV set, bake
static = [ground, house, roof, post]
bpy.ops.object.select_all(action='DESELECT')
for o in static:
    o.select_set(True)
bpy.context.view_layer.objects.active = ground
bpy.ops.object.join()
world_mesh = bpy.context.active_object
world_mesh.name = 'world'
me = world_mesh.data
if not me.uv_layers:
    me.uv_layers.new(name='UVMap')
lm = me.uv_layers.new(name='lm')
me.uv_layers.active = lm
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01)
bpy.ops.object.mode_set(mode='OBJECT')
say('uv layers:', [u.name for u in me.uv_layers], 'tris ~', sum(len(p.vertices) - 2 for p in me.polygons))

SIZE = 1024
img = bpy.data.images.new('smoke_lm', SIZE, SIZE, alpha=False, float_buffer=True)
for m in me.materials:
    n = m.node_tree.nodes.new('ShaderNodeTexImage')
    n.image = img
    m.node_tree.nodes.active = n
bake = scene.render.bake
bake.use_pass_direct = True
bake.use_pass_indirect = True
bake.use_pass_color = False
bake.margin = 8
scene.cycles.bake_type = 'DIFFUSE'
bpy.ops.object.select_all(action='DESELECT')
world_mesh.select_set(True)
bpy.context.view_layer.objects.active = world_mesh
t = time.time()
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, uv_layer='lm', margin=8, use_clear=True)
say(f'baked {SIZE}px in {time.time() - t:.1f}s')

# The bake holds light / pi for a white surface, in linear numbers that can pass 1 near the lamp. Stored as 8-bit sRGB of
# (value / RANGE): the page multiplies it back (lightMapIntensity = RANGE * pi).
RANGE = 4.0
px = np.empty(SIZE * SIZE * 4, dtype=np.float32)
img.pixels.foreach_get(px)
px = px.reshape(-1, 4)
rgb = np.clip(px[:, :3] / RANGE, 0, 1)
say('lightmap linear stats: mean %.4f, p99 %.3f, max %.2f' % (px[:, :3].mean(), np.percentile(px[:, :3], 99), px[:, :3].max()))
srgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(rgb, 1 / 2.4) - 0.055)
out = bpy.data.images.new('smoke_lm8', SIZE, SIZE, alpha=False, float_buffer=False)
buf = np.ones((SIZE * SIZE, 4), dtype=np.float32)
buf[:, :3] = srgb
out.pixels.foreach_set(buf.ravel())
out.filepath_raw = os.path.join(OUT, 'smoke_lm.png')
out.file_format = 'PNG'
out.save()
say('saved', out.filepath_raw)

# ---------------------------------------------------------------- a small panorama for reflections
cam_data = bpy.data.cameras.new('pano')
cam_data.type = 'PANO'
try:
    cam_data.panorama_type = 'EQUIRECTANGULAR'
except Exception:
    cam_data.cycles.panorama_type = 'EQUIRECTANGULAR'
cam = bpy.data.objects.new('pano', cam_data)
scene.collection.objects.link(cam)
cam.location = (1, -1, 1.6)
cam.rotation_euler = (math.radians(90), 0, 0)
scene.camera = cam
scene.render.resolution_x, scene.render.resolution_y = 1024, 512
scene.render.resolution_percentage = 100
scene.cycles.samples = 64
scene.render.image_settings.file_format = 'HDR'
scene.render.filepath = os.path.join(OUT, 'smoke_env.hdr')
t = time.time()
bpy.ops.render.render(write_still=True)
say(f'panorama in {time.time() - t:.1f}s')

# ---------------------------------------------------------------- export
for m in me.materials:      # the bake target node must not be exported as a texture
    for n in [n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE']:
        m.node_tree.nodes.remove(n)
world_mesh['lm'] = 'smoke_lm.png'
world_mesh['lmRange'] = RANGE
bpy.ops.object.select_all(action='DESELECT')
for o in (world_mesh, window, bulb):
    o.select_set(True)
path = os.path.join(OUT, 'smoke.glb')
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_extras=True, export_apply=True,
                          export_yup=True, export_cameras=False, export_lights=False, export_animations=False)
say('exported', path, os.path.getsize(path), 'bytes')
say('DONE')
