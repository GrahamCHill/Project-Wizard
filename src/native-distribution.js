const fs = require('node:fs/promises');
const path = require('node:path');

const shared = path.join(__dirname, '..', 'templates', '_shared', 'native-distribution');

async function configureNativeDistribution(project, template, options) {
  if (!['desktop', 'graphics', 'raylib'].includes(template.group) || template.cmakeLibrary ||
      template.androidCmake || (options.targets && !options.targets.includes('native'))) return;

  const cmake = path.join(project, 'cmake');
  const vulkan = template.id.includes('-vulkan-');
  const qt = template.id.startsWith('qt-');
  const files = ['Distribution.cmake', 'StageDistribution.cmake.in', 'Run.sh.in', 'InstallRuntime.cmake.in', 'FixupBundle.cmake.in'];
  if (vulkan) files.push('VulkanRuntime.cmake.in');
  await fs.mkdir(cmake, { recursive: true });
  for (const file of files) {
    const source = await fs.readFile(path.join(shared, file), 'utf8');
    const configured = source.replaceAll('__APP_TARGET__', template.cmakeTarget)
      .replaceAll('__HAS_VULKAN__', vulkan ? 'ON' : 'OFF')
      .replaceAll('__QT_DEPLOY__', qt ? (template.id === 'qt-quick' ? 'Quick' : 'Widgets') : '')
      .replaceAll('__HAS_LUA_SCRIPT__', template.id === 'cpp-lua-desktop' ? 'ON' : 'OFF');
    await fs.writeFile(path.join(cmake, file), configured, { flag: 'wx' });
  }
  await fs.appendFile(path.join(project, 'CMakeLists.txt'), '\ninclude(cmake/Distribution.cmake)\n');
  await fs.appendFile(path.join(project, 'README.md'), `
## Distribution

Configure a native Release build with the prerequisites above, then stage the application and its runtime libraries together.

~~~sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target distribution
~~~

Share the entire \`build/dist/Release/\` directory. Each packaging run recreates that directory. On Windows, launch the executable. On macOS, open the app bundle. On Linux, use \`${qt ? 'bin/app' : './run.sh'}\` on a compatible distribution. Graphics drivers and operating-system libraries are supplied by the destination system.
${vulkan ? '\nThe Windows package includes the LunarG Vulkan loader. Packaging downloads the pinned loader once, or you can set `PROJECT_VULKAN_RUNTIME_DIR` to a directory containing the matching `vulkan-1.dll` and `VulkanRT-License.txt`. On macOS, package with the Vulkan SDK installed so the app bundle can include MoltenVK.\n' : ''}`);
}

module.exports = { configureNativeDistribution };
