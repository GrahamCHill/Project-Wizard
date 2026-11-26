# __PROJECT_NAME__

Walk around a world you made in Blender, drawn with [Raylib](https://www.raylib.com). Blender exports a glTF file, `src/world.c`
reads it, and the game does the rest: it draws every object, lights the scene with your lamps, and stops the player at walls.

## Run it

Install CMake 3.24+, a C compiler, and the [system libraries Raylib needs](https://github.com/raysan5/raylib/wiki#development-platforms).

```sh
cmake -S . -B build
cmake --build build --config Debug
ctest --test-dir build -C Debug --output-on-failure
```

CMake uses an installed Raylib 6.0 or downloads it, and downloads [yyjson](https://github.com/ibireme/yyjson) for reading JSON.
Start `__PROJECT_NAME__` from `build/` or `build/Debug/`. It has the `.exe` extension on Windows.

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse, or arrow keys | Look |
| Space | Jump |
| Esc | Quit |

To open a different world, give the program its path: `__PROJECT_NAME__ path/to/world.gltf`. To save a picture of the first view and
quit, run `__PROJECT_NAME__ --screenshot view.png`.

## Make your own world in Blender

1. Build the scene. Floors, walls, and props are ordinary objects. Give each one a plain material, because textures are not supported.
2. Add a point light for each lamp. The game uses the first 8.
3. For every object the player should not walk through, open **Object Properties > Custom Properties** and add a property named
   `collider` with the text value `box`. The player stops at a box around the object. Floors need it too, or the player falls.
4. Add an **Empty** named `spawn_player`. Where it stands is where the player starts. Rotating it around Z turns the player, and
   with no rotation the player looks along Blender's +Y axis, which is the direction you see in front view.
5. Export from the command line with the script in `tools/`:

```sh
blender --background my_scene.blend --python tools/export_world.py -- assets/world.gltf
```

The script writes the glTF file with the settings this game expects and tells you about anything it cannot use, such as textures or
objects with a collider property that are not meshes. You can also use **File > Export > glTF 2.0** with *Format: glTF Embedded*, *Custom
Properties* on, and *Punctual Lights* on.

## How it works

| File | Job |
| --- | --- |
| `src/world.c`, `src/world.h` | Reads the glTF file into triangles, collider boxes, lights, and a spawn point, all in world space. It depends on nothing but yyjson. |
| `src/player.c`, `src/player.h` | The first-person player: gravity, jumping, and collision with boxes. It knows nothing about Raylib. |
| `src/main.c` | Opens the window, turns each mesh into a Raylib mesh, lights it with a shader, and reads the keyboard and mouse. |
| `tests/world_test.c` | Tests for the loader and the player. They need no window or graphics card. |
| `tools/export_world.py` | Exports the open Blender scene to `assets/world.gltf`. |
| `assets/world.gltf` | A small sample room with crates, a pillar, a step, and one lamp. |

Coordinates follow glTF: Y is up, and units are meters. The player is 0.6 m wide and 1.7 m tall, jumps about 0.8 m, and cannot
climb a ledge higher than their feet. The loader reads `.gltf` files with embedded or `.bin` buffers. It does not read textures,
animation, skins, or compressed meshes, and it says so in its error message when it meets one.
