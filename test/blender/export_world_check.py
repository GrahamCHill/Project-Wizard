"""Builds a scene with Blender's Python API (bpy), runs the templates' export_world.py on it, and checks what came out.

Run by test/misc-templates.test.js when PROJECT_WIZARD_BPY points to a Python with bpy installed (pip install bpy). It reads
EXPORTER (the path of export_world.py) and OUT (a folder to write into) from the environment."""
import json
import math
import os
import runpy
import sys

import bpy

EXPORTER = os.environ["EXPORTER"]
OUT = os.environ["OUT"]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def cube(name, location, scale=(1, 1, 1), rotation_z=0.0, collider=True, color=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler[2] = rotation_z
    if collider:
        obj["collider"] = "box"
    if color:
        material = bpy.data.materials.new(name + "_material")
        material.use_nodes = True
        material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = color
        obj.data.materials.append(material)
    return obj


def empty(name, location, rotation_z=0.0):
    obj = bpy.data.objects.new(name, None)
    obj.location = location
    obj.rotation_euler[2] = rotation_z
    bpy.context.scene.collection.objects.link(obj)
    return obj


def light(name, kind, location, energy):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    return obj


def run_exporter(path):
    sys.argv = ["blender", "--", path]
    try:
        runpy.run_path(EXPORTER, run_name="__main__")
        return 0
    except SystemExit as stop:
        return stop.code or 0


def build_room():
    reset()
    cube("Floor", (0, 0, -0.1), (12, 12, 0.2), color=(0.36, 0.4, 0.3, 1))
    cube("Crate", (3, 2, 0.5), color=(0.8, 0.35, 0.1, 1))
    cube("Crate_Turned", (-3, 2, 0.6), (1.2, 1.2, 1.2), rotation_z=math.radians(45), color=(0.8, 0.35, 0.1, 1))
    cube("Decoration", (0, 3, 2), (0.2, 0.2, 0.2), collider=False)
    empty("spawn_player", (0, -4.5, 0), rotation_z=math.radians(90))
    light("Lamp", "POINT", (0, 0, 2.8), 1000)
    light("Dim", "POINT", (2, 0, 1), 100)


failures = []


def check(condition, message):
    print(("ok   " if condition else "FAIL ") + message)
    if not condition:
        failures.append(message)


print("Blender", bpy.app.version_string)

# --- A good scene ---------------------------------------------------------------------------------------------------
build_room()
status = run_exporter(f"{OUT}/room.gltf")
check(status == 0, "a good scene exports")
document = json.load(open(f"{OUT}/room.gltf"))
nodes = {node["name"]: node for node in document["nodes"]}
check(nodes["Floor"]["extras"].get("collider") == "box", "custom property collider reaches node extras")
check("extras" not in nodes["Decoration"] or "collider" not in nodes["Decoration"]["extras"], "objects without the property have no collider")
check(document["asset"]["version"] == "2.0" and "data:" in document["buffers"][0]["uri"], "the file is a single embedded .gltf")
lights = document["extensions"]["KHR_lights_punctual"]["lights"]
intensities = sorted(l["intensity"] for l in lights)
print("   exported light intensities (candela) for 1000 W and 100 W lamps:", [round(i, 2) for i in intensities])
# The templates' shading assumes every watt of a Blender point lamp exports as 54.35 candela, so a 100 W lamp is 5435.
check(abs(intensities[0] - 5435) < 20 and abs(intensities[1] - 54351) < 200, "a Blender point lamp exports 54.35 candela per watt")
check(all(l["type"] == "point" for l in lights), "lamps are exported as point lights")
spawn = nodes["spawn_player"]
print("   spawn node:", spawn.get("translation"), spawn.get("rotation"))
check(abs(spawn["translation"][2] - 4.5) < 1e-4 and abs(spawn["translation"][1]) < 1e-4, "Blender (0,-4.5,0) becomes glTF (0,0,4.5)")
q = spawn["rotation"]  # x, y, z, w
yaw = 2 * math.atan2(q[1], q[3])
check(abs(yaw - math.pi / 2) < 1e-4, f"a 90 degree turn around Blender Z is a yaw of +pi/2 (got {yaw:.4f})")
turned = nodes["Crate_Turned"]
check("mesh" in turned, "meshes are exported")

# --- Scenes the exporter must refuse or warn about -----------------------------------------------------------------------
reset()
cube("Floor", (0, 0, -0.1), (12, 12, 0.2))
check(run_exporter(f"{OUT}/nospawn.gltf") == 1 and not os.path.exists(f"{OUT}/nospawn.gltf"), "no spawn_player: export refused, nothing written")

reset()
empty("spawn_player", (0, 0, 0))
bpy.ops.object.empty_add(type="PLAIN_AXES")
marker = bpy.context.active_object
marker["collider"] = "box"
check(run_exporter(f"{OUT}/emptycollider.gltf") == 1, "a collider on something that is not a mesh: export refused")

reset()
empty("spawn_player", (0, 0, 0))
cube("Floor", (0, 0, -0.1), (12, 12, 0.2))
bpy.data.objects["Floor"]["collider"] = "sphere"
light("Sun", "SUN", (0, 0, 5), 3)
light("Spot", "SPOT", (0, 0, 3), 500)
from importlib import util
spec = util.spec_from_file_location("export_world", EXPORTER)
module = util.module_from_spec(spec)
spec.loader.exec_module(module)
problems, notes = module.check_scene(bpy.context.scene)
print("   warnings:", *notes, sep="\n     ")
check(problems == [], "unknown collider types and unsupported lights are warnings, not errors")
check(any("sphere" in n for n in notes) and any("sun" in n for n in notes) and any("spot" in n for n in notes), "each problem is named")
check(any("collider" in n and "fall" in n for n in notes), "a scene with no usable collider warns that the player will fall")

# --- Output path handling ---------------------------------------------------------------------------------------------
build_room()
sys.argv = ["blender", "--", f"{OUT}/deep/folder/world.gltf"]
status = run_exporter(f"{OUT}/deep/folder/world.gltf")
check(status == 0 and os.path.exists(f"{OUT}/deep/folder/world.gltf"), "missing output folders are created")

print()
print(f"{len(failures)} failed")
sys.exit(1 if failures else 0)
