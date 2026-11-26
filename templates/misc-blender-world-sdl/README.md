# __PROJECT_NAME__

Walk around a world you made in Blender, drawn with [SDL 3](https://libsdl.org). SDL gives you a window, a keyboard, a mouse, and a
way to put pixels on the screen. It does not draw 3D, so this example does that itself on the CPU: `src/raster.c` is a complete
small renderer you can read in one sitting. Blender exports a glTF file, `src/world.c` reads it, and the player cannot walk through
walls.

## Run it

Install CMake 3.24+ and a C compiler. On Linux, also install the development packages SDL needs, such as X11 or Wayland and
ALSA, described in [SDL's build notes](https://wiki.libsdl.org/SDL3/README-linux).

```sh
cmake -S . -B build
cmake --build build --config Debug
ctest --test-dir build -C Debug --output-on-failure
```

CMake downloads SDL 3.4.16 and [yyjson](https://github.com/ibireme/yyjson) (for reading JSON) at configure time.
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
2. Add a point light for each lamp.
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
| `src/player.c`, `src/player.h` | The first-person player: gravity, jumping, and collision with boxes. It knows nothing about SDL. |
| `src/raster.c`, `src/raster.h` | The software renderer: camera transform, clipping, projection, triangle filling, a depth buffer, and per-pixel lighting. |
| `src/main.c` | Opens the window, reads the keyboard and mouse, and shows the finished pixels. |
| `tests/world_test.c`, `tests/raster_test.c` | Tests for the loader, the player, and the renderer. They need no window or graphics card. |
| `tools/export_world.py` | Exports the open Blender scene to `assets/world.gltf`. |
| `assets/world.gltf` | A small sample room with crates, a pillar, a step, and one lamp. |

The scene is drawn at 640 by 360 pixels and scaled up to the window, which keeps a CPU renderer quick. Change `VIEW_WIDTH` and
`VIEW_HEIGHT` in `src/main.c` to trade sharpness for speed. For large scenes you would move the drawing to the GPU with SDL's GPU API
or OpenGL, and keep `world.c` and `player.c` as they are.

Coordinates follow glTF: Y is up, and units are meters. The player is 0.6 m wide and 1.7 m tall, jumps about 0.8 m, and cannot
climb a ledge higher than their feet. Light is a flat ambient level plus each lamp, which weakens with distance and with the angle
of the surface. The loader reads `.gltf` files with embedded or `.bin` buffers. It does not read textures, animation, skins, or
compressed meshes, and it says so in its error message when it meets one.
