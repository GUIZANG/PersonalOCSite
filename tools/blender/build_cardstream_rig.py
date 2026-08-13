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
from mathutils import Euler, Vector


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


def channel_beam_between(
    name,
    start,
    end,
    width,
    depth,
    mat,
    recess_mat,
    parent=None,
    groove_width=0.12,
    groove_depth=0.075,
    end_taper=0.88,
):
    """Tapered structural beam with a real concave longitudinal channel."""
    a, b = Vector(start), Vector(end)
    direction = b - a
    length = direction.length
    groove_width = min(groove_width, width * 0.68)
    groove_depth = min(groove_depth, depth * 0.52)

    def profile(profile_width, z):
        half_width = profile_width * 0.5
        half_depth = depth * 0.5
        half_groove = groove_width * 0.5
        return [
            (-half_width, -half_depth, z),
            (half_width, -half_depth, z),
            (half_width, half_depth, z),
            (half_groove, half_depth, z),
            (half_groove, half_depth - groove_depth, z),
            (-half_groove, half_depth - groove_depth, z),
            (-half_groove, half_depth, z),
            (-half_width, half_depth, z),
        ]

    vertices = profile(width, -length * 0.5) + profile(width * end_taper, length * 0.5)
    faces = [tuple(reversed(range(8))), tuple(range(8, 16))]
    for index in range(8):
        next_index = (index + 1) % 8
        faces.append((index, next_index, 8 + next_index, 8 + index))

    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (a + b) * 0.5
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.data.materials.append(recess_mat)
    # The three inner faces of the U-channel stay darker than the worn edges.
    for polygon_index in (5, 6, 7):
        obj.data.polygons[polygon_index].material_index = 1
    smooth_bevel(obj, 0.018, 2)
    if parent:
        obj.parent = parent
    return obj


