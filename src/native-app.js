const fs = require('node:fs/promises');
const path = require('node:path');
const { replaceTokens } = require('./projects');

function executableIconSupported(template) {
  return Boolean(template.cmakeTarget && !template.androidCmake &&
    (!template.platforms || template.platforms.some(platform => platform === 'win32' || platform === 'darwin')));
}

function validIcon(extension, data) {
  if (extension === '.icns') {
    return data.length >= 16 && data.toString('ascii', 0, 4) === 'icns' && data.readUInt32BE(4) === data.length;
  }
  if (data.length < 22 || data.readUInt16LE(0) !== 0 || data.readUInt16LE(2) !== 1) return false;
  const count = data.readUInt16LE(4);
  const directoryEnd = 6 + count * 16;
  if (!count || directoryEnd >= data.length) return false;
  for (let entry = 6; entry < directoryEnd; entry += 16) {
    const size = data.readUInt32LE(entry + 8);
    const offset = data.readUInt32LE(entry + 12);
    if (!size || offset < directoryEnd || offset + size > data.length) return false;
  }
  return true;
}

async function loadExecutableIcons(files) {
  const icons = new Map();
  for (const file of files) {
    const name = path.basename(file);
    const extension = path.extname(name).toLowerCase();
    if (extension !== '.ico' && extension !== '.icns') throw new Error('Choose a Windows .ico or a macOS .icns file.');
    if (icons.has(extension)) throw new Error('Choose up to one .ico file and one .icns file.');
    const info = await fs.stat(file);
    if (!info.isFile() || info.size > 32 * 1024 * 1024) throw new Error('Choose an icon file up to 32 MB.');
    const data = await fs.readFile(file);
    if (!validIcon(extension, data)) throw new Error(name + ' is not a valid ' + extension + ' file.');
    icons.set(extension, { name, data });
  }
  return icons;
}

async function configureNativeApp(project, template, name, options) {
  if (template.androidCmake || (options.targets && !options.targets.includes('native'))) return;
  const icons = options.icons;
  const windowsIcon = icons?.get('.ico');
  const macIcon = icons?.get('.icns');
  const macSupported = !template.platforms || template.platforms.includes('darwin');
  const macBundle = macSupported && (icons?.size || ['desktop', 'graphics', 'raylib'].includes(template.group));
  const target = template.cmakeTarget;
  const cmake = [];
  const notes = [];

  if (windowsIcon || macIcon) {
    const assets = path.join(project, 'assets');
    await fs.mkdir(assets, { recursive: true });
    for (const [extension, icon] of icons) {
      await fs.writeFile(path.join(assets, 'app' + extension), icon.data, { flag: 'wx' });
    }
    if (windowsIcon) {
      await fs.writeFile(path.join(assets, 'app-icon.rc.in'),
        '1 ICON "@CMAKE_CURRENT_SOURCE_DIR@/assets/app.ico"\n', { flag: 'wx' });
      cmake.push('if(WIN32 AND NOT EMSCRIPTEN)',
        '    enable_language(RC)',
        '    configure_file(assets/app-icon.rc.in app-icon.rc @ONLY)',
        '    set_property(SOURCE "${CMAKE_CURRENT_BINARY_DIR}/app-icon.rc" APPEND PROPERTY',
        '        OBJECT_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/assets/app.ico")',
        `    target_sources(${target} PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/app-icon.rc")`,
        'endif()', '');
      notes.push('Windows embeds `assets/app.ico` in the executable.');
    }
  }
  if (macBundle) {
    cmake.push('if(CMAKE_SYSTEM_NAME STREQUAL "Darwin")',
      `    set_target_properties(${target} PROPERTIES`,
      '        MACOSX_BUNDLE TRUE',
      `        MACOSX_BUNDLE_BUNDLE_NAME "${name}"`,
      '        MACOSX_BUNDLE_GUI_IDENTIFIER "com.example.__PROJECT_SLUG__"', '    )');
    if (macIcon) {
      cmake.push('    set_source_files_properties(assets/app.icns PROPERTIES MACOSX_PACKAGE_LOCATION Resources)',
        `    target_sources(${target} PRIVATE assets/app.icns)`,
        `    set_target_properties(${target} PROPERTIES MACOSX_BUNDLE_ICON_FILE "app.icns")`);
    }
    cmake.push('endif()', '');
    notes.push('On macOS, open the `.app` bundle from `build/` or the build configuration subfolder.' +
      (macIcon ? ' The bundle uses `assets/app.icns` as its icon.' : ''));
  }
  if (cmake.length) {
    await fs.appendFile(path.join(project, 'CMakeLists.txt'), '\n' + replaceTokens(cmake.join('\n'), name));
    await fs.appendFile(path.join(project, 'README.md'), '\n## Native application\n\n' + notes.join('\n\n') + '\n');
  }
}

module.exports = { configureNativeApp, executableIconSupported, loadExecutableIcons };
