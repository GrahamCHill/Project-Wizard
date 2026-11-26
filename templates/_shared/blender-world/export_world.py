"""Exports the open Blender scene as a glTF world for this project.

Run it from the command line, without opening Blender's window:

    blender --background my_scene.blend --python tools/export_world.py -- assets/world.gltf

Or open it in Blender's Scripting tab and run it there, which writes assets/world.gltf next to the .blend file.

It checks the scene first and prints what the game cannot use. A missing spawn point or a collider on something that is not a
mesh stops the export, because the game could not start or the box would be wrong. Everything else is a warning.
"""

import base64
import json
import os
import sys

import bpy

DEFAULT_OUTPUT = "assets/world.gltf"
SPAWN_NAME = "spawn_player"


def output_path():
    """The path after '--' on the command line, or assets/world.gltf beside the .blend file."""
    argv = sys.argv
    if "--" in argv and argv.index("--") + 1 < len(argv):
        return os.path.abspath(argv[argv.index("--") + 1])
    base = os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.getcwd()
    return os.path.join(base, DEFAULT_OUTPUT)


def check_scene(scene):
    """Returns (errors, warnings) as lists of messages."""
    errors, warnings = [], []
    objects = [obj for obj in scene.objects if not obj.hide_viewport and not obj.hide_get()]
    names = {obj.name for obj in objects}

    if SPAWN_NAME not in names:
        errors.append(
            f"There is no object named '{SPAWN_NAME}'. Add an Empty with that exact name where the player should start."
        )
    elif next(obj for obj in objects if obj.name == SPAWN_NAME).type != "EMPTY":
        warnings.append(f"'{SPAWN_NAME}' is not an Empty. It works, but an Empty is the usual choice.")

    colliders = 0
    for obj in objects:
        value = obj.get("collider")
        if value is None:
            continue
        if value != "box":
            warnings.append(f"'{obj.name}' has collider = {value!r}. Only the text 'box' is understood, so it is ignored.")
        elif obj.type != "MESH":
            errors.append(f"'{obj.name}' has a collider but its type is {obj.type.lower()}, not mesh, so it has no shape to wrap a box around.")
        else:
            colliders += 1
    if colliders == 0:
        warnings.append("No object has the custom property collider = 'box', so the player will fall through everything.")

    lights = [obj for obj in objects if obj.type == "LIGHT"]
    if not lights:
        warnings.append("The scene has no lights, so the game shows only its flat ambient light.")
    for obj in lights:
        if obj.data.type == "SUN":
            warnings.append(f"'{obj.name}' is a sun light. The game uses point lights only, so it is ignored.")
        elif obj.data.type in {"SPOT", "AREA"}:
            warnings.append(f"'{obj.name}' is a {obj.data.type.lower()} light. The game treats it as a point light.")
    if len(lights) > 8:
        warnings.append(f"The scene has {len(lights)} lights. The Raylib example uses the first 8.")

    for obj in objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            material = slot.material
            tree = getattr(material, "node_tree", None)  # newer Blender versions always have a node tree, older ones may not
            if tree and any(node.type == "TEX_IMAGE" for node in tree.nodes):
                warnings.append(f"The material '{material.name}' uses an image texture. Textures are not supported, so only its Base Color value is used.")
        if obj.animation_data and obj.animation_data.action:
            warnings.append(f"'{obj.name}' is animated. Animation is not exported.")
    return errors, sorted(set(warnings))


def embed_buffers(path):
    """Moves the .bin files that Blender wrote beside the .gltf into the .gltf itself, as base64, and deletes them.

    Newer versions of Blender have no single-file .gltf format any more. The game reads either, but one file is easier to move
    around and to keep in version control."""
    with open(path, encoding="utf-8") as file:
        document = json.load(file)
    folder = os.path.dirname(path)
    embedded = []
    for buffer in document.get("buffers", []):
        uri = buffer.get("uri")
        if not uri or uri.startswith("data:"):
            continue
        binary_path = os.path.join(folder, uri)
        with open(binary_path, "rb") as binary:
            data = binary.read()
        buffer["uri"] = "data:application/octet-stream;base64," + base64.b64encode(data).decode("ascii")
        embedded.append(binary_path)
    if embedded:
        with open(path, "w", encoding="utf-8") as file:
            json.dump(document, file, indent=2)
            file.write("\n")
        for binary_path in embedded:
            os.remove(binary_path)


def export(path):
    exporter = bpy.ops.export_scene.gltf.get_rna_type().properties
    formats = exporter["export_format"].enum_items.keys() if "export_format" in exporter else []
    # One file with the geometry inside, if this Blender can write it. Otherwise a .gltf plus a .bin, which is embedded afterward.
    export_format = "GLTF_EMBEDDED" if "GLTF_EMBEDDED" in formats else "GLTF_SEPARATE"
    wanted = {
        "filepath": path,
        "export_format": export_format,
        "export_extras": True,               # custom properties, which is how colliders are marked
        "export_lights": True,               # KHR_lights_punctual
        "export_cameras": False,
        "export_yup": True,                  # glTF's Y-up axes, which the loader expects
        "export_apply": True,                # bake modifiers, such as Array and Mirror
        "export_normals": True,
        "export_texcoords": False,
        "export_animations": False,
        "export_skins": False,
        "export_morph": False,
        "export_image_format": "NONE",
        "use_visible": True,                 # skip hidden helper objects
        "use_selection": False,
    }
    # Settings the exporter does not have, because this Blender is older or newer, are left out instead of failing.
    settings = {key: value for key, value in wanted.items() if key in exporter}
    for key in ("export_extras", "export_lights", "export_format"):
        if key not in settings:
            raise RuntimeError(f"This version of Blender's glTF exporter has no '{key}' setting. Use Blender 3.6 or newer.")
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    result = bpy.ops.export_scene.gltf(**settings)
    if "FINISHED" in result:
        embed_buffers(path)
    return result


def main():
    scene = bpy.context.scene
    errors, warnings = check_scene(scene)
    for message in warnings:
        print(f"warning: {message}")
    for message in errors:
        print(f"error: {message}")
    if errors:
        print("Nothing was exported.")
        sys.exit(1)
    path = output_path()
    result = export(path)
    if "FINISHED" not in result:
        print("error: Blender's glTF exporter did not finish.")
        sys.exit(1)
    print(f"Exported {path}")


if __name__ == "__main__":
    main()
