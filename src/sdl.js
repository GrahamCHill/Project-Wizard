const sdlVersions = [
  { id: 'sdl3', label: 'SDL 3.4.16', version: '3.4.16', major: 3 },
  { id: 'sdl2', label: 'SDL 2.32.10', version: '2.32.10', major: 2 }
];

const sdlRenderers = [
  { id: 'default', label: 'SDL 2D (automatic)' },
  { id: 'vulkan', label: 'Vulkan', tools: ['vulkan-dev'],
    note: 'Use Vulkan development files 1.3.216+ and a Vulkan 1.1 driver. On macOS, install the Vulkan SDK with MoltenVK and load its setup-env.sh.' },
  { id: 'opengl', label: 'OpenGL', platformTools: { linux: ['opengl-dev'] },
    note: 'This example requests an OpenGL 3.3 core context.' },
  { id: 'dx11', label: 'DirectX 11', driver: 'direct3d11', platforms: ['win32'], tools: ['windows-directx-sdk'],
    note: 'Use Windows with the Windows SDK and a Direct3D 11-capable driver. The app explicitly selects SDL’s direct3d11 renderer.' },
  { id: 'dx12', label: 'DirectX 12', driver: 'direct3d12', platforms: ['win32'], tools: ['windows-directx-sdk'],
    note: 'Use Windows with the Windows SDK and a Direct3D 12-capable driver. The app explicitly selects SDL’s direct3d12 renderer.' }
];

const sdlStarter = {
  id: 'sdl', label: 'SDL', group: 'graphics', kind: 'starter', sdl: true, cmakeTarget: 'app',
  description: 'A C or C++ desktop app with selectable SDL 2 or 3 and a Vulkan, OpenGL, DirectX, or SDL 2D renderer.',
  variants: [{ id: 'cpp', language: 'C++' }, { id: 'c', language: 'C' }],
  tools: ['cmake'], platformTools: { linux: ['sdl-desktop'] },
  requirement: 'CMake 3.24+, a native compiler, and the requirements for the selected renderer.',
  files: ['CMakeLists.txt', 'src/main.c', 'gitignore'],
  commands: ['cmake -S . -B build', 'cmake --build build --config Debug'],
  next: 'Follow the build commands in README.md.'
};

function sdlVersion(build) {
  return sdlVersions.find(version => version.id === build) || sdlVersions[0];
}

function resolveSdl(template, options) {
  const version = sdlVersion(options.build);
  const renderer = sdlRenderers.find(renderer => renderer.id === options.renderer) || sdlRenderers[0];
  const language = (template.variants.find(choice => choice.id === options.language) || template.variants[0]).language;
  const sourceDirectory = ['opengl', 'vulkan'].includes(renderer.id) ? 'sdl-' + renderer.id : version.id + '-c';
  const note = [
    'This project uses SDL ' + version.version + ' with ' + renderer.label + '.',
    'CMake fetches SDL during the first configuration. On Linux, install the SDL development prerequisites for your distribution.',
    renderer.note,
    'Run app from build/ or build/Debug/, or open the .app bundle on macOS.'
  ].filter(Boolean).join(' ');
  return { ...template, language, sourceDirectory, note, renderer, webTarget: renderer.id === 'default' };
}

function renderSdl(source, { version, major }, renderer) {
  return source.replaceAll('__SDL_VERSION__', version).replaceAll('__SDL_MAJOR__', String(major))
    .replaceAll('__SDL_RENDER_DRIVER__', renderer?.driver ? '"' + renderer.driver + '"' : 'NULL')
    .replaceAll('__SDL_DIRECTX_CMAKE__', renderer?.driver ?
      'if(NOT WIN32)\n    message(FATAL_ERROR "This SDL renderer requires Windows.")\nendif()\n' +
      'set(SDL_DIRECTX ON CACHE BOOL "Enable SDL DirectX support")\n' +
      'set(' + (major === 2 ? 'SDL_RENDER_D3D' : renderer.id === 'dx11' ? 'SDL_RENDER_D3D11' : 'SDL_RENDER_D3D12') +
      ' ON CACHE BOOL "Enable the selected Direct3D renderer")\n' : '')
    .replace(/^#if STARTER_SDL_MAJOR == 3\n([^]*?)^#else\n([^]*?)^#endif\n/gm,
      (block, sdl3, sdl2) => major === 3 ? sdl3 : sdl2);
}

module.exports = { sdlRenderers, sdlStarter, sdlVersions, sdlVersion, renderSdl, resolveSdl };