def cast_yoke_brace(name, outer_anchor, inner_anchor, joint, mat, recess_mat, parent=None):
    """One-piece forked yoke with a triangular lightening aperture."""
    parts = [
        channel_beam_between(
            f"{name}_CAST_OUTER",
            outer_anchor,
            joint,
            0.17,
            0.105,
            mat,
            recess_mat,
            None,
            0.068,
            0.035,
            0.7,
        ),
        channel_beam_between(
            f"{name}_CAST_INNER",
            inner_anchor,
            joint,
            0.135,
            0.105,
            mat,
            recess_mat,
            None,
            0.052,
            0.035,
            0.72,
        ),
        channel_beam_between(
            f"{name}_CAST_HEEL",
            outer_anchor,
            inner_anchor,
            0.12,
            0.1,
            mat,
            recess_mat,
            None,
            0.045,
            0.026,
            0.84,
        ),
    ]

    # Apply the soft edge modifiers before welding the three branches into a
    # single selectable component. The enclosed void remains actual geometry.
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        bpy.context.view_layer.objects.active = part
        for modifier in list(part.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    yoke = bpy.context.object
    yoke.name = name
    yoke.data.name = f"{name}_CAST_MESH"
    if parent:
        yoke.parent = parent
        yoke.matrix_parent_inverse = parent.matrix_world.inverted()
    return yoke


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


def add_cable_sway_shapes(obj, path_points, sway_direction, amount=0.28):
    """Add endpoint-pinned morph targets for web-driven cable inertia."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)

    points = [Vector(point) for point in path_points]
    segment_lengths = [
        (points[index + 1] - points[index]).length
        for index in range(len(points) - 1)
    ]
    cumulative = [0.0]
    for length in segment_lengths:
        cumulative.append(cumulative[-1] + length)
    total_length = max(cumulative[-1], 0.0001)

    basis = obj.shape_key_add(name="Basis")
    positive = obj.shape_key_add(name="CableSwayPositive")
    negative = obj.shape_key_add(name="CableSwayNegative")
    settle = obj.shape_key_add(name="CableSettle")
    direction = Vector(sway_direction).normalized()

    for vertex_index, vertex in enumerate(obj.data.vertices):
        coordinate = vertex.co.copy()
        closest_distance = float("inf")
        path_position = 0.0
        for segment_index, segment_length in enumerate(segment_lengths):
            if segment_length <= 0.0001:
                continue
            start = points[segment_index]
            segment = points[segment_index + 1] - start
            segment_t = max(
                0.0,
                min(1.0, (coordinate - start).dot(segment) / (segment_length * segment_length)),
            )
            nearest = start + segment * segment_t
            distance = (coordinate - nearest).length_squared
            if distance < closest_distance:
                closest_distance = distance
                path_position = (cumulative[segment_index] + segment_length * segment_t) / total_length

        # Both ends remain exactly fixed; only the hanging middle can lag.
        envelope = math.sin(math.pi * path_position) ** 1.45
        positive.data[vertex_index].co = coordinate + direction * amount * envelope
        negative.data[vertex_index].co = coordinate - direction * amount * envelope
        settle.data[vertex_index].co = coordinate + Vector((0, 0, -0.16 * envelope))

    basis.value = 0
    positive.value = 0
    negative.value = 0
    settle.value = 0


def radial(angle, distance, z=0.0, tangent=0.0):
    return (
        math.cos(angle) * distance - math.sin(angle) * tangent,
        math.sin(angle) * distance + math.cos(angle) * tangent,
        z,
    )


def screen_local_to_world(angle, coordinate):
    """Transform a screen-local attachment point into carousel coordinates."""
    origin = Vector(radial(angle, 4.5, 2.62))
    rotation = Euler((math.radians(-6.0), 0, angle - math.pi / 2), "XYZ")
    return tuple(origin + rotation.to_matrix() @ Vector(coordinate))


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
    screen.location = radial(angle, 4.5, 2.62)
    # The reference terminals are shallow suspended slabs. Their slight inward
    # pitch keeps the centre of mass close to the carousel instead of making
    # the panels read as unsupported billboards.
    screen.rotation_euler = (math.radians(-6.0), 0, angle - math.pi / 2)

    # Build at the final web size. Runtime scaling used to enlarge only the
    # screen roots, leaving the external arms and cable endpoints behind.
    rounded_panel(
        f"SCREEN_{index:02d}_CHASSIS",
        (0, 0, 0),
        4.72,
        3.44,
        0.08,
        0.14,
        MAT_SCREEN_FRAME,
        screen,
    )
    rounded_panel(
        f"SCREEN_{index:02d}_BEZEL",
        (0, 0.052, 0),
        4.6,
        3.32,
        0.025,
        0.11,
        MAT_BLACK,
        screen,
    )
    rounded_panel(
        f"SCREEN_{index:02d}_DISPLAY",
        (0, 0.072, 0),
        4.43,
        3.15,
        0.012,
        0.075,
        SCREEN_MATS[index - 1],
        screen,
    )

    # The visible face stays deliberately sparse: two retention lips and four
    # recessed fasteners, like the thin framed displays on the reference rig.
    for suffix, z in (("TOP", 1.675), ("BOTTOM", -1.675)):
        box(
            f"SCREEN_{index:02d}_RETENTION_{suffix}",
            (0, 0.083, z),
            (4.58, 0.026, 0.045),
            MAT_STEEL,
            0.012,
            screen,
        )
    for x in (-2.24, 2.24):
        for z in (-1.55, 1.55):
            cylinder(
                f"SCREEN_{index:02d}_BOLT_{x:+.0f}_{z:+.0f}",
                (x, 0.105, z),
                0.038,
                0.028,
                MAT_DARK_METAL,
                14,
                (math.pi / 2, 0, 0),
                screen,
            )

    # One continuous rear shell replaces the previous stack of service plates,
    # vents, corner guards and control deck. A compact yoke carries every load
    # into the centre arm, so the connection remains believable while rotating.
    rounded_panel(
        f"SCREEN_{index:02d}_REAR_SHELL",
        (0, -0.065, 0),
        4.36,
        3.06,
        0.045,
        0.11,
        MAT_PANEL,
        screen,
    )
    box(
        f"SCREEN_{index:02d}_MOUNT_SPINE",
        (0, -0.13, 0.08),
        (0.34, 0.11, 1.72),
        MAT_DARK_METAL,
        0.04,
        screen,
    )
    box(
        f"SCREEN_{index:02d}_YOKE_CROSSBAR",
        (0, -0.14, 0.12),
        (2.34, 0.12, 0.2),
        MAT_GUNMETAL,
        0.045,
        screen,
    )
    # Eight single-piece cast wishbones (two per display) replace the generic
    # diagonal bars. Each remains one selectable component, but its forked
    # silhouette contains a genuine triangular lightening aperture.
    for side in (-1, 1):
        yoke_joint = (side * 0.72, -0.19, 0.12)
        outer_anchor = (side * 1.82, -0.145, -1.12)
        inner_anchor = (side * 1.34, -0.155, -1.28)
        cast_yoke_brace(
            f"SCREEN_{index:02d}_YOKE_BRACE_{side:+d}",
            outer_anchor,
            inner_anchor,
            yoke_joint,
            MAT_DARK_METAL,
            MAT_BLACK,
            screen,
        )

        cylinder(
            f"SCREEN_{index:02d}_YOKE_JOINT_{side:+d}",
            yoke_joint,
            0.15,
            0.115,
            MAT_STEEL,
            28,
            (math.pi / 2, 0, 0),
            screen,
        )

    # Cable glands live on the upper-middle rear shell rather than on the top
    # edge. This creates a longer visible drop before each lead reaches the set.
    for port_index, x in enumerate((-1.45, 0, 1.45)):
        cylinder(
            f"SCREEN_{index:02d}_CABLE_GLAND_{port_index + 1:02d}",
            (x, -0.16, 0.78),
            0.085,
            0.12,
            MAT_RUBBER,
            18,
            (math.pi / 2, 0, 0),
            screen,
        )


def build_arm(index, angle, orbit):
    tangent = -0.34 if index % 2 else 0.34
    p0 = radial(angle, 0.78, 3.02, tangent * 0.18)
    p1 = radial(angle, 2.48, 3.24, tangent)
    p2 = radial(angle, 4.34, 2.74, 0.0)
    channel_beam_between(
        f"ARM_{index:02d}_INNER_CHANNEL",
        p0,
        p1,
        0.34,
        0.3,
        MAT_DARK_METAL,
        MAT_BLACK,
        orbit,
        0.16,
        0.095,
        0.82,
    )
    channel_beam_between(
        f"ARM_{index:02d}_OUTER_CHANNEL",
        p1,
        p2,
        0.38,
        0.32,
        MAT_GUNMETAL,
        MAT_BLACK,
        orbit,
        0.18,
        0.1,
        0.76,
    )

    # A slimmer return link turns the arm into a readable four-bar mechanism.
    return_p0 = radial(angle, 0.86, 2.57, -tangent * 0.12)
    return_p1 = radial(angle, 2.62, 2.72, tangent * 0.76)
    return_p2 = radial(angle, 4.28, 2.42, 0.0)
    channel_beam_between(
        f"ARM_{index:02d}_RETURN_INNER",
        return_p0,
        return_p1,
        0.2,
        0.2,
        MAT_GUNMETAL,
        MAT_BLACK,
        orbit,
        0.085,
        0.055,
        0.86,
    )
    channel_beam_between(
        f"ARM_{index:02d}_RETURN_OUTER",
        return_p1,
        return_p2,
        0.22,
        0.21,
        MAT_DARK_METAL,
        MAT_BLACK,
        orbit,
        0.09,
        0.06,
        0.8,
    )
    for suffix, point in (("ROOT", p0), ("ELBOW", p1), ("SCREEN", p2)):
        cylinder(
            f"ARM_{index:02d}_{suffix}_PIVOT",
            point,
            0.17,
            0.32,
            MAT_STEEL,
            24,
            (math.pi / 2, 0, angle),
            orbit,
        )
    for suffix, point in (("ROOT", return_p0), ("ELBOW", return_p1), ("SCREEN", return_p2)):
        cylinder(
            f"ARM_{index:02d}_RETURN_{suffix}_PIVOT",
            point,
            0.13,
            0.25,
            MAT_DARK_METAL,
            22,
            (math.pi / 2, 0, angle),
            orbit,
        )


def build_cables(index, angle, orbit):
    tangent = (-0.22, 0.18, -0.12)[(index - 1) % 3]
    anchor_offsets = (-1.45, 0.0, 1.45)
    for cable_index, anchor_offset in enumerate(anchor_offsets):
        shift = (cable_index - 1) * 0.13
        # Starts are buried inside the upper collector and ends land inside the
        # three glands on the screen's top rear edge.
        start = radial(angle, 0.46 + cable_index * 0.08, 6.28, tangent + shift)
        # Use the exact transformed rear socket position. The deeper sag puts
        # the cable's lowest point near the screen midline without detaching it.
        end = screen_local_to_world(angle, (anchor_offset, -0.23, 0.78))
        sag = 2.18 + (cable_index % 2) * 0.27 + (index % 2) * 0.14
        cable_points = catenary_points(
            start,
            end,
            sag,
            side_sway=(cable_index - 1) * 0.11,
            steps=12,
        )
        cable_object = cable(
            f"SCREEN_{index:02d}_CABLE_{cable_index + 1:02d}",
            cable_points,
            0.032 + cable_index * 0.004,
            MAT_RUBBER,
            orbit,
        )
        add_cable_sway_shapes(
            cable_object,
            cable_points,
            (-math.sin(angle), math.cos(angle), 0),
            0.3 + cable_index * 0.025,
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

# The lower stack contracts toward a small floor bearing. This gives the heavy
# suspended carousel a readable load path without turning the base into a wide
# pedestal: top collector -> middle collar -> narrow spindle -> anchored shoe.
cylinder("CORE_FLOOR_BEARING", (0, 0, 0.08), 0.58, 0.16, MAT_DARK_METAL, 48, parent=orbit)
cylinder("CORE_BASE", (0, 0, 0.31), 0.5, 0.38, MAT_BLACK, 48, parent=orbit)
cylinder("CORE_LOWER_ROTOR", (0, 0, 0.68), 0.76, 0.38, MAT_GUNMETAL, 48, parent=orbit)
cylinder("CORE_CABLE_COLLECTOR", (0, 0, 1.03), 1.04, 0.32, MAT_BLACK, 48, parent=orbit)
cylinder("CORE_SHAFT", (0, 0, 3.18), 0.32, 4.3, MAT_DARK_METAL, 36, parent=orbit)
cylinder("CORE_MID_ROTOR", (0, 0, 2.85), 0.9, 0.42, MAT_GUNMETAL, 48, parent=orbit)
cylinder("CORE_RED_COLLAR", (0, 0, 3.12), 0.67, 0.11, MAT_RED, 48, parent=orbit)
cylinder("CORE_UPPER_ROTOR", (0, 0, 5.72), 0.74, 0.34, MAT_GUNMETAL, 48, parent=orbit)
cylinder("CORE_CROWN", (0, 0, 6.32), 0.94, 0.3, MAT_DARK_METAL, 48, parent=orbit)

for index in range(1, 5):
    angle = math.radians((index - 1) * 90)
    build_screen(index, angle, orbit)
    build_arm(index, angle, orbit)
    build_cables(index, angle, orbit)

# A restrained internal loom keeps the centre visually dense like the source,
# but every endpoint is buried in a collector so the rig never exposes a cut
# cable while rotating.
for cable_index in range(8):
    angle = math.radians(cable_index * 31 + 8)
    distance = 0.32 + (cable_index % 4) * 0.13
    start = radial(angle, distance, 6.3 + (cable_index % 3) * 0.025)
    end = radial(
        angle - 0.25,
        0.27 + (cable_index % 4) * 0.045,
        1.05 + (cable_index % 3) * 0.025,
    )
    hanging_points = catenary_points(
        start,
        end,
        0.28 + (cable_index % 4) * 0.08,
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

# Export only the carousel; camera and lights remain render helpers in the .blend.
bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.context.scene.objects:
    if obj.type in {"CAMERA", "LIGHT"}:
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
