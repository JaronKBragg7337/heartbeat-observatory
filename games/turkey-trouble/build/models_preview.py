# Preview sheets of the models.blend that models.py saves into the scratch folder.
#   blender -b <scratch>/models.blend --python build/models_preview.py -- <scratch> [dusk|plain|both] [root names...]
# For each root and light: 3 views at 640x360 stitched into one 1920x360 sheet <scratch>/sheet_<root>_<light>.png
#   dusk  = dim warm low sun and a sunset sky over wet ground (how the game shows them); the third view is from 20 m
#           for the vehicles (about the size they are on a phone screen)
#   plain = even neutral light on a matte grey floor, to judge shape and colour
# 32 samples, denoised: about 1-2 s a view on the GPU.
import bpy, sys, os, math, time
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCR = ARGS[0] if ARGS else r'C:\Users\lilli\Projects\turkey-work\models'
MODES = ['dusk', 'plain']
if len(ARGS) > 1 and ARGS[1] in ('dusk', 'plain', 'both'):
    MODES = MODES if ARGS[1] == 'both' else [ARGS[1]]
    ONLY = ARGS[2:]
else:
    ONLY = ARGS[1:]
T0 = time.time()
scene = bpy.context.scene
scene.render.engine = 'CYCLES'


def say(*a):
    print(f'[preview {time.time() - T0:6.1f}s]', *a, flush=True)


try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'
    prefs.refresh_devices()
    for d in prefs.devices:
        d.use = d.type == 'OPTIX'
    scene.cycles.device = 'GPU'
except Exception as e:
    say('gpu', e)
scene.cycles.samples = 32
scene.cycles.use_denoising = True
try:
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass
W, H = 640, 360
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'

ROOTS = ['pickup', 'tractor_wagon', 'grain_truck', 'dog', 'log', 'pumpkin', 'net', 'feather']
VEHICLES = ('pickup', 'tractor_wagon', 'grain_truck')
roots = {n: bpy.data.objects[n] for n in ROOTS if n in bpy.data.objects}


def desc(o):
    out = [o]
    for c in o.children:
        out += desc(c)
    return out


# ground
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
g = bpy.context.active_object
gm = bpy.data.materials.new('ground')
gm.use_nodes = True
nt = gm.node_tree
gb = nt.nodes['Principled BSDF']
noise = nt.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 0.9
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.45
ramp.color_ramp.elements[0].color = (0.08, 0.08, 0.08, 1)
ramp.color_ramp.elements[1].position = 0.6
ramp.color_ramp.elements[1].color = (0.7, 0.7, 0.7, 1)
nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
g.data.materials.append(gm)

world = bpy.data.worlds.new('w')
scene.world = world
world.use_nodes = True
wn = world.node_tree
bg = wn.nodes['Background']
env = wn.nodes.new('ShaderNodeTexEnvironment')
exr = os.path.join(bpy.utils.resource_path('LOCAL'), 'datafiles', 'studiolights', 'world', 'sunset.exr')
try:
    env.image = bpy.data.images.load(exr)
except Exception:
    env.image = None
bpy.ops.object.light_add(type='SUN')
sun = bpy.context.active_object
sun.data.angle = math.radians(2.5)


def set_light(mode):
    for l in list(wn.links):
        if l.to_node == bg:
            wn.links.remove(l)
    for l in list(nt.links):
        if l.to_socket == gb.inputs['Roughness']:
            nt.links.remove(l)
    if mode == 'dusk':
        if env.image is not None:
            wn.links.new(env.outputs['Color'], bg.inputs['Color'])
        else:
            bg.inputs['Color'].default_value = (0.10, 0.08, 0.09, 1)
        bg.inputs['Strength'].default_value = 0.22
        sun.rotation_euler = (math.radians(84), 0, math.radians(-60))
        sun.data.energy = 1.6
        sun.data.color = (1.0, 0.55, 0.30)
        gb.inputs['Base Color'].default_value = (0.045, 0.037, 0.03, 1)
        nt.links.new(ramp.outputs['Color'], gb.inputs['Roughness'])
        scene.view_settings.exposure = 0.3
    else:
        bg.inputs['Color'].default_value = (0.55, 0.56, 0.58, 1)
        bg.inputs['Strength'].default_value = 0.9
        sun.rotation_euler = (math.radians(40), 0, math.radians(-35))
        sun.data.energy = 3.2
        sun.data.color = (1.0, 0.97, 0.92)
        gb.inputs['Base Color'].default_value = (0.20, 0.20, 0.20, 1)
        gb.inputs['Roughness'].default_value = 0.9
        scene.view_settings.exposure = 0.0


cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 50
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

VIEWS = [(-35, 12, None), (145, 16, None), (-100, 22, None)]      # azimuth from the front (-Y), elevation, distance


def frame(root):
    pts = []
    for o in desc(root):
        if o.type == 'MESH':
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return (mn + mx) / 2, (mx - mn).length / 2


for mode in MODES:
    set_light(mode)
    for name, root in roots.items():
        if ONLY and name not in ONLY:
            continue
        keep = set(o.name for o in desc(root))
        for o in bpy.data.objects:
            if o.type == 'MESH' and o.name != g.name:
                o.hide_render = o.name not in keep
        c, rad = frame(root)
        views = list(VIEWS)
        if mode == 'dusk' and name in VEHICLES:
            views[2] = (-60, 9, 20.0)           # 20 m away: phone-screen size
        paths = []
        for i, (az, el, dist) in enumerate(views):
            a, e = math.radians(az), math.radians(el)
            if dist is None:
                dist = rad / math.tan(math.radians(13)) * 0.95
            d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
            cam.location = c + d * dist
            cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
            cam_data.clip_start = max(0.01, dist * 0.02)
            scene.render.filepath = os.path.join(SCR, f'prev_{name}_{mode}_{i}.png')
            bpy.ops.render.render(write_still=True)
            paths.append(scene.render.filepath)
        sheet = np.zeros((H, W * 3, 4), np.float32)
        for i, p in enumerate(paths):
            im = bpy.data.images.load(p)
            px = np.array(im.pixels[:], np.float32).reshape(H, W, 4)
            sheet[:, i * W:(i + 1) * W] = px
            bpy.data.images.remove(im)
        out = bpy.data.images.new('sheet', W * 3, H, alpha=True)
        out.pixels.foreach_set(sheet.ravel())
        out.filepath_raw = os.path.join(SCR, f'sheet_{name}_{mode}.png')
        out.file_format = 'PNG'
        out.save()
        bpy.data.images.remove(out)
        say('sheet', name, mode)
say('DONE')
