# Turkey Trouble: bake and export. Runs inside farm.py (same names), after the world is built.
# Makes: lightmaps, the dusk sky (a picture for the background, an HDR for reflections), ground textures as WebP,
# assets/world.glb and assets/world.json (lamp strengths measured from the bake itself).
LM_RANGE = 4.0
SKY_RANGE = 4.0
SIZES = {'ground_n': 2048, 'ground_s': 2048, 'static_buildings': 2048, 'static_props': 1024, 'static_south': 1024}
scene.cycles.samples = int(os.environ.get('TT_BAKE_SAMPLES', '192'))
scene.cycles.use_adaptive_sampling = True
bk = scene.render.bake
bk.use_pass_direct = True
bk.use_pass_indirect = True
bk.use_pass_color = False
bk.margin = 6
scene.cycles.bake_type = 'DIFFUSE'
BAKED = {}


def save_web(name, arr, path, non_color=False, quality=90):
    """8-bit picture as .webp, .jpg or .png, by the path's ending"""
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
    img.file_format = {'.webp': 'WEBP', '.jpg': 'JPEG', '.png': 'PNG'}[os.path.splitext(path)[1]]
    try:
        img.save(quality=quality)
    except TypeError:
        img.save()
    bpy.data.images.remove(img)


def pixels_of(img):
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)


def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.maximum(x, 1e-8), 1 / 2.4) - 0.055)


def unwrap(ob):
    me = ob.data
    lm = me.uv_layers.new(name='lm')
    me.uv_layers.active = lm
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    me.uv_layers.active = me.uv_layers[0]


