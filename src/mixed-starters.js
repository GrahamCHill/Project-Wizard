const sdlMixedStarters = [
  ['vulkan', 'Vulkan', 'vulkan', 'Install a Vulkan driver and loader. On macOS, use the Vulkan SDK with MoltenVK.'],
  ['opengl', 'OpenGL', 'opengl', 'Use a system OpenGL driver and the SDL desktop build prerequisites.'],
  ['directx', 'DirectX 11', 'direct3d11', 'Use Windows with a Direct3D 11-capable graphics driver.']
].map(([id, label, driver, note]) => ({
  id: `sdl3-${id}-csharp-cpp-lua`, group: 'graphics', kind: 'starter', language: 'C#',
  label: `SDL3 + ${label} (C# + C++ + Lua)`,
  description: 'A C# app loop, an SDL renderer in C++, and Lua behavior that reloads while the window is open.',
  needsSdk: true, nativeTarget: 'pw_native', sdlVersion: '3.4.16', sourceDirectory: 'sdl-csharp-lua',
  sdlBackend: driver, sdlBackendLabel: label, sdlBackendNote: note,
  tools: ['dotnet', 'cmake', 'c-compiler', 'cpp-compiler'],
  ...(id === 'directx' ? { platforms: ['win32'] } : { platformTools: { linux: ['sdl-desktop', ...(id === 'opengl' ? ['opengl-dev'] : [])] } }),
  requirement: `.NET SDK 8+, CMake 3.24+, and a native C/C++ compiler. ${note}`,
  next: 'Run dotnet run from the project folder.',
  files: ['__PROJECT_NAME__.csproj', 'Program.cs', 'NativeScene.cs', 'native/CMakeLists.txt', 'native/src/scene.cpp',
    'native/cmake/FixBundle.cmake', 'native/README.md', 'scripts/behavior.lua', 'gitignore', 'README.md'],
  sharedFiles: {
    'native/BuildNative.targets': 'native/BuildNative.targets',
    'native/Lua.cmake': 'native/cmake/Lua.cmake',
    ...(id === 'vulkan' ? { 'native-distribution/VulkanRuntime.cmake.in': 'native/cmake/VulkanRuntime.cmake.in' } : {})
  }
}));

const nativePluginFiles = {
  'native/PluginHost.cmake': 'cmake/PluginHost.cmake',
  'native/native_plugin.h': 'include/native_plugin.h',
  'native/native_plugin.cpp': 'src/native_plugin.cpp',
  'native/plugin_api.h': 'include/plugin_api.h',
  'native/sample_plugin.cpp': 'src/sample_plugin.cpp'
};

const pluginStarters = [
  {
    id: 'cpp-native-plugin-host', group: 'cli', kind: 'starter', language: 'C++', label: 'C++ Plugin Host',
    description: 'A C++17 host that discovers native shared libraries with a versioned plugin API.',
    tools: ['cmake', 'cpp-compiler'], cmakeTarget: 'app',
    requirement: 'CMake 3.24+ and a native C++ compiler.',
    next: 'Build and run the sample host using README.md.',
    files: ['CMakeLists.txt', 'src/main.cpp', 'gitignore', 'README.md'],
    sharedFiles: nativePluginFiles
  },
  {
    id: 'cpp-plugin-host', group: 'cli', kind: 'starter', language: 'C++', label: 'C++ Plugin Host + Lua',
    description: 'A versioned native plugin API with a sample shared library and an embedded Lua plugin.',
    tools: ['cmake', 'c-compiler', 'cpp-compiler'], cmakeTarget: 'app',
    requirement: 'CMake 3.24+ and native C and C++ compilers.',
    next: 'Build and run the sample host using README.md.',
    files: ['CMakeLists.txt', 'src/main.cpp', 'plugins/greeting.lua', 'gitignore', 'README.md'],
    sharedFiles: { ...nativePluginFiles, 'native/Lua.cmake': 'cmake/Lua.cmake' }
  },
  {
    id: 'csharp-plugin-host', group: 'cli', kind: 'starter', language: 'C#', label: 'C# Plugin Host + Lua',
    description: 'A managed plugin contract, an isolated assembly loader, and a sample Lua plugin.',
    tools: ['dotnet'], needsSdk: true,
    requirement: '.NET SDK 8 or newer.', next: 'Run dotnet run from the project folder.',
    files: ['__PROJECT_NAME__.csproj', 'Program.cs', 'contracts/PluginContract.csproj', 'contracts/IPlugin.cs',
      'samples/GreetingPlugin/GreetingPlugin.csproj', 'samples/GreetingPlugin/Greeting.cs', 'plugins/greeting.lua', 'gitignore', 'README.md']
  }
];

module.exports = { sdlMixedStarters, pluginStarters };
