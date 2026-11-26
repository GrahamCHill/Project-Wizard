const { starter } = require('./standard-templates');

// The Blender world examples share their loader, player, sample world, tests, and Blender export script. Each engine's template
// adds only what draws the world, so the three examples behave the same.
const blenderCore = {
  'blender-world/world.gltf': 'assets/world.gltf',
  'blender-world/export_world.py': 'tools/export_world.py'
};

const blenderCoreC = {
  ...blenderCore,
  'blender-world/c/world.c': 'src/world.c',
  'blender-world/c/world.h': 'src/world.h',
  'blender-world/c/player.c': 'src/player.c',
  'blender-world/c/player.h': 'src/player.h',
  'blender-world/c/world_test.c': 'tests/world_test.c'
};

const miscStarters = [
  starter('misc-blender-world-raylib', 'misc', 'C', 'Blender World in Raylib',
    'Walk around a scene exported from Blender: glTF loading, lamps, a first-person player with collision, and a Blender export script.',
    ['cmake', 'c-compiler'], ['CMakeLists.txt', 'src/main.c', 'README.md', 'gitignore'], undefined, {
      sharedFiles: blenderCoreC,
      requirement: 'CMake 3.24+ and a C compiler. CMake can fetch Raylib and yyjson during configuration. Blender is needed only to make your own world.'
    }),
  starter('misc-blender-world-sdl', 'misc', 'C', 'Blender World in SDL',
    'The same Blender scene walked in SDL 3, with a small software 3D renderer written in plain C so there is no graphics API to learn first.',
    ['cmake', 'c-compiler'], ['CMakeLists.txt', 'src/main.c', 'src/raster.c', 'src/raster.h', 'tests/raster_test.c', 'README.md', 'gitignore'],
    undefined, {
      sharedFiles: blenderCoreC,
      requirement: 'CMake 3.24+ and a C compiler. CMake can fetch SDL 3.4.16 and yyjson during configuration. On Linux, SDL needs its usual X11 or Wayland development packages. Blender is needed only to make your own world.'
    }),
  starter('misc-blender-world-bevy', 'misc', 'Rust', 'Blender World in Bevy',
    'The same Blender scene walked in Bevy 0.20: the glTF is read into colliders, lamps, and a spawn point, then drawn as Bevy meshes and lights.',
    ['rust'], ['Cargo.toml', 'src/main.rs', 'src/world.rs', 'src/player.rs', 'README.md', 'gitignore'],
    undefined, {
      sharedFiles: blenderCore,
      requirement: 'Rust 1.97+ and Cargo. The first build downloads and compiles Bevy, which takes several minutes. On Linux, Bevy needs its usual system packages. Blender is needed only to make your own world.'
    })
];

module.exports = { miscStarters, blenderCore, blenderCoreC };
