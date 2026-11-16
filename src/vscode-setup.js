const fs = require('node:fs/promises');
const path = require('node:path');

async function configureCmakeEditor(project, { webOnly = false, nativeBridge = false } = {}) {
  const recommendations = ['ms-vscode.cpptools'];
  const settings = {};
  const sourceDirectory = nativeBridge ? 'native' : '.';
  const clangdBuild = webOnly ? 'build-web' : nativeBridge ? 'native/build/clangd' : 'build/clangd';
  if (webOnly) {
    settings['cmake.configureOnOpen'] = false;
    settings['C_Cpp.default.compileCommands'] = ['${workspaceFolder}/build-web/compile_commands.json'];
  } else {
    recommendations.push('ms-vscode.cmake-tools');
    settings['C_Cpp.default.configurationProvider'] = 'ms-vscode.cmake-tools';
  }
  if (nativeBridge) {
    recommendations.push('ms-dotnettools.csharp');
    settings['cmake.sourceDirectory'] = '${workspaceFolder}/native';
    settings['cmake.buildDirectory'] = '${workspaceFolder}/native/build/vscode';
  }

  const vscode = path.join(project, '.vscode');
  await fs.mkdir(vscode, { recursive: true });
  await fs.writeFile(path.join(vscode, 'extensions.json'), JSON.stringify({ recommendations }, null, 2) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(vscode, 'settings.json'), JSON.stringify(settings, null, 2) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(project, '.clangd'), `CompileFlags:\n  CompilationDatabase: ${clangdBuild}\n`, { flag: 'wx' });

  const steps = webOnly ?
    'Open this project folder in VS Code and install the recommended C/C++ extension. Run the Emscripten configure command above to create `build-web/compile_commands.json`. IntelliSense uses that file for autocomplete, include paths, and defines. Reconfigure after changing dependencies.' :
    'Open this project folder in VS Code and install the recommended C/C++ and CMake Tools extensions. Run **CMake: Select a Kit** to choose your compiler, then **CMake: Configure**. CMake downloads any missing dependencies and provides their include paths and compiler flags to IntelliSense. Reconfigure after changing dependencies.';
  const clangd = webOnly ?
    'If you use clangd, disable Microsoft C/C++ IntelliSense for this workspace. The included `.clangd` points to the database created by the Emscripten configure command. To index Emscripten-specific code and SDK headers, pass `--query-driver` in `clangd.arguments` with the full paths to the SDK compilers from the compile database. [clangd compiler queries](https://clangd.llvm.org/guides/system-headers#query-driver)' :
    `If you use clangd, disable Microsoft C/C++ IntelliSense for this workspace. With Ninja and your compiler on PATH, run the command below. For MSVC, run it in a Developer PowerShell. The included \`.clangd\` points to the generated database.\n\n~~~sh\ncmake -S ${sourceDirectory} -B ${clangdBuild} -G Ninja -DCMAKE_EXPORT_COMPILE_COMMANDS=ON\n~~~`;
  const managed = nativeBridge ? '\n\nFor C# autocomplete, install the recommended C# extension and run `dotnet restore` from the project root.' : '';
  await fs.appendFile(path.join(project, 'README.md'), `\n## VS Code IntelliSense and autocomplete\n\n${steps}\n\n${clangd}${managed}\n`);
}

module.exports = { configureCmakeEditor };
