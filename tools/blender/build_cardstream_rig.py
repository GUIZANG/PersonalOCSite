"""Build the Cardstream four-screen industrial carousel.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python tools/blender/build_cardstream_rig.py

Outputs a source .blend, a web-ready .glb, and a preview render.
"""

from __future__ import annotations

import math
import os

import bpy
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
OUT_DIR = os.path.join(ROOT, "public/assets/models/cardstream")
BLEND_PATH = os.path.join(OUT_DIR, "cardstreamCarousel.blend")
GLB_PATH = os.path.join(OUT_DIR, "cardstreamCarousel.glb")
PREVIEW_PATH = os.path.join(OUT_DIR, "cardstreamCarouselPreview.png")


def material(name, color, metallic=0.0, roughness=0.45, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color[:3], color[3])
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if emission:
        principled.inputs["Emission Color"].default_value = emission
        principled.inputs["Emission Strength"].default_value = strength
    return mat


def smooth_bevel(obj, amount=0.05, segments=2):
    bevel = obj.modifiers.new("Edge softening", "BEVEL")
    bevel.width = amount
    bevel.segments = segments
    bevel.limit_method = "ANGLE"


def box(name, location, dimensions, mat, bevel=0.04, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        smooth_bevel(obj, bevel, 2)
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def rounded_panel(name, location, width, height, depth, radius, mat, parent=None, segments=7):
    """Thin rounded rectangular prism whose corner radius is independent of depth."""
    outline = []
    half_width = width * 0.5
    half_height = height * 0.5
    radius = min(radius, half_width, half_height)
    for center_x, center_z, start_angle in (
        (half_width - radius, half_height - radius, 0),
        (-half_width + radius, half_height - radius, 90),
        (-half_width + radius, -half_height + radius, 180),
        (half_width - radius, -half_height + radius, 270),
    ):
        for step in range(segments + 1):
            angle = math.radians(start_angle + step * 90 / segments)
            outline.append((center_x + math.cos(angle) * radius, center_z + math.sin(angle) * radius))

    front_y = depth * 0.5
    back_y = -depth * 0.5
    vertices = [(x, front_y, z) for x, z in outline] + [(x, back_y, z) for x, z in outline]
    count = len(outline)
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))

    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    smooth_bevel(obj, min(depth * 0.16, 0.032), 3)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)
    if parent:
        obj.parent = parent
    return obj


