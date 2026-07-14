"""Build Heartbeat Observatory's realism-first Town Square art kit.

Run with Blender 5.x:
    blender --background --python tools/blender/generate_heartbeat_town_realism.py

The script writes an editable .blend source, a web-ready .glb, and a preview render.
Geometry is deliberately authored as one coherent kit and merged by material so the
browser gets detailed silhouettes without paying one draw call per architectural part.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


REPO = Path(__file__).resolve().parents[2]
ASSET_DIR = REPO / "engine" / "hub" / "assets"
SOURCE_DIR = ASSET_DIR / "source"
ART_DIR = REPO / "docs" / "art"
BLEND_PATH = SOURCE_DIR / "heartbeat-town-realism-v1.blend"
GLB_PATH = ASSET_DIR / "heartbeat-town-realism-v1.glb"
PREVIEW_PATH = ART_DIR / "heartbeat-town-realism-v1.png"


def ensure_dirs() -> None:
    for path in (ASSET_DIR, SOURCE_DIR, ART_DIR):
        path.mkdir(parents=True, exist_ok=True)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def mat(name: str, color: tuple[float, float, float, float], roughness: float = 0.7,
        metallic: float = 0.0, emission: tuple[float, float, float, float] | None = None,
        emission_strength: float = 0.0) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission:
            socket = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
            if socket:
                socket.default_value = emission
            strength_socket = bsdf.inputs.get("Emission Strength")
            if strength_socket:
                strength_socket.default_value = emission_strength
    return material


def assign(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    if not obj.data.materials:
        obj.data.materials.append(material)
    else:
        obj.data.materials[0] = material


def parent(obj: bpy.types.Object, root: bpy.types.Object) -> bpy.types.Object:
    obj.parent = root
    return obj


def apply_bevel(obj: bpy.types.Object, width: float, segments: int = 2) -> None:
    if width <= 0:
        return
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Micro bevel", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def project_box_uv(obj: bpy.types.Object, meters_per_tile: float = 1.5) -> None:
    """Give beveled boxes consistent world-scale UVs instead of stretched cube UVs."""
    mesh = obj.data
    uv_layer = mesh.uv_layers.active or mesh.uv_layers.new(name="TownUV")
    inv = 1.0 / meters_per_tile
    for polygon in mesh.polygons:
        normal = polygon.normal
        ax, ay, az = abs(normal.x), abs(normal.y), abs(normal.z)
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            if az >= ax and az >= ay:
                uv = (vertex.x * inv, vertex.y * inv)
            elif ax >= ay:
                uv = (vertex.y * inv, vertex.z * inv)
            else:
                uv = (vertex.x * inv, vertex.z * inv)
            uv_layer.data[loop_index].uv = uv


def box(name: str, loc: tuple[float, float, float], scale: tuple[float, float, float],
        material: bpy.types.Material, root: bpy.types.Object, bevel: float = 0.025,
        rotation: tuple[float, float, float] = (0, 0, 0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0] / 2, scale[1] / 2, scale[2] / 2)
    assign(obj, material)
    parent(obj, root)
    apply_bevel(obj, min(bevel, min(scale) * 0.22))
    project_box_uv(obj)
    return obj


def cylinder(name: str, loc: tuple[float, float, float], radius: float, depth: float,
             material: bpy.types.Material, root: bpy.types.Object, vertices: int = 16,
             rotation: tuple[float, float, float] = (0, 0, 0), bevel: float = 0.015) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    assign(obj, material)
    parent(obj, root)
    apply_bevel(obj, bevel)
    return obj


def sphere(name: str, loc: tuple[float, float, float], scale: tuple[float, float, float],
           material: bpy.types.Material, root: bpy.types.Object, segments: int = 16,
           rings: int = 10) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, material)
    parent(obj, root)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def ico(name: str, loc: tuple[float, float, float], scale: tuple[float, float, float],
        material: bpy.types.Material, root: bpy.types.Object, subdivisions: int = 2) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, material)
    parent(obj, root)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def beam_between(name: str, start: tuple[float, float, float], end: tuple[float, float, float],
                 radius: float, material: bpy.types.Material, root: bpy.types.Object,
                 vertices: int = 10) -> bpy.types.Object:
    a, b = Vector(start), Vector(end)
    direction = b - a
    mid = (a + b) * 0.5
    obj = cylinder(name, tuple(mid), radius, direction.length, material, root, vertices=vertices, bevel=radius * 0.18)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    return obj


def text_mesh(name: str, text: str, loc: tuple[float, float, float], size: float,
              material: bpy.types.Material, root: bpy.types.Object,
              rotation: tuple[float, float, float]) -> bpy.types.Object:
    curve = bpy.data.curves.new(name + "Curve", type="FONT")
    curve.body = text
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = 0.022
    curve.bevel_depth = 0.006
    curve.bevel_resolution = 1
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rotation
    assign(obj, material)
    parent(obj, root)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def three_to_blender(x: float, z: float, height: float = 0.0) -> tuple[float, float, float]:
    return (x, -z, height)


def building_shell(name: str, x: float, z: float, width: float, depth: float, height: float,
                   facade: bpy.types.Material, trim: bpy.types.Material, roof: bpy.types.Material,
                   glass: bpy.types.Material, door: bpy.types.Material, sign_bg: bpy.types.Material,
                   sign_letters: bpy.types.Material, root: bpy.types.Object, front: str,
                   label: str, architectural_style: str = "civic") -> None:
    bx, by, _ = three_to_blender(x, z)
    wall = 0.16
    # A complete outer skin sits just beyond the existing collision boxes.
    box(name + "_front", (bx, by - depth / 2 - wall / 2, height / 2), (width + 0.08, wall, height), facade, root, 0.035)
    box(name + "_back", (bx, by + depth / 2 + wall / 2, height / 2), (width + 0.08, wall, height), facade, root, 0.035)
    box(name + "_left", (bx - width / 2 - wall / 2, by, height / 2), (wall, depth, height), facade, root, 0.035)
    box(name + "_right", (bx + width / 2 + wall / 2, by, height / 2), (wall, depth, height), facade, root, 0.035)
    box(name + "_plinth", (bx, by, 0.16), (width + 0.42, depth + 0.42, 0.32), trim, root, 0.04)

    # Cornice/parapet and rooftop services give the silhouette real architectural weight.
    box(name + "_cornice", (bx, by, height - 0.14), (width + 0.42, depth + 0.42, 0.28), trim, root, 0.045)
    box(name + "_parapet", (bx, by, height + 0.12), (width + 0.28, depth + 0.28, 0.36), roof, root, 0.04)
    box(name + "_roof", (bx, by, height + 0.31), (width - 0.36, depth - 0.36, 0.12), roof, root, 0.025)
    box(name + "_hvac", (bx + width * 0.19, by + depth * 0.05, height + 0.55), (0.72, 0.55, 0.42), trim, root, 0.035)

    floors = max(1, round(height / 1.5))
    for floor in range(floors):
        wz = min(height - 0.62, 0.78 + floor * (height - 0.7) / max(1, floors))
        window_h = min(0.62, height / (floors + 1) * 0.54)
        cols = max(2, round(width / 1.25))
        for col in range(cols):
            wx = bx - width * 0.39 + (width * 0.78) * (col + 0.5) / cols
            win_w = width * 0.68 / cols
            box(name + "_win_f", (wx, by - depth / 2 - wall - 0.018, wz), (win_w, 0.045, window_h), glass, root, 0.012)
            box(name + "_win_b", (wx, by + depth / 2 + wall + 0.018, wz), (win_w, 0.045, window_h), glass, root, 0.012)
        side_cols = max(1, round(depth / 1.5))
        for col in range(side_cols):
            wy = by - depth * 0.36 + (depth * 0.72) * (col + 0.5) / side_cols
            win_w = depth * 0.6 / side_cols
            box(name + "_win_l", (bx - width / 2 - wall - 0.018, wy, wz), (0.045, win_w, window_h), glass, root, 0.012)
            box(name + "_win_r", (bx + width / 2 + wall + 0.018, wy, wz), (0.045, win_w, window_h), glass, root, 0.012)

    # Material-specific facade structure.
    if architectural_style in {"brick", "industrial"}:
        for course in range(1, max(2, int(height / 0.42))):
            hz = course * 0.42
            box(name + "_course_f", (bx, by - depth / 2 - wall - 0.045, hz), (width + 0.04, 0.025, 0.025), trim, root, 0.004)
            box(name + "_course_b", (bx, by + depth / 2 + wall + 0.045, hz), (width + 0.04, 0.025, 0.025), trim, root, 0.004)
    if architectural_style == "artdeco":
        for sx in (-0.38, 0.0, 0.38):
            box(name + "_deco", (bx + width * sx, by - depth / 2 - wall - 0.04, height * 0.55), (0.16, 0.07, height * 0.78), trim, root, 0.012)
    if architectural_style == "industrial":
        for sx in (-0.32, 0.0, 0.32):
            box(name + "_steel", (bx + width * sx, by - depth / 2 - wall - 0.055, height * 0.52), (0.12, 0.08, height * 0.88), trim, root, 0.01)

    # Front orientation and entrance assembly.
    if front in {"south", "north"}:
        toward_three_z = 1 if front == "south" else -1
        front_y = by - toward_three_z * (depth / 2 + wall)
        outward = -toward_three_z
        box(name + "_entry", (bx, front_y + outward * 0.04, 0.94), (1.18, 0.09, 1.78), door, root, 0.025)
        box(name + "_transom", (bx, front_y + outward * 0.06, 1.75), (1.28, 0.07, 0.26), glass, root, 0.015)
        box(name + "_canopy", (bx, front_y + outward * 0.46, 2.02), (2.35, 0.9, 0.12), trim, root, 0.025)
        box(name + "_sign", (bx, front_y + outward * 0.075, 2.42), (min(width * 0.72, 3.5), 0.1, 0.62), sign_bg, root, 0.035)
        text_rot = (math.radians(90 if front == "south" else -90), 0, 0)
        text_y = front_y + outward * 0.145
        text_mesh(name + "_letters", label.upper(), (bx, text_y, 2.42), min(0.36, 2.7 / max(6, len(label))), sign_letters, root, text_rot)
        for sx in (-0.78, 0.78):
            cylinder(name + "_sconce", (bx + sx, front_y + outward * 0.14, 1.62), 0.055, 0.18, sign_letters, root, vertices=12, rotation=(math.pi / 2, 0, 0), bevel=0.008)
    else:
        toward_x = 1 if front == "east" else -1
        front_x = bx + toward_x * (width / 2 + wall)
        box(name + "_entry", (front_x + toward_x * 0.04, by, 0.94), (0.09, 1.18, 1.78), door, root, 0.025)
        box(name + "_canopy", (front_x + toward_x * 0.46, by, 2.02), (0.9, 2.35, 0.12), trim, root, 0.025)
        box(name + "_sign", (front_x + toward_x * 0.075, by, 2.45), (0.1, min(depth * 0.72, 3.5), 0.62), sign_bg, root, 0.035)
        text_rot = (math.pi / 2, math.radians(-90 if front == "east" else 90), 0)
        text_x = front_x + toward_x * 0.15
        text_mesh(name + "_letters", label.upper(), (text_x, by, 2.45), min(0.32, 2.5 / max(6, len(label))), sign_letters, root, text_rot)

    # Apartments receive balconies and slim rails instead of the same civic facade language.
    if architectural_style == "apartments":
        for level in range(1, floors):
            balcony_z = min(height - 0.55, 0.65 + level * 1.35)
            box(name + "_balcony", (bx, by - depth / 2 - 0.48, balcony_z), (width * 0.76, 0.72, 0.12), trim, root, 0.02)
            box(name + "_balcony_rail", (bx, by - depth / 2 - 0.82, balcony_z + 0.38), (width * 0.76, 0.05, 0.7), trim, root, 0.012)


def mature_tree(name: str, x: float, z: float, height: float, trunk_mat: bpy.types.Material,
                leaf_mats: list[bpy.types.Material], root: bpy.types.Object, variant: int) -> None:
    bx, by, _ = three_to_blender(x, z)
    trunk_h = height * 0.42
    cylinder(name + "_trunk", (bx, by, trunk_h / 2), 0.17 + 0.025 * (variant % 3), trunk_h, trunk_mat, root, vertices=12, bevel=0.025)
    branch_specs = [(-0.55, 0.18), (0.46, 0.42), (-0.2, -0.48), (0.38, -0.32)]
    for i, (dx, dy) in enumerate(branch_specs):
        start = (bx, by, trunk_h * (0.56 + i * 0.07))
        end = (bx + dx * height * 0.2, by + dy * height * 0.18, trunk_h + height * (0.05 + (i % 2) * 0.08))
        beam_between(name + f"_branch_{i}", start, end, 0.065, trunk_mat, root, vertices=9)
    crowns = [
        (-0.34, 0.1, 0.72, 0.82), (0.34, 0.04, 0.78, 0.86),
        (-0.08, -0.35, 0.76, 0.82), (0.08, 0.38, 0.7, 0.78), (0, 0, 0.96, 1.0)
    ]
    for i, (ox, oy, sz, sy) in enumerate(crowns):
        material = leaf_mats[(variant + i) % len(leaf_mats)]
        ico(name + f"_crown_{i}", (bx + ox * height * 0.24, by + oy * height * 0.22, trunk_h + height * (0.16 + 0.08 * (i == 4))),
            (height * 0.17 * sz, height * 0.15 * sz, height * 0.15 * sy), material, root, subdivisions=2)


def bench(name: str, x: float, z: float, rotation_y: float, wood: bpy.types.Material,
          metal: bpy.types.Material, root: bpy.types.Object) -> None:
    bx, by, _ = three_to_blender(x, z)
    g = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(g)
    g.location = (bx, by, 0)
    # Three's Y rotation maps to a Blender Z rotation with the opposite sign.
    g.rotation_euler.z = -rotation_y
    parent(g, root)
    for i in range(5):
        y = -0.18 + i * 0.09
        box(name + f"_seat_{i}", (0, y, 0.58), (1.82, 0.065, 0.065), wood, g, 0.016)
    for i in range(5):
        zc = 0.72 + i * 0.105
        box(name + f"_back_{i}", (0, 0.22, zc), (1.82, 0.055, 0.07), wood, g, 0.014)
    for sx in (-0.72, 0.72):
        box(name + "_leg", (sx, 0, 0.3), (0.09, 0.38, 0.58), metal, g, 0.025)
        box(name + "_arm", (sx, -0.02, 0.78), (0.08, 0.42, 0.08), metal, g, 0.018)


def streetlight(name: str, x: float, z: float, metal: bpy.types.Material,
                glass: bpy.types.Material, root: bpy.types.Object) -> None:
    bx, by, _ = three_to_blender(x, z)
    cylinder(name + "_base", (bx, by, 0.12), 0.18, 0.24, metal, root, vertices=16, bevel=0.02)
    cylinder(name + "_pole", (bx, by, 1.7), 0.055, 3.25, metal, root, vertices=12, bevel=0.012)
    box(name + "_arm", (bx, by - 0.22, 3.18), (0.08, 0.48, 0.08), metal, root, 0.018)
    box(name + "_lantern", (bx, by - 0.45, 2.98), (0.34, 0.34, 0.42), metal, root, 0.035)
    box(name + "_glow", (bx, by - 0.455, 2.96), (0.24, 0.36, 0.29), glass, root, 0.02)


def planter(name: str, x: float, z: float, stone: bpy.types.Material,
            leaves: bpy.types.Material, root: bpy.types.Object) -> None:
    bx, by, _ = three_to_blender(x, z)
    cylinder(name + "_pot", (bx, by, 0.34), 0.38, 0.62, stone, root, vertices=16, bevel=0.025)
    for i in range(5):
        angle = i / 5 * math.tau
        ico(name + f"_leaf_{i}", (bx + math.cos(angle) * 0.18, by + math.sin(angle) * 0.18, 0.77 + 0.08 * (i % 2)),
            (0.28, 0.22, 0.36), leaves, root, subdivisions=2)


def trash_bin(name: str, x: float, z: float, metal: bpy.types.Material,
              root: bpy.types.Object) -> None:
    bx, by, _ = three_to_blender(x, z)
    cylinder(name + "_body", (bx, by, 0.42), 0.29, 0.78, metal, root, vertices=16, bevel=0.025)
    cylinder(name + "_rim", (bx, by, 0.84), 0.31, 0.09, metal, root, vertices=16, bevel=0.018)
    for i in range(12):
        angle = i / 12 * math.tau
        box(name + f"_slat_{i}", (bx + math.cos(angle) * 0.272, by + math.sin(angle) * 0.272, 0.44),
            (0.045, 0.045, 0.66), metal, root, 0.008, rotation=(0, 0, angle))


def fountain(root: bpy.types.Object, stone: bpy.types.Material, stone_dark: bpy.types.Material,
             water: bpy.types.Material, brass: bpy.types.Material) -> None:
    cylinder("Fountain_Plinth", (0, 0, 0.14), 2.52, 0.28, stone_dark, root, vertices=40, bevel=0.045)
    cylinder("Fountain_Basin", (0, 0, 0.42), 2.34, 0.34, stone, root, vertices=40, bevel=0.055)
    cylinder("Fountain_Water", (0, 0, 0.61), 2.08, 0.06, water, root, vertices=40, bevel=0.012)
    cylinder("Fountain_Column", (0, 0, 1.22), 0.28, 1.3, stone_dark, root, vertices=20, bevel=0.035)
    cylinder("Fountain_Bowl", (0, 0, 1.86), 0.82, 0.24, stone, root, vertices=28, bevel=0.04)
    cylinder("Fountain_BowlWater", (0, 0, 2.01), 0.69, 0.045, water, root, vertices=28, bevel=0.008)
    sphere("Fountain_Finial", (0, 0, 2.24), (0.15, 0.15, 0.15), brass, root, segments=20, rings=12)
    for i in range(8):
        angle = i / 8 * math.tau
        box("Fountain_Paver", (math.cos(angle) * 3.28, math.sin(angle) * 3.28, 0.08), (0.62, 0.82, 0.09), stone_dark, root, 0.025, rotation=(0, 0, -angle))


def bandstand(root: bpy.types.Object, wood: bpy.types.Material, metal: bpy.types.Material,
              roof: bpy.types.Material, stone: bpy.types.Material, letters: bpy.types.Material) -> None:
    bx, by, _ = three_to_blender(-16, 22)
    cylinder("Bandstand_Base", (bx, by, 0.16), 3.36, 0.32, stone, root, vertices=32, bevel=0.04)
    cylinder("Bandstand_Deck", (bx, by, 0.36), 3.08, 0.18, wood, root, vertices=32, bevel=0.03)
    for i in range(8):
        angle = i / 8 * math.tau
        px, py = bx + math.cos(angle) * 2.72, by + math.sin(angle) * 2.72
        cylinder("Bandstand_Post", (px, py, 1.78), 0.075, 2.78, metal, root, vertices=12, bevel=0.012)
        # Decorative braces keep the pavilion from reading as a toy umbrella.
        beam_between("Bandstand_Brace", (px, py, 2.72), (bx + math.cos(angle) * 2.25, by + math.sin(angle) * 2.25, 3.05), 0.045, metal, root, vertices=9)
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=3.58, radius2=0.38, depth=1.18, location=(bx, by, 3.38))
    roof_obj = bpy.context.object
    roof_obj.name = "Bandstand_Roof"
    assign(roof_obj, roof)
    parent(roof_obj, root)
    apply_bevel(roof_obj, 0.035)
    cylinder("Bandstand_Cupola", (bx, by, 4.13), 0.31, 0.52, metal, root, vertices=12, bevel=0.02)
    sphere("Bandstand_Finial", (bx, by, 4.46), (0.12, 0.12, 0.12), letters, root, segments=16, rings=10)


def cafe_cluster(root: bpy.types.Object, wood: bpy.types.Material, metal: bpy.types.Material,
                 canvas: bpy.types.Material) -> None:
    clusters = [(-6.5, 7.6), (6.6, 7.2), (-7.2, -7.4), (7.4, -7.1)]
    for idx, (x, z) in enumerate(clusters):
        bx, by, _ = three_to_blender(x, z)
        cylinder(f"Cafe_Table_{idx}", (bx, by, 0.72), 0.58, 0.09, wood, root, vertices=24, bevel=0.02)
        cylinder(f"Cafe_Post_{idx}", (bx, by, 0.38), 0.055, 0.7, metal, root, vertices=12, bevel=0.01)
        cylinder(f"Cafe_Base_{idx}", (bx, by, 0.06), 0.31, 0.08, metal, root, vertices=20, bevel=0.015)
        cylinder(f"Cafe_UmbrellaPole_{idx}", (bx, by, 1.72), 0.035, 2.0, metal, root, vertices=10, bevel=0.006)
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=1.34, radius2=0.14, depth=0.48, location=(bx, by, 2.46))
        shade = bpy.context.object
        shade.name = f"Cafe_Umbrella_{idx}"
        assign(shade, canvas)
        parent(shade, root)
        apply_bevel(shade, 0.018)


def create_avatar(root: bpy.types.Object, materials: dict[str, bpy.types.Material]) -> None:
    # The template faces Blender +Y, which becomes Three.js -Z after glTF's Y-up conversion.
    hips = bpy.data.objects.new("AvatarRig", None)
    bpy.context.collection.objects.link(hips)
    hips.parent = root

    # Torso, clothing, neck and head.
    sphere("Avatar_Shirt_Torso", (0, 0, 1.05), (0.255, 0.175, 0.36), materials["shirt"], hips, segments=20, rings=14)
    sphere("Avatar_Pants_Hips", (0, 0, 0.72), (0.235, 0.16, 0.17), materials["pants"], hips, segments=18, rings=12)
    cylinder("Avatar_Belt", (0, 0, 0.79), 0.226, 0.065, materials["belt"], hips, vertices=18, bevel=0.01)
    cylinder("Avatar_Skin_Neck", (0, 0, 1.37), 0.073, 0.14, materials["skin"], hips, vertices=16, bevel=0.012)
    sphere("Avatar_Skin_Head", (0, 0.006, 1.56), (0.172, 0.15, 0.22), materials["skin"], hips, segments=24, rings=16)
    sphere("Avatar_Skin_Nose", (0, 0.145, 1.57), (0.037, 0.045, 0.05), materials["skin"], hips, segments=12, rings=8)
    sphere("Avatar_Skin_EarL", (-0.17, 0.0, 1.57), (0.025, 0.018, 0.045), materials["skin"], hips, segments=10, rings=7)
    sphere("Avatar_Skin_EarR", (0.17, 0.0, 1.57), (0.025, 0.018, 0.045), materials["skin"], hips, segments=10, rings=7)
    for ex in (-0.063, 0.063):
        sphere("Avatar_Eye", (ex, 0.142, 1.615), (0.019, 0.012, 0.014), materials["eye"], hips, segments=10, rings=7)
        box("Avatar_Brow", (ex, 0.148, 1.66), (0.072, 0.012, 0.014), materials["hair"], hips, 0.004)
    box("Avatar_Mouth", (0, 0.151, 1.505), (0.065, 0.01, 0.014), materials["mouth"], hips, 0.004)
    # Hair cap plus side/back mass.
    sphere("Avatar_Hair_Cap", (0, -0.01, 1.67), (0.183, 0.158, 0.13), materials["hair"], hips, segments=20, rings=12)
    box("Avatar_Hair_Back", (0, -0.125, 1.585), (0.27, 0.055, 0.18), materials["hair"], hips, 0.035)

    # Shoulder/arm pivots allow a lightweight procedural walk cycle in Three.js.
    for side, sx in (("L", -1), ("R", 1)):
        arm = bpy.data.objects.new("RigArm" + side, None)
        bpy.context.collection.objects.link(arm)
        arm.location = (sx * 0.285, 0, 1.25)
        arm.parent = hips
        cylinder("Avatar_Shirt_Arm" + side, (0, 0, -0.18), 0.073, 0.34, materials["shirt"], arm, vertices=14, bevel=0.018)
        cylinder("Avatar_Skin_Forearm" + side, (0, 0, -0.43), 0.058, 0.22, materials["skin"], arm, vertices=14, bevel=0.014)
        sphere("Avatar_Skin_Hand" + side, (0, 0.008, -0.58), (0.067, 0.052, 0.083), materials["skin"], arm, segments=14, rings=9)

    for side, sx in (("L", -1), ("R", 1)):
        leg = bpy.data.objects.new("RigLeg" + side, None)
        bpy.context.collection.objects.link(leg)
        leg.location = (sx * 0.125, 0, 0.69)
        leg.parent = hips
        cylinder("Avatar_Pants_Leg" + side, (0, 0, -0.3), 0.085, 0.54, materials["pants"], leg, vertices=14, bevel=0.018)
        cylinder("Avatar_Sock" + side, (0, 0, -0.61), 0.066, 0.14, materials["belt"], leg, vertices=12, bevel=0.012)
        sphere("Avatar_Shoe" + side, (0, 0.055, -0.72), (0.105, 0.16, 0.075), materials["shoe"], leg, segments=16, rings=10)


def is_descendant(obj: bpy.types.Object, root: bpy.types.Object) -> bool:
    current = obj.parent
    while current is not None:
        if current == root:
            return True
        current = current.parent
    return False


def merge_town_by_material(town_root: bpy.types.Object) -> None:
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH" and obj != town_root and obj.parent is not None]
    # Only merge descendants of the TownArt root; avatar meshes retain names and pivots.
    meshes = [obj for obj in meshes if is_descendant(obj, town_root)]
    material_groups: dict[str, list[bpy.types.Object]] = {}
    for obj in meshes:
        material_name = obj.data.materials[0].name if obj.data.materials else "Unassigned"
        material_groups.setdefault(material_name, []).append(obj)
    for material_name, objects in material_groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        merged = bpy.context.object
        merged.name = "Town_" + material_name.replace("MAT_", "")
        merged.parent = town_root
        merged.select_set(False)


def set_camera(camera: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_scene() -> None:
    ensure_dirs()
    clear_scene()

    # Restrained civic palette. Material names are contracts used by Three.js to add
    # procedural brick/concrete/metal detail after glTF loading.
    materials = {
        "brick_red": mat("MAT_Brick_Red", (0.29, 0.105, 0.075, 1), 0.86),
        "brick_dark": mat("MAT_Brick_Dark", (0.13, 0.07, 0.055, 1), 0.9),
        "brick_buff": mat("MAT_Brick_Buff", (0.42, 0.31, 0.21, 1), 0.86),
        "limestone": mat("MAT_Stone_Limestone", (0.57, 0.51, 0.41, 1), 0.78),
        "concrete": mat("MAT_Concrete_Warm", (0.39, 0.40, 0.39, 1), 0.88),
        "concrete_dark": mat("MAT_Concrete_Dark", (0.18, 0.2, 0.2, 1), 0.9),
        "steel": mat("MAT_Metal_Black", (0.055, 0.065, 0.07, 1), 0.42, 0.72),
        "bronze": mat("MAT_Metal_Bronze", (0.26, 0.16, 0.07, 1), 0.35, 0.72),
        "roof": mat("MAT_Roof_Slate", (0.075, 0.09, 0.105, 1), 0.74),
        "glass": mat("MAT_Glass_Town", (0.045, 0.105, 0.135, 1), 0.17, 0.28, (0.035, 0.11, 0.16, 1), 0.28),
        "glass_warm": mat("MAT_Glass_Warm", (0.29, 0.18, 0.08, 1), 0.22, 0.18, (0.7, 0.28, 0.055, 1), 1.1),
        "door": mat("MAT_Door_Wood", (0.12, 0.065, 0.035, 1), 0.58),
        "sign": mat("MAT_Sign_Back", (0.035, 0.045, 0.05, 1), 0.45, 0.25),
        "letters": mat("MAT_Sign_Letters", (0.84, 0.67, 0.28, 1), 0.32, 0.5, (0.8, 0.5, 0.12, 1), 1.6),
        "paving": mat("MAT_Paving_Stone", (0.37, 0.35, 0.31, 1), 0.93),
        "asphalt": mat("MAT_Asphalt", (0.12, 0.135, 0.14, 1), 0.96),
        "wood": mat("MAT_Wood_Oak", (0.25, 0.135, 0.065, 1), 0.76),
        "canvas": mat("MAT_Canvas", (0.28, 0.12, 0.085, 1), 0.82),
        "trunk": mat("MAT_Tree_Bark", (0.16, 0.085, 0.045, 1), 0.96),
        "leaf1": mat("MAT_Leaves_Deep", (0.055, 0.17, 0.085, 1), 0.92),
        "leaf2": mat("MAT_Leaves_Olive", (0.105, 0.225, 0.095, 1), 0.92),
        "leaf3": mat("MAT_Leaves_Sage", (0.16, 0.28, 0.125, 1), 0.92),
        "water": mat("MAT_Water", (0.035, 0.24, 0.34, 1), 0.14, 0.15, (0.02, 0.14, 0.22, 1), 0.6),
    }

    town_root = bpy.data.objects.new("TownArt", None)
    bpy.context.collection.objects.link(town_root)

    # Ground hierarchy overlays the prototype surfaces by a few centimeters.
    box("MainWalk_NS", (0, 0, 0.072), (6.1, 60.0, 0.10), materials["paving"], town_root, 0.025)
    box("MainWalk_EW", (0, 0, 0.078), (60.0, 6.1, 0.11), materials["paving"], town_root, 0.025)
    box("CivicPlaza", (0, 0, 0.088), (12.4, 12.4, 0.12), materials["paving"], town_root, 0.035)
    bx, by, _ = three_to_blender(0, -23.4)
    box("NeighborhoodWalk", (bx, by, 0.074), (46.0, 3.25, 0.10), materials["paving"], town_root, 0.025)
    # Dark road shoulders visually separate the pedestrian plaza from lawn.
    box("RoadShoulder_NS_L", (-3.42, 0, 0.046), (0.52, 60, 0.055), materials["asphalt"], town_root, 0.018)
    box("RoadShoulder_NS_R", (3.42, 0, 0.046), (0.52, 60, 0.055), materials["asphalt"], town_root, 0.018)
    box("RoadShoulder_EW_N", (0, -3.42, 0.048), (60, 0.52, 0.055), materials["asphalt"], town_root, 0.018)
    box("RoadShoulder_EW_S", (0, 3.42, 0.048), (60, 0.52, 0.055), materials["asphalt"], town_root, 0.018)

    building_shell("Social", -16, -13, 4.9, 4.1, 2.75, materials["brick_red"], materials["limestone"], materials["roof"], materials["glass_warm"], materials["door"], materials["sign"], materials["letters"], town_root, "south", "Social", "brick")
    building_shell("Projects", 16, -13, 5.1, 4.1, 2.9, materials["limestone"], materials["bronze"], materials["roof"], materials["glass"], materials["door"], materials["sign"], materials["letters"], town_root, "south", "Projects", "civic")
    building_shell("Games", -16, 10, 4.8, 4.2, 2.65, materials["brick_dark"], materials["steel"], materials["roof"], materials["glass_warm"], materials["door"], materials["sign"], materials["letters"], town_root, "north", "Games", "industrial")
    building_shell("Library", -9, -18.6, 5.0, 4.0, 3.0, materials["brick_buff"], materials["limestone"], materials["roof"], materials["glass_warm"], materials["door"], materials["sign"], materials["letters"], town_root, "south", "Library", "brick")
    building_shell("Theater", 9, -18.6, 5.0, 4.0, 2.85, materials["limestone"], materials["bronze"], materials["roof"], materials["glass_warm"], materials["door"], materials["sign"], materials["letters"], town_root, "south", "Theater", "artdeco")
    building_shell("Workshop", 16, 10, 5.2, 4.3, 3.05, materials["brick_dark"], materials["steel"], materials["roof"], materials["glass"], materials["door"], materials["sign"], materials["letters"], town_root, "north", "Workshop", "industrial")
    building_shell("ApartmentsWest", -25, 0, 3.8, 6.6, 5.0, materials["brick_red"], materials["steel"], materials["roof"], materials["glass_warm"], materials["door"], materials["sign"], materials["letters"], town_root, "east", "Residences", "apartments")
    building_shell("ApartmentsEast", 25, 0, 3.8, 6.6, 5.0, materials["brick_buff"], materials["steel"], materials["roof"], materials["glass_warm"], materials["door"], materials["sign"], materials["letters"], town_root, "west", "Residences", "apartments")

    tree_spots = [
        (-12, 5), (12, 5), (-12, -5), (12, -5), (-20, -16), (20, -16),
        (-20, 16), (20, 16), (-29, -6), (29, -6), (-29, 6), (29, 6),
        (-5, 14), (5, 14), (-7, 25), (-26, 22), (26, 22), (-26, -22),
        (26, -22), (-16.2, -29.6), (-0.2, -29.6), (16.2, -29.6),
        (-25.5, -24), (25.5, -24)
    ]
    leaf_mats = [materials["leaf1"], materials["leaf2"], materials["leaf3"]]
    for idx, (x, z) in enumerate(tree_spots):
        mature_tree(f"Tree_{idx:02d}", x, z, 4.6 + (idx % 5) * 0.26, materials["trunk"], leaf_mats, town_root, idx)

    # Seating faces the fountain using the same heading math as the live town.
    for idx, (x, z) in enumerate(((-4, 4), (4, -4), (-7, -4), (7, 4))):
        rotation = math.atan2(x, z)
        bench(f"Bench_{idx}", x, z, rotation, materials["wood"], materials["steel"], town_root)
    for idx, (x, z) in enumerate(((-11, -22.2), (11, -22.2), (-18, 20), (18, 20))):
        bench(f"DistrictBench_{idx}", x, z, 0 if idx < 2 else math.pi, materials["wood"], materials["steel"], town_root)

    for idx, (x, z) in enumerate(((-4.2, -4.2), (4.2, -4.2), (-4.2, 4.2), (4.2, 4.2), (-15, -21.6), (15, -21.6))):
        streetlight(f"Streetlight_{idx}", x, z, materials["steel"], materials["glass_warm"], town_root)
    for idx, (x, z) in enumerate(((-5.2, 0), (5.2, 0), (0, -5.2), (0, 5.2), (-13, -22), (13, -22))):
        planter(f"Planter_{idx}", x, z, materials["concrete_dark"], leaf_mats[idx % 3], town_root)
    for idx, (x, z) in enumerate(((-5.8, -5.6), (5.8, 5.6), (-18.4, -8.2), (18.4, 8.2))):
        trash_bin(f"Trash_{idx}", x, z, materials["steel"], town_root)

    fountain(town_root, materials["limestone"], materials["concrete_dark"], materials["water"], materials["bronze"])
    bandstand(town_root, materials["wood"], materials["steel"], materials["roof"], materials["limestone"], materials["letters"])
    cafe_cluster(town_root, materials["wood"], materials["steel"], materials["canvas"])

    # Reusable resident mesh. It stays outside TownArt so Three.js can detach and clone it.
    avatar_root = bpy.data.objects.new("AvatarTemplate", None)
    bpy.context.collection.objects.link(avatar_root)
    avatar_mats = {
        "skin": mat("AvatarSkin", (0.58, 0.36, 0.22, 1), 0.72),
        "shirt": mat("AvatarShirt", (0.11, 0.28, 0.44, 1), 0.68),
        "pants": mat("AvatarPants", (0.08, 0.1, 0.14, 1), 0.77),
        "hair": mat("AvatarHair", (0.025, 0.018, 0.014, 1), 0.9),
        "shoe": mat("AvatarShoe", (0.018, 0.02, 0.022, 1), 0.58),
        "belt": mat("AvatarBelt", (0.035, 0.026, 0.02, 1), 0.58),
        "eye": mat("AvatarEye", (0.01, 0.014, 0.016, 1), 0.42),
        "mouth": mat("AvatarMouth", (0.22, 0.045, 0.035, 1), 0.62),
    }
    create_avatar(avatar_root, avatar_mats)

    merge_town_by_material(town_root)

    # Preview-only grass and lighting are intentionally not parented to the export roots.
    preview_root = bpy.data.objects.new("PreviewOnly", None)
    bpy.context.collection.objects.link(preview_root)
    box("PreviewGround", (0, 0, -0.055), (86, 86, 0.1), mat("PreviewGrass", (0.075, 0.14, 0.07, 1), 0.96), preview_root, 0)
    avatar_root.hide_render = True
    avatar_root.hide_viewport = True

    # Natural late-afternoon preview: warm key, cool fill, long readable shadows.
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        pass
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.18, 0.28, 0.39, 1)
        bg.inputs["Strength"].default_value = 0.42
    bpy.ops.object.light_add(type="SUN", location=(18, -22, 35))
    sun = bpy.context.object
    sun.name = "PreviewSun"
    sun.data.energy = 3.2
    sun.data.color = (1.0, 0.72, 0.49)
    sun.rotation_euler = (math.radians(28), math.radians(-18), math.radians(-34))
    bpy.ops.object.light_add(type="AREA", location=(-24, 12, 24))
    fill = bpy.context.object
    fill.name = "PreviewFill"
    fill.data.energy = 1800
    fill.data.shape = "DISK"
    fill.data.size = 22
    fill.data.color = (0.42, 0.62, 1.0)
    set_camera(fill, (0, 0, 1.2))
    bpy.ops.object.camera_add(location=(43, -52, 37))
    camera = bpy.context.object
    camera.name = "PreviewCamera"
    camera.data.lens = 52
    set_camera(camera, (0, 0, 1.4))
    scene.camera = camera

    # Save the editable source before export.
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    # Export TownArt plus the hidden avatar template, excluding preview objects/lights/camera.
    avatar_root.hide_viewport = False
    avatar_root.hide_render = False
    bpy.ops.object.select_all(action="DESELECT")
    town_root.select_set(True)
    avatar_root.select_set(True)
    for obj in bpy.data.objects:
        if is_descendant(obj, town_root) or is_descendant(obj, avatar_root):
            obj.select_set(True)
    bpy.context.view_layer.objects.active = town_root
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )

    avatar_root.hide_render = True
    avatar_root.hide_viewport = True
    bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    print(f"BLEND={BLEND_PATH}")
    print(f"GLB={GLB_PATH}")
    print(f"PREVIEW={PREVIEW_PATH}")


if __name__ == "__main__":
    build_scene()