def bake(ob):
    size = SIZES[ob.name]
    img = bpy.data.images.new('bake_' + ob.name, size, size, alpha=False, float_buffer=True)
    added = []
    for m in ob.data.materials:
        n = m.node_tree.nodes.new('ShaderNodeTexImage')
        n.image = img
        m.node_tree.nodes.active = n
        added.append((m, n))
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    t = time.time()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, uv_layer='lm', margin=6, use_clear=True)
    lin = despeckle(pixels_of(img)[:, :, :3], size, passes=2)
    name = ob.name + '_lm.webp'
    save_web(ob.name + '_lm8', srgb(lin / LM_RANGE), os.path.join(ASSETS, name), quality=92)
    half = lin.reshape(size // 2, 2, size // 2, 2, 3).mean(axis=(1, 3))
    save_web(ob.name + '_lm8h', srgb(half / LM_RANGE), os.path.join(ASSETS, ob.name + '_lm_half.webp'), quality=90)
    for m, n in added:
        m.node_tree.nodes.remove(n)
    bpy.data.images.remove(img)
    ob['lm'] = name
    ob['lmRange'] = LM_RANGE
    BAKED[ob.name] = lin
    say(f'baked {ob.name} {size}px in {time.time() - t:.1f}s; mean {lin.mean():.4f}, p99 {np.percentile(lin, 99):.3f}, max {lin.max():.2f}')


# ---------------------------------------------------------------- lightmaps
static = []
for key in ('buildings', 'props', 'south'):
    ob = join(STATIC[key], 'static_' + key)
    ob['kind'] = 'baked'
    unwrap(ob)
    static.append(ob)
for ob in GROUND + static:
    bake(ob)


def ground_light(x, z):
    """the baked light on the ground at a spot (linear, light / pi), averaged over a small patch"""
    creek = next(l for l in L['escape']['lanes'] if l['kind'] == 'creek')
    split = (creek['z0'] + creek['z1']) / 2
    name, z0, z1 = ('ground_n', BND['minZ'], split) if z < split else ('ground_s', split, BND['maxZ'])
    lin = BAKED[name]
    size = lin.shape[0]
    c = int((x - BND['minX']) / (BND['maxX'] - BND['minX']) * size)
    r = int((z1 - z) / (z1 - z0) * size)
    c0, c1, r0, r1 = max(0, c - 3), min(size, c + 4), max(0, r - 3), min(size, r + 4)
    return [float(v) for v in lin[r0:r1, c0:c1].reshape(-1, 3).mean(axis=0)]


ambient = [float(v) for v in np.median(np.array([ground_light(x, z) for x, z in ((-30, -56), (30, -50), (-50, 20), (50, 50), (-55, 70), (55, 20))]), axis=0)]
lamp_info = []
for l in L['lamps']:
    lamp_info.append({'id': l['id'], 'x': l['x'], 'y': l['y'], 'z': l['z'], 'color': l['color'], 'reach': l['reach'], 'under': ground_light(l['x'], l['z']), 'watts': WATTS.get(l['id'], 400),
                      'pole': 1 if (l.get('pole') or l.get('arm') or l['id'] in ('yard', 'highway_w', 'highway_e')) else 0})
say('ambient on the ground', [round(v, 4) for v in ambient], '| under the yard lamp', [round(v, 3) for v in lamp_info[0]['under']])

# ---------------------------------------------------------------- the sky alone: background picture and reflection image
hidden = []
for o in scene.objects:
    if o.type in ('MESH', 'LIGHT') and not o.hide_render:
        o.hide_render = True
        hidden.append(o)
cd = bpy.data.cameras.new('pano')
cd.type = 'PANO'
try:
    cd.panorama_type = 'EQUIRECTANGULAR'
except Exception:
    cd.cycles.panorama_type = 'EQUIRECTANGULAR'
cam = bpy.data.objects.new('pano', cd)
scene.collection.objects.link(cam)
cam.location = (0, 0, 2.0)
cam.rotation_euler = (math.radians(90), 0, math.radians(-90))      # looks along +x: the centre of the picture is east
scene.camera = cam
scene.view_settings.view_transform = 'Standard'
scene.view_settings.exposure = 0.0
scene.cycles.samples = 32
scene.render.resolution_percentage = 100
scene.render.resolution_x, scene.render.resolution_y = 1024, 512
scene.render.image_settings.file_format = 'HDR'
scene.render.filepath = os.path.join(ASSETS, 'sky_env.hdr')
bpy.ops.render.render(write_still=True)
scene.render.resolution_x, scene.render.resolution_y = 4096, 2048
scene.render.image_settings.file_format = 'OPEN_EXR'
scene.render.image_settings.color_depth = '32'
big = os.path.join(OUT, 'sky_big.exr')
scene.render.filepath = big
bpy.ops.render.render(write_still=True)
for o in hidden:
    o.hide_render = False
sky_img = bpy.data.images.load(big)
sky = pixels_of(sky_img)[:, :, :3]
sky_code = lambda x: np.power(np.clip(x / SKY_RANGE, 0, 1), 1 / 3.0)        # the page cubes it again: fine steps in the dark
save_web('sky8', sky_code(sky), os.path.join(ASSETS, 'sky.webp'), non_color=True, quality=96)
h2 = sky.reshape(1024, 2, 2048, 2, 3).mean(axis=(1, 3))
save_web('sky8h', sky_code(h2), os.path.join(ASSETS, 'sky_half.webp'), non_color=True, quality=95)
horizon = [float(v) for v in sky[1024 + 6:1024 + 30, :, :].reshape(-1, 3).mean(axis=0)]
band = sky[1024 + 8:1024 + 140, :, :].mean(axis=(0, 2))
glow_u = float(np.convolve(np.concatenate([band[-64:], band, band[:64]]), np.ones(129) / 129, 'same')[64:-64].argmax() / 4096)
fog = [float(v) * 0.9 for v in np.percentile(sky[1024 + 45:1024 + 115, :, :].mean(axis=0), 25, axis=0)]      # the haze of the darker side: far ground never ends up lighter than the sky behind it
say('sky glow is at u =', round(glow_u, 3), '(the game wants about 0.944: west, a little south) | haze colour', [round(v, 3) for v in fog])
say('sky rendered; mean just above the horizon', [round(v, 4) for v in horizon], 'max', float(sky.max()))

# ---------------------------------------------------------------- export
for o in UNBAKED:
    if 'kind' not in o:
        o['kind'] = 'unbaked'
glow = [o for o in GLOW if o is not None]
for o in glow:
    if 'kind' not in o:
        o['kind'] = 'glow'
keep = GROUND + static + UNBAKED + glow
bpy.ops.object.select_all(action='DESELECT')
for o in keep:
    o.select_set(True)
bpy.context.view_layer.objects.active = keep[0]
path = os.path.join(ASSETS, 'world.glb')
kw = dict(filepath=path, export_format='GLB', use_selection=True, export_extras=True, export_apply=True, export_yup=True,
          export_cameras=False, export_lights=False, export_animations=False)
draco = dict(export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6, export_draco_position_quantization=14,
             export_draco_normal_quantization=10, export_draco_texcoord_quantization=15, export_draco_color_quantization=10, export_draco_generic_quantization=12)
for extra in (dict(export_image_format='WEBP', export_image_quality=82, **draco), dict(export_image_format='WEBP', export_image_quality=82), dict()):
    try:
        bpy.ops.export_scene.gltf(**kw, **extra)
        say('exported with', 'draco' if 'export_draco_mesh_compression_enable' in extra else 'no draco', '+ webp' if extra else '')
        break
    except Exception as e:
        say('export retry:', repr(e)[:200])
say('exported', path, round(os.path.getsize(path) / 1048576, 2), 'MB')

# ground pictures for the game's own ground shader
REDO_GROUND = os.environ.get('TT_GROUND_TEX') == '1'     # the ground pictures are photo sets now (build/ph_ground.py); 1 = write the code-made ones again
for n in (('mud', 'gravel', 'grass', 'asphalt', 'stubble') if REDO_GROUND else ()):
    a = pixels_of(load_image(os.path.join(TEX, n + '_a.png')))[:, :, :3]
    save_web('g_' + n, a, os.path.join(ASSETS, 'ground_' + n + '.webp'), quality=88)
for n in (('mud', 'asphalt', 'gravel') if REDO_GROUND else ()):
    nm = pixels_of(load_image(os.path.join(TEX, n + '_n.png'), True))[:, :, :3]
    save_web('gn_' + n, nm, os.path.join(ASSETS, 'ground_' + n + '_n.webp'), non_color=True, quality=90)
# ground_splat.png and ground_wet.png stay lossless PNG: each colour channel is its own mask, and lossy pictures
# (which mix the channels to compress them) leak one mask into another
sv = sun_vector()
json.dump({'lmRange': LM_RANGE, 'skyRange': SKY_RANGE, 'sunDir': [sv.x, sv.z, -sv.y], 'bounds': BND, 'ambient': ambient, 'horizon': horizon, 'fog': fog, 'glowU': glow_u, 'lamps': lamp_info},
          open(os.path.join(ASSETS, 'world.json'), 'w'), indent=1)
say('DONE bake')