def cylinder(name, location, radius, depth, mat, vertices=32, rotation=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    smooth_bevel(obj, min(radius * 0.12, 0.045), 2)
    if parent:
        obj.parent = parent
    return obj


def beam_between(name, start, end, width, depth, mat, parent=None, bevel=0.035):
    a, b = Vector(start), Vector(end)
    direction = b - a
    obj = box(name, (a + b) / 2, (width, depth, direction.length), mat, bevel, parent)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    return obj


def cable(name, points, radius, mat, parent=None):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def radial(angle, distance, z=0.0, tangent=0.0):
    return (
        math.cos(angle) * distance - math.sin(angle) * tangent,
        math.sin(angle) * distance + math.cos(angle) * tangent,
        z,
    )


def catenary_points(start, end, sag, side_sway=0.0, steps=9):
    """Approximate a gravity-loaded cable with a stable hanging curve."""
    a, b = Vector(start), Vector(end)
    horizontal = Vector((b.x - a.x, b.y - a.y, 0.0))
    if horizontal.length > 0.0001:
        sideways = Vector((-horizontal.y, horizontal.x, 0.0)).normalized()
    else:
        sideways = Vector((1.0, 0.0, 0.0))
    points = []
    for step in range(steps):
        t = step / (steps - 1)
        point = a.lerp(b, t)
        point.z -= sag * 4.0 * t * (1.0 - t)
        point += sideways * side_sway * math.sin(math.pi * t)
        points.append(tuple(point))
    return points


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def build_screen(index, angle, orbit):
    screen = bpy.data.objects.new(f"SCREEN_{index:02d}_ROOT", None)
    bpy.context.collection.objects.link(screen)
    screen.parent = orbit
    screen.location = radial(angle, 4.35, 2.55)
    # The lower edge leans toward the central mast, matching the suspended,
    # slightly top-heavy stance of the reference terminals.
    screen.rotation_euler = (math.radians(-7.0), 0, angle - math.pi / 2)

    # A near-square terminal: thick outer shell, inset luminous display and rear service plates.
    shell = rounded_panel(
        f"SCREEN_{index:02d}_CHASSIS",
        (0, 0, 0),
        4.15,
        3.05,
        0.12,
        0.26,
        MAT_SCREEN_FRAME,
        screen,
    )
    shell.location = (0, 0, 0)

    bezel = rounded_panel(
        f"SCREEN_{index:02d}_BEZEL",
        (0, 0.08, 0),
        4.02,
        2.92,
        0.035,
        0.22,
        MAT_BLACK,
        screen,
    )
    bezel.location = (0, 0.08, 0)
    glass = rounded_panel(
        f"SCREEN_{index:02d}_DISPLAY",
        (0, 0.11, 0),
        3.9,
        2.8,
        0.015,
        0.18,
        SCREEN_MATS[index - 1],
        screen,
    )
    glass.location = (0, 0.11, 0)

    # Layered front assembly: steel retention rails, rubber gasket, control
    # deck and corner protectors keep the terminal from reading as one box.
    for suffix, location, dimensions in (
        ("TOP", (0, 0.135, 1.47), (3.82, 0.025, 0.035)),
        ("BOTTOM", (0, 0.135, -1.47), (3.82, 0.025, 0.035)),
        ("LEFT", (-2.0, 0.135, 0), (0.035, 0.025, 2.78)),
        ("RIGHT", (2.0, 0.135, 0), (0.035, 0.025, 2.78)),
    ):
        rail = box(
            f"SCREEN_{index:02d}_RETENTION_{suffix}",
            location,
            dimensions,
            MAT_DARK_METAL,
            0.015,
            screen,
        )
        rail.location = location

    control_deck = box(
        f"SCREEN_{index:02d}_CONTROL_DECK",
        (0, 0.145, -1.49),
        (2.42, 0.05, 0.1),
        MAT_BLACK,
        0.025,
        screen,
    )
    control_deck.location = (0, 0.145, -1.49)
    for button_index, x in enumerate((0.72, 0.96, 1.2)):
        button = cylinder(
            f"SCREEN_{index:02d}_CONTROL_{button_index + 1:02d}",
            (x, 0.19, -1.49),
            0.035 if button_index < 2 else 0.05,
            0.035,
            MAT_RED if button_index == 2 else MAT_STEEL,
            16,
            (math.pi / 2, 0, 0),
            screen,
        )
        button.location = (x, 0.19, -1.49)

    for x in (-1.98, 1.98):
        for z in (-1.43, 1.43):
            guard = box(
                f"SCREEN_{index:02d}_CORNER_GUARD_{x:+.0f}_{z:+.0f}",
                (x, 0.14, z),
                (0.18, 0.05, 0.15),
                MAT_DARK_METAL,
                0.035,
                screen,
            )
            guard.location = (x, 0.14, z)

    # Raised rear plates and mounting spine are prominent in the source shots.
    for x in (-1.1, 1.1):
        plate = box(
            f"SCREEN_{index:02d}_REAR_PLATE_{'L' if x < 0 else 'R'}",
            (x, -0.09, 0),
            (1.66, 0.04, 2.38),
            MAT_PANEL,
            0.035,
            screen,
        )
        plate.location = (x, -0.09, 0)

    spine = box(
        f"SCREEN_{index:02d}_MOUNT_SPINE",
        (0, -0.15, 0.15),
        (0.36, 0.07, 2.15),
        MAT_BLACK,
        0.05,
        screen,
    )
    spine.location = (0, -0.15, 0.15)

    junction = box(
        f"SCREEN_{index:02d}_JUNCTION_BOX",
        (0, -0.22, -0.62),
        (0.72, 0.08, 0.48),
        MAT_DARK_METAL,
        0.045,
        screen,
    )
    junction.location = (0, -0.22, -0.62)
    for port_index, x in enumerate((-0.24, 0, 0.24)):
        port = cylinder(
            f"SCREEN_{index:02d}_CABLE_PORT_{port_index + 1:02d}",
            (x, -0.28, -0.62),
            0.075,
            0.04,
            MAT_RUBBER,
            18,
            (math.pi / 2, 0, 0),
            screen,
        )
        port.location = (x, -0.28, -0.62)

    # Rear cooling ribs and lateral vents provide readable scale at oblique
    # angles without relying on a texture.
    for side_x in (-1.1, 1.1):
        for vent_index in range(7):
            z = 0.72 - vent_index * 0.19
            vent = box(
                f"SCREEN_{index:02d}_REAR_VENT_{side_x:+.0f}_{vent_index:02d}",
                (side_x, -0.335, z),
                (1.18, 0.035, 0.045),
                MAT_BLACK,
                0.008,
                screen,
            )
            vent.location = (side_x, -0.335, z)

    for side in (-1, 1):
        for vent_index in range(5):
            z = 0.56 - vent_index * 0.28
            side_vent = box(
                f"SCREEN_{index:02d}_SIDE_VENT_{side:+d}_{vent_index:02d}",
                (side * 2.14, 0.04, z),
                (0.045, 0.22, 0.14),
                MAT_BLACK,
                0.01,
                screen,
            )
            side_vent.location = (side * 2.14, 0.04, z)

    # Side brackets, hinge cylinders and fasteners.
    for side in (-1, 1):
        bracket = box(
            f"SCREEN_{index:02d}_SIDE_BRACKET_{side:+d}",
            (side * 2.12, -0.04, 0.18),
            (0.16, 0.18, 2.15),
            MAT_DARK_METAL,
            0.05,
            screen,
        )
        bracket.location = (side * 2.12, -0.04, 0.18)
        pivot = cylinder(
            f"SCREEN_{index:02d}_HINGE_{side:+d}",
            (side * 2.12, -0.14, 0.25),
            0.16,
            0.12,
            MAT_STEEL,
            24,
            (math.pi / 2, 0, 0),
            screen,
        )
        pivot.location = (side * 2.12, -0.14, 0.25)

    for x in (-1.86, 1.86):
        for z in (-1.3, 1.3):
            bolt = cylinder(
                f"SCREEN_{index:02d}_BOLT_{x:+.0f}_{z:+.0f}",
                (x, 0.275, z),
                0.055,
                0.05,
                MAT_STEEL,
                16,
                (math.pi / 2, 0, 0),
                screen,
            )
            bolt.location = (x, 0.275, z)


def build_arm(index, angle, orbit):
    tangent = -0.48 if index % 2 else 0.48
    p0 = radial(angle, 0.75, 2.9, tangent * 0.2)
    p1 = radial(angle, 2.25, 3.25, tangent)
    p2 = radial(angle, 4.0, 2.8, tangent * 0.3)
    beam_between(f"ARM_{index:02d}_INNER", p0, p1, 0.28, 0.38, MAT_DARK_METAL, orbit, 0.045)
    beam_between(f"ARM_{index:02d}_OUTER", p1, p2, 0.3, 0.4, MAT_GUNMETAL, orbit, 0.045)
    for suffix, point in (("ROOT", p0), ("ELBOW", p1), ("SCREEN", p2)):
        cylinder(
            f"ARM_{index:02d}_{suffix}_PIVOT",
            point,
            0.22,
            0.46,
            MAT_STEEL,
            24,
            (math.pi / 2, 0, angle),
            orbit,
        )


def build_cables(index, angle, orbit):
    tangent = (-0.34, 0.3, -0.17)[(index - 1) % 3]
    # Fan the loom into the rear corners instead of terminating every lead
    # behind the centre of the display.  The wider anchors expose the hanging
    # arcs around the chassis silhouette in the normal front camera.
    anchor_offsets = (-2.0, -1.28, 1.28, 2.0)
    for cable_index in range(4):
        shift = (cable_index - 1.5) * 0.15
        start = radial(angle, 0.48 + cable_index * 0.075, 5.58 - cable_index * 0.07, tangent + shift)
        end = radial(angle, 4.02, 3.34 - cable_index * 0.12, anchor_offsets[cable_index])
        sag = 1.82 + (cable_index % 2) * 0.3 + (index % 2) * 0.14
        cable_points = catenary_points(
            start,
            end,
            sag,
            side_sway=(cable_index - 1.5) * 0.12,
            steps=12,
        )
        cable(
            f"SCREEN_{index:02d}_CABLE_{cable_index + 1:02d}",
            cable_points,
            0.042 + cable_index * 0.006,
            MAT_RUBBER,
            orbit,
        )


def add_floor_grid():
    floor = box("RENDER_FLOOR", (0, 0, -0.12), (30, 30, 0.15), MAT_FLOOR, 0)
    floor.hide_render = False
    for coordinate in range(-10, 11, 2):
        for axis in (0, 1):
            if axis == 0:
                points = [(coordinate, -14.0, 0.01), (coordinate, 14.0, 0.01)]
            else:
                points = [(-14.0, coordinate, 0.01), (14.0, coordinate, 0.01)]
            cable(f"RENDER_GRID_{axis}_{coordinate:+03d}", points, 0.012, MAT_RED_DIM)
    return floor


os.makedirs(OUT_DIR, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0

MAT_BLACK = material("Chassis Black", (0.006, 0.006, 0.008, 1), 0.72, 0.24)
MAT_GUNMETAL = material("Worn Gunmetal", (0.028, 0.031, 0.036, 1), 0.82, 0.3)
MAT_SCREEN_FRAME = material("Display Frame Stained Metal", (0.025, 0.027, 0.03, 1), 0.76, 0.5)
MAT_DARK_METAL = material("Armature Metal", (0.018, 0.019, 0.022, 1), 0.9, 0.24)
MAT_PANEL = material("Rear Service Panel", (0.045, 0.042, 0.043, 1), 0.72, 0.38)
MAT_STEEL = material("Edge Steel", (0.16, 0.15, 0.15, 1), 0.78, 0.22)
MAT_RUBBER = material("Cable Rubber", (0.004, 0.004, 0.005, 1), 0.05, 0.5)
MAT_RED = material("Signal Red", (0.2, 0.002, 0.004, 1), 0.3, 0.32, (1.0, 0.004, 0.006, 1), 4.5)
MAT_RED_DIM = material("Floor Signal", (0.03, 0.001, 0.002, 1), 0.2, 0.4, (0.45, 0.001, 0.002, 1), 2.2)
MAT_SCREEN_DIM = material("Dormant Screen", (0.008, 0.009, 0.011, 1), 0.2, 0.24, (0.02, 0.006, 0.007, 1), 0.35)
MAT_FLOOR = material("Black Floor", (0.002, 0.002, 0.003, 1), 0.18, 0.3)
SCREEN_MATS = [
    material(f"SCREEN_{index:02d}_CONTENT", (0.009, 0.008, 0.009, 1), 0.15, 0.22, emission, strength)
    for index, emission, strength in (
        (1, (0.72, 0.003, 0.006, 1), 3.4),
        (2, (0.045, 0.008, 0.01, 1), 0.65),
        (3, (0.025, 0.025, 0.028, 1), 0.38),
        (4, (0.12, 0.006, 0.01, 1), 1.05),
    )
]

orbit = bpy.data.objects.new("CARDSTREAM_ORBIT_RIG", None)
bpy.context.collection.objects.link(orbit)

# Central layered mast and rotor.
cylinder("CORE_BASE", (0, 0, 0.25), 1.05, 0.5, MAT_BLACK, 48, parent=orbit)
cylinder("CORE_LOWER_ROTOR", (0, 0, 0.72), 0.78, 0.32, MAT_GUNMETAL, 48, parent=orbit)
cylinder("CORE_CABLE_COLLECTOR", (0, 0, 1.02), 0.53, 0.3, MAT_BLACK, 48, parent=orbit)
cylinder("CORE_SHAFT", (0, 0, 3.0), 0.34, 4.8, MAT_DARK_METAL, 36, parent=orbit)
cylinder("CORE_MID_ROTOR", (0, 0, 2.85), 0.9, 0.42, MAT_GUNMETAL, 48, parent=orbit)
cylinder("CORE_RED_COLLAR", (0, 0, 3.12), 0.67, 0.11, MAT_RED, 48, parent=orbit)
cylinder("CORE_UPPER_ROTOR", (0, 0, 4.65), 0.82, 0.38, MAT_GUNMETAL, 48, parent=orbit)
cylinder("CORE_CROWN", (0, 0, 5.45), 1.0, 0.26, MAT_DARK_METAL, 48, parent=orbit)

for index in range(1, 5):
    angle = math.radians((index - 1) * 90)
    build_screen(index, angle, orbit)
    build_arm(index, angle, orbit)
    build_cables(index, angle, orbit)

# Loose cable bundle to create the dense central silhouette visible in the
# reference.  Every lead now disappears into the lower collector instead of
# ending in open space, so no curve reads as a cut wire from the front view.
for cable_index in range(12):
    angle = math.radians(cable_index * 31 + 8)
    distance = 0.32 + (cable_index % 4) * 0.13
    start = radial(angle, distance, 8.15 + (cable_index % 3) * 0.18)
    end = radial(
        angle - 0.25,
        0.27 + (cable_index % 4) * 0.045,
        1.05 + (cable_index % 3) * 0.025,
    )
    hanging_points = catenary_points(
        start,
        end,
        0.42 + (cable_index % 4) * 0.12,
        side_sway=((cable_index % 3) - 1) * 0.2,
        steps=9,
    )
    cable(
        f"CORE_HANGING_CABLE_{cable_index + 1:02d}",
        hanging_points,
        0.034 + (cable_index % 3) * 0.004,
        MAT_RUBBER,
        orbit,
    )

orbit.rotation_euler = (0, 0, math.radians(-24))
orbit.keyframe_insert(data_path="rotation_euler", frame=1, index=2)
orbit.rotation_euler[2] = math.radians(336)
orbit.keyframe_insert(data_path="rotation_euler", frame=241, index=2)

floor = add_floor_grid()

# Camera and restrained red/white edge lighting.
bpy.ops.object.camera_add(location=(11.8, -16.2, 8.4))
camera = bpy.context.object
camera.name = "RENDER_CAMERA"
camera.data.lens = 51
look_at(camera, (0, 0, 2.5))
bpy.context.scene.camera = camera

def area_light(name, location, color, energy, size, target=(0, 0, 2.5)):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.color = color
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    look_at(light, target)
    return light


area_light("KEY_RED", (-7, -8, 7), (1.0, 0.006, 0.01), 1050, 6.0)
area_light("RIM_WHITE", (7, 5, 9), (1.0, 0.84, 0.78), 850, 5.0)
area_light("LOW_RED", (0, 8, 1.2), (1.0, 0.002, 0.004), 520, 4.0)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1200
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = PREVIEW_PATH
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGBA"
if scene.world is None:
    scene.world = bpy.data.worlds.new("Cardstream World")
scene.world.color = (0.001, 0.001, 0.002)
scene.world.use_nodes = True
world_background = scene.world.node_tree.nodes.get("Background")
world_background.inputs["Color"].default_value = (0.0005, 0.0005, 0.0008, 1)
world_background.inputs["Strength"].default_value = 0.035
scene.frame_start = 1
scene.frame_end = 241
scene.render.fps = 30
scene.frame_set(38)

bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

# Export only the carousel; floor, camera and lights remain render helpers in the .blend.
bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.context.scene.objects:
    if obj == floor or obj.type in {"CAMERA", "LIGHT"} or obj.name.startswith("RENDER_GRID_"):
        continue
    obj.select_set(True)
bpy.context.view_layer.objects.active = orbit
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_apply=False,
)

scene.render.filepath = PREVIEW_PATH
bpy.ops.render.render(write_still=True)
print(f"Saved {BLEND_PATH}")
print(f"Saved {GLB_PATH}")
print(f"Saved {PREVIEW_PATH}")
