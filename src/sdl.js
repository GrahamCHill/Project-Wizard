const sdlVersions = [
  { id: 'sdl3', label: 'SDL 3.4.16', version: '3.4.16', major: 3 },
  { id: 'sdl2', label: 'SDL 2.32.10', version: '2.32.10', major: 2 }
];

function sdlVersion(build) {
  return sdlVersions.find(version => version.id === build) || sdlVersions[0];
}

function renderSdl(source, { version, major }) {
  return source.replaceAll('__SDL_VERSION__', version).replaceAll('__SDL_MAJOR__', String(major))
    .replace(/^#if STARTER_SDL_MAJOR == 3\n([^]*?)^#else\n([^]*?)^#endif\n/gm,
      (block, sdl3, sdl2) => major === 3 ? sdl3 : sdl2);
}

module.exports = { sdlVersions, sdlVersion, renderSdl };
