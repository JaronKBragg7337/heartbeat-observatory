# Turntable previews of the models.blend that models.py saves into the scratch folder.
#   blender -b <scratch>/models.blend --python build/models_preview.py -- <scratch> [root names...]
# For each root: 4 views at 960x540, stitched into one 1920x1080 contact sheet <scratch>/sheet_<root>.png
import bpy, sys, os, math, time
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCR = ARGS[0] if ARGS else r'C:\Users\lilli\Projects\turkey-work\models'
ONLY = ARGS[1:]
T0 = time.time()
scene = bpy.context.scene
scene.render.engine = 'CYCLES'


def say(*a):
    print(f'[preview {time.time() - T0:6.1f}s]', *a, flush=True)


prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'OPTIX'
prefs.refresh_devices()
for d in prefs.devices:
    d.use = d.type == 'OPTIX'
scene.cycles.device = 'GPU'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
try:
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    try:
        scene.view_settings.view_transform = 'Filmic'
    except Exception:
        pass
scene.view_settings.exposure = 0.6
scene.render.resolution_x, scene.render.resolution_y = 960, 540
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'

ROOTS = ['pickup', 'tractor_wagon', 'grain_truck', 'dog', 'log', 'pumpkin', 'net', 'feather']
roots = {n: bpy.data.objects[n] for n in ROOTS if n in bpy.data.objects}


def desc(o):
    out = [o]
    for c in o.children:
        out += desc(c)
    return out


# wet ground
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
g = bpy.context.active_object
gm = bpy.data.materials.new('wet_ground')
gm.use_nodes = True
nt = gm.node_tree
b = nt.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (0.055, 0.045, 0.035, 1)
noise = nt.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 0.9
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.45
ramp.color_ramp.elements[0].color = (0.05, 0.05, 0.05, 1)
ramp.color_ramp.elements[1].position = 0.6
ramp.color_ramp.elements[1].color = (0.55, 0.55, 0.55, 1)
nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], b.inputs['Roughness'])
g.data.materials.append(gm)

# dusk sky + low warm sun
world = bpy.data.worlds.new('dusk')
scene.world = world
world.use_nodes = True
wn = world.node_tree
bg = wn.nodes['Background']
env = wn.nodes.new('ShaderNodeTexEnvironment')
exr = os.path.join(bpy.utils.resource_path('LOCAL'), 'datafiles', 'studiolights', 'world', 'sunset.exr')
try:
    env.image = bpy.data.images.load(exr)
    wn.links.new(env.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.45
except Exception as e:
    bg.inputs['Color'].default_value = (0.10, 0.08, 0.09, 1)
bpy.ops.object.light_add(type='SUN', rotation=(math.radians(82), 0, math.radians(-60)))
sun = bpy.context.active_object
sun.data.energy = 3.0
sun.data.color = (1.0, 0.58, 0.32)
sun.data.angle = math.radians(2.5)

cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 50
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

VIEWS = [(-35, 12), (35, 18), (150, 14), (-120, 30)]   # azimuth from the front (-Y), elevation


def frame(root):
    pts = []
    for o in desc(root):
        if o.type == 'MESH':
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return (mn + mx) / 2, (mx - mn).length / 2


paths_all = {}
for name, root in roots.items():
    if ONLY and name not in ONLY:
        continue
    keep = set(o.name for o in desc(root))
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name != g.name:
            o.hide_render = o.name not in keep
    c, rad = frame(root)
    paths = []
    for i, (az, el) in enumerate(VIEWS):
        a, e = math.radians(az), math.radians(el)
        dist = rad / math.tan(math.radians(11.5)) * 0.92
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = c + d * dist
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam_data.clip_start = max(0.01, dist * 0.02)
        scene.render.filepath = os.path.join(SCR, f'prev_{name}_{i}.png')
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    sheet = np.zeros((1080, 1920, 4), np.float32)
    for i, p in enumerate(paths):
        im = bpy.data.images.load(p)
        px = np.array(im.pixels[:], np.float32).reshape(540, 960, 4)
        r, cc = divmod(i, 2)
        sheet[(1 - r) * 540:(2 - r) * 540, cc * 960:(cc + 1) * 960] = px
        bpy.data.images.remove(im)
    out = bpy.data.images.new('sheet', 1920, 1080, alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = os.path.join(SCR, f'sheet_{name}.png')
    out.file_format = 'PNG'
    out.save()
    bpy.data.images.remove(out)
    say('sheet', name)
say('DONE')
