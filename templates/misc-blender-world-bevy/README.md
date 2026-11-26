# __PROJECT_NAME__

Walk around a world you made in Blender, drawn with [Bevy](https://bevy.org). Blender exports a glTF file, `src/world.rs` reads it,
and the game turns it into Bevy meshes and lights. The player cannot walk through walls.

## Run it

Install [Rust](https://rustup.rs) 1.97 or newer. On Linux, Bevy also needs a few system packages, listed in the
[Linux dependencies](https://github.com/bevyengine/bevy/blob/main/docs/linux_dependencies.md) page.

```sh
cargo run
cargo test
```

The first build compiles Bevy and takes several minutes. Later builds are fast. Settings in `Cargo.toml` make Bevy itself optimized
even in a debug build, so the game stays smooth while your own code stays easy to debug.

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse, or arrow keys | Look |
| Space | Jump |
| Esc | Quit |

To open a different world, give the program its path: `cargo run -- path/to/world.gltf`. To save a picture of the first view and
quit, run `cargo run -- --screenshot view.png`.

## Make your own world in Blender

1. Build the scene. Floors, walls, and props are ordinary objects. Give each one a plain material. The game uses each material's Base
   Color, and ignores textures.
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
| `src/world.rs` | Reads the glTF file with the `gltf` crate and flattens it: triangles, collider boxes, lamps, and a spawn point, all in world space. It never touches Bevy's renderer. |
| `src/player.rs` | The first-person player: gravity, jumping, and collision with boxes. |
| `src/main.rs` | The Bevy app. It turns the world into entities, reads the keyboard and mouse, and moves the camera. |
| `tools/export_world.py` | Exports the open Blender scene to `assets/world.gltf`. |
| `assets/world.gltf` | A small sample room with crates, a pillar, a step, and one lamp. |

Bevy can also load a glTF file by itself with `SceneRoot`, which is the quickest way to put a model on screen. This example reads the
file with the `gltf` crate instead, because a game needs more than pictures. Collision boxes and a spawn point come from your
Blender scene, and doing that in plain functions means the tests run without a window or a graphics card. If you only need to show a
level, you can replace `world.rs` with `SceneRoot` and keep the player.

Coordinates follow glTF and Bevy: Y is up, and units are meters. The player is 0.6 m wide and 1.7 m tall, jumps about 0.8 m, and
cannot climb a ledge higher than their feet. Lamps keep Blender's units: Blender exports
54.35 candela for every watt of a point lamp, and `lamp_lumens` in `src/main.rs` turns candela into Bevy's lumens the same way Bevy's own
glTF loader does. The sample lamp is a 120 W Blender lamp. Bevy lights physically, so use real-world strengths and it will look right.
