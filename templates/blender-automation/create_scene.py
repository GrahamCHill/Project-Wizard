import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    bpy.ops.mesh.primitive_uv_sphere_add(location=(0, 0, 1))
    sphere = bpy.context.object
    sphere.name = "Demo sphere"
    material = bpy.data.materials.new("Blue")
    material.diffuse_color = (0.12, 0.35, 0.8, 1.0)
    sphere.data.materials.append(material)

    bpy.ops.mesh.primitive_plane_add(size=12)
    bpy.ops.object.light_add(type="AREA", location=(2, -2, 5))
    light = bpy.context.object
    light.data.energy = 650
    light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat("-Z", "Y").to_euler()

    bpy.ops.object.camera_add(location=(5, -7, 4))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, 1)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    return scene


def main():
    parser = argparse.ArgumentParser(description="Generate a Blender scene file.")
    parser.add_argument("--output", type=Path, default=Path("output/scene.blend"))
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    if args.output.suffix.lower() != ".blend":
        parser.error("--output must end in .blend")
    build_scene()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))


if __name__ == "__main__":
    main()
