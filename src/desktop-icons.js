const fs = require('node:fs/promises');
const path = require('node:path');
const { replaceTokens } = require('./projects');

async function updateFile(project, relative, change) {
  const file = path.join(project, relative);
  const before = await fs.readFile(file, 'utf8');
  const after = change(before);
  if (after === before) throw new Error('Could not configure the app icon in ' + relative + '.');
  await fs.writeFile(file, after);
}

async function saveAssets(project, icons) {
  const assets = path.join(project, 'assets');
  await fs.mkdir(assets, { recursive: true });
  for (const [extension, icon] of icons) await fs.writeFile(path.join(assets, 'app' + extension), icon.data, { flag: 'wx' });
}

function appendReadme(project, text) {
  return fs.appendFile(path.join(project, 'README.md'), '\n## App icon\n\n' + text + '\n');
}

function appendDistribution(project, text) {
  return fs.appendFile(path.join(project, 'README.md'), '\n## Distribution\n\n' + text + '\n');
}

async function tauriIcons(project, icons, raster) {
  const assets = path.join(project, 'src-tauri', 'icons');
  const configFile = path.join(project, 'src-tauri', 'tauri.conf.json');
  const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
  config.bundle ||= {};
  const configured = new Set(config.bundle.icon || []);
  for (const extension of ['.ico', '.icns']) {
    if (!icons.has(extension)) continue;
    await fs.writeFile(path.join(assets, 'icon' + extension), icons.get(extension).data);
    configured.add('icons/icon' + extension);
  }
  if (raster) {
    const sizes = { '32x32.png': 32, '128x128.png': 128, '128x128@2x.png': 256, 'icon.png': 512 };
    for (const [file, dimension] of Object.entries(sizes)) {
      await fs.writeFile(path.join(assets, file), await raster.png(dimension));
      configured.add('icons/' + file);
    }
  }
  config.bundle.icon = [...configured];
  await fs.writeFile(configFile, JSON.stringify(config, null, 2) + '\n');
  await appendReadme(project, 'Run `npm run tauri build` to package the application with the icons in `src-tauri/icons/`.');
}

async function electronIcons(project, icons) {
  if (icons.has('.png') || icons.has('.ico')) {
    const icon = icons.has('.png') ? 'app.png' : 'app.ico';
    await updateFile(project, 'src/main.cjs', source => source.replace('    height: 480,',
      '    height: 480,\n    icon: path.join(__dirname, \'..\', \'assets\', \'' + icon + '\'),'));
  }
  if (icons.has('.ico') || icons.has('.icns')) {
    const iconExtension = 'process.platform === \'darwin\' ? \'icns\' : process.platform === \'win32\' ? \'ico\' : null';
    await fs.writeFile(path.join(project, 'forge.config.cjs'),
      "const fs = require('node:fs');\nconst path = require('node:path');\n\n" +
      'const extension = ' + iconExtension + ';\n' +
      "const icon = extension && path.join(__dirname, 'assets', 'app.' + extension);\n\n" +
      'module.exports = {\n  packagerConfig: { asar: true, ...(icon && fs.existsSync(icon) ? { icon } : {}) }\n};\n');
  }
  await appendReadme(project, 'Run `npm run package` to package the application. Forge uses the selected native icon when packaging for Windows or macOS, and the PNG is used by the desktop window when available.');
}

async function flutterDesktopIcons(project, icons, raster) {
  if (icons.has('.ico')) {
    await fs.writeFile(path.join(project, 'windows/runner/resources/app_icon.ico'), icons.get('.ico').data);
  }
  if (!raster) return;

  const catalog = path.join(project, 'macos/Runner/Assets.xcassets/AppIcon.appiconset');
  const manifest = JSON.parse(await fs.readFile(path.join(catalog, 'Contents.json'), 'utf8'));
  const macIcons = new Map(manifest.images.filter(image => image.filename).map(({ filename, size, scale }) =>
    [filename, Number.parseInt(size, 10) * Number.parseInt(scale, 10)]));
  await Promise.all([...macIcons].map(async ([file, size]) => fs.writeFile(path.join(catalog, file), await raster.png(size))));

  await fs.writeFile(path.join(project, 'linux/app-icon.png'), await raster.png(256));
  await fs.appendFile(path.join(project, 'linux/CMakeLists.txt'),
    '\ninstall(FILES "${CMAKE_CURRENT_SOURCE_DIR}/app-icon.png" DESTINATION "${INSTALL_BUNDLE_DATA_DIR}" COMPONENT Runtime)\n');
  await updateFile(project, 'linux/runner/my_application.cc', source =>
    source.replace(/(\n\s*gtk_window_set_default_size\(window,[^;]+;)/, '$1\n' + [
      '  g_autofree gchar* executable = g_file_read_link("/proc/self/exe", nullptr);',
      '  if (executable != nullptr) {',
      '    g_autofree gchar* directory = g_path_get_dirname(executable);',
      '    g_autofree gchar* icon = g_build_filename(directory, "data", "app-icon.png", nullptr);',
      '    gtk_window_set_icon_from_file(window, icon, nullptr);',
      '  }'
    ].join('\n')));
}

async function pythonIcons(project, name, options, icons) {
  const png = icons.has('.png');
  const ico = icons.has('.ico');
  if (png || ico) {
    const icon = png ?
      '    icon = tk.PhotoImage(file=str(Path(__file__).resolve().parent / "assets" / "app.png"))\n    window.iconphoto(True, icon)\n' :
      '    if window.tk.call("tk", "windowingsystem") == "win32":\n        window.iconbitmap(str(Path(__file__).resolve().parent / "assets" / "app.ico"))\n';
    await updateFile(project, 'main.py', source => 'from pathlib import Path\n\n' + source.replace('    window.mainloop()', icon + '    window.mainloop()'));
  }
  const command = options.environment === 'uv' ? 'uv run --with pyinstaller pyinstaller' :
    options.environment === 'conda' ? 'conda run --prefix ./.venv python -m PyInstaller' : 'python -m PyInstaller';
  const install = options.environment === 'uv' ? '' : (options.environment === 'conda' ? 'conda run --prefix ./.venv ' : '') +
    'python -m pip install pyinstaller\n';
  const platforms = [['Windows', '.ico'], ['macOS', '.icns'], ['Linux', '.png']];
  const commands = platforms.map(([platform, extension]) =>
    '### ' + platform + '\n\n~~~sh\n' + install + command + ' --windowed --name "' + name + '" --add-data "assets:assets"' +
    (platform !== 'Linux' && icons.has(extension) ? ' --icon assets/app' + extension : '') + ' main.py\n~~~');
  const generic = `~~~sh\n${install}${command} --windowed --name "${name}" main.py\n~~~`;
  await appendDistribution(project, 'Package the app from the configured Python environment with PyInstaller. Share the app directory or macOS bundle in `dist/`.\n\n' +
    (icons.size ? commands.join('\n\n') : generic));
}

async function jvmIcons(project, template, name, options, icons) {
  const java = template.id === 'java-desktop';
  const managed = java && options.build !== 'jdk';
  const png = icons.has('.png');
  if (png) {
    if (managed) {
      const resources = path.join(project, 'src', 'main', 'resources');
      await fs.mkdir(resources, { recursive: true });
      await fs.copyFile(path.join(project, 'assets', 'app.png'), path.join(resources, 'app.png'));
    }
    if (java) {
      await updateFile(project, managed ? 'src/main/java/Main.java' : 'Main.java', source =>
        source.replace('            window.setVisible(true);', [
          '            java.net.URL resource = Main.class.getResource("/app.png");',
          '            javax.swing.ImageIcon icon = resource == null ? new javax.swing.ImageIcon("assets/app.png") : new javax.swing.ImageIcon(resource);',
          '            window.setIconImage(icon.getImage());',
          '            window.setVisible(true);'
        ].join('\n')));
    } else {
      await updateFile(project, 'Main.kt', source => source.replace('        window.isVisible = true', [
        '        val resource = ClassLoader.getSystemResource("app.png")',
        '        val icon = if (resource == null) javax.swing.ImageIcon("assets/app.png") else javax.swing.ImageIcon(resource)',
        '        window.iconImage = icon.image',
        '        window.isVisible = true'
      ].join('\n')));
    }
  }

  const slug = replaceTokens('__PROJECT_SLUG__', name);
  let input = 'package-input';
  let mainJar = 'app.jar';
  let build;
  if (managed && options.build === 'maven') {
    input = 'target';
    mainJar = slug + '-0.1.0.jar';
    build = 'mvn package dependency:copy-dependencies "-DincludeScope=runtime" "-DoutputDirectory=target"';
    await updateFile(project, 'pom.xml', source => source.replace('    <plugins>\n', [
      '    <plugins>',
      '      <plugin>',
      '        <groupId>org.apache.maven.plugins</groupId>',
      '        <artifactId>maven-jar-plugin</artifactId>',
      '        <version>3.4.2</version>',
      '        <configuration><archive><manifest><addClasspath>true</addClasspath></manifest></archive></configuration>',
      '      </plugin>',
      ''
    ].join('\n')));
  } else if (managed) {
    input = 'build/install/' + slug + '/lib';
    mainJar = slug + '-0.1.0.jar';
    build = 'gradle installDist';
    await fs.appendFile(path.join(project, 'build.gradle'), '\n' +
      "tasks.named('jar') {\n    doFirst {\n        manifest.attributes('Class-Path': configurations.runtimeClasspath.files.collect { it.name }.join(' '))\n    }\n}\n");
  } else if (java) {
    build = 'javac -d out Main.java\nmkdir package-input\njar --create --file package-input/app.jar -C out .' +
      (png ? ' -C assets app.png' : '');
  } else {
    build = 'mkdir package-input\nkotlinc Main.kt -include-runtime -d package-input/app.jar' +
      (png ? '\njar --update --file package-input/app.jar -C assets app.png' : '');
  }
  const platforms = [['Windows', '.ico'], ['macOS', '.icns'], ['Linux', '.png']];
  const packageCommand = 'jpackage --type app-image --dest packaged --name "' + name + '" --input "' + input +
    '" --main-jar "' + mainJar + '" --main-class ' + (java ? 'Main' : 'MainKt');
  const commands = platforms.map(([platform, extension]) => '### ' + platform + '\n\n~~~sh\n' + packageCommand +
    (icons.has(extension) ? ' --icon assets/app' + extension : '') + '\n~~~');
  await fs.appendFile(path.join(project, '.gitignore'), '\n/package-input/\n/packaged/\n');
  await appendDistribution(project, 'Build the JAR and use JDK 17 or newer to create an app image with the JVM bundled. Share the app image in `packaged/`.\n\n~~~sh\n' +
    build + '\n~~~\n\n' + (icons.size ? commands.join('\n\n') : `~~~sh\n${packageCommand}\n~~~`));
}

async function macBundle(project, template, name, icon) {
  const folder = path.join(project, 'scripts');
  await fs.mkdir(folder, { recursive: true });
  const slug = replaceTokens('__PROJECT_SLUG__', name);
  const dotnet = template.language === 'C#';
  const executable = dotnet ? name : 'App';
  const commands = dotnet ? [
    'case "$(uname -m)" in',
    '    arm64) runtime=osx-arm64 ;;',
    '    x86_64) runtime=osx-x64 ;;',
    '    *) echo "Unsupported architecture"; exit 1 ;;',
    'esac',
    'dotnet publish -c Release -r "$runtime" --self-contained -o "$app/Contents/MacOS"'
  ] : template.id === 'swift-desktop' ? [
    'swift build -c release',
    'cp "$(swift build -c release --show-bin-path)/App" "$app/Contents/MacOS/App"'
  ] : ['xcrun --sdk macosx clang -fobjc-arc main.m -framework AppKit -o "$app/Contents/MacOS/App"'];
  const plist = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    '  <key>CFBundleExecutable</key>',
    '  <string>' + executable + '</string>',
    '  <key>CFBundleName</key><string>' + name + '</string>',
    '  <key>CFBundleIdentifier</key><string>com.example.' + slug + '</string>',
    ...(icon ? ['  <key>CFBundleIconFile</key><string>app.icns</string>'] : []),
    '  <key>CFBundlePackageType</key><string>APPL</string>',
    '  <key>CFBundleShortVersionString</key><string>0.1.0</string>',
    '  <key>CFBundleVersion</key><string>1</string>',
    '</dict></plist>'
  ];
  const script = [
    '#!/bin/sh', 'set -eu', 'cd "$(dirname "$0")/.."', 'app="packaged/' + name + '.app"',
    'mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"', ...commands,
    ...(icon ? ['cp assets/app.icns "$app/Contents/Resources/app.icns"'] : []),
    'cat > "$app/Contents/Info.plist" <<\'PLIST\'', ...plist, 'PLIST',
    ...(template.sdlBackend ? ['cmake "-DAPP_BUNDLE=$PWD/$app" -P native/cmake/FixBundle.cmake'] : []), ''
  ];
  await fs.writeFile(path.join(folder, 'package-macos.sh'), script.join('\n'), { flag: 'wx' });
  await fs.appendFile(path.join(project, '.gitignore'), '\n/packaged/\n');
  const instructions = 'On macOS, run `sh scripts/package-macos.sh` to build the `.app` bundle in `packaged/`.';
  if (template.sdlBackend) await fs.appendFile(path.join(project, 'README.md'), '\n' + instructions + '\n');
  else await appendDistribution(project, instructions);
}

async function dotnetIcons(project, template, name, icons) {
  const ico = icons.has('.ico');
  const raylib = template.group === 'raylib';
  const png = (raylib || template.sdlBackend) && icons.has('.png');
  if (ico || png) {
    const manifest = (await fs.readdir(project)).find(file => file.endsWith('.csproj'));
    if (!manifest) throw new Error('The .NET starter did not generate a .csproj file.');
    await updateFile(project, manifest, source => source.replace('</Project>', [
      ...(ico ? ['  <PropertyGroup Condition="$([MSBuild]::IsOSPlatform(\'Windows\'))">', '    <ApplicationIcon>assets/app.ico</ApplicationIcon>', '  </PropertyGroup>'] : []),
      ...(png ? ['  <ItemGroup>',
        '    <None Update="assets/app.png" CopyToOutputDirectory="PreserveNewest" CopyToPublishDirectory="PreserveNewest" />',
        '  </ItemGroup>'] : []),
      '</Project>'
    ].join('\n')));
  }
  if (ico && !raylib && !template.sdlBackend) {
    await updateFile(project, 'Program.cs', source => source.replace(
      'Application.Run(new Form1());',
      'Application.Run(new Form1 { Icon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath) });'));
  }
  if (png && raylib) {
    await updateFile(project, 'Program.cs', source => source.replace('Raylib.SetTargetFPS(60);', [
      'var icon = Raylib.LoadImage(Path.Combine(AppContext.BaseDirectory, "assets", "app.png"));',
      'Raylib.SetWindowIcon(icon);',
      'Raylib.UnloadImage(icon);',
      'Raylib.SetTargetFPS(60);'
    ].join('\n')));
  }
  if (template.sdlBackend) {
    if (template.platforms?.includes('darwin') ?? true) await macBundle(project, template, name, icons.has('.icns'));
    if (ico) await appendReadme(project, 'The Windows app host embeds `assets/app.ico`.');
    return;
  }
  if (raylib) await macBundle(project, template, name, icons.has('.icns'));
  await fs.appendFile(path.join(project, '.gitignore'), '\n/dist/\n');
  const publish = `Run \`dotnet publish -c Release --use-current-runtime --self-contained -o dist\` on ${raylib ? 'Windows or Linux' : 'Windows'}. Share the whole \`dist/\` folder, including the bundled .NET runtime.`;
  if (raylib) await fs.appendFile(path.join(project, 'README.md'), '\n' + publish + '\n');
  else await appendDistribution(project, publish);
  if (ico) await appendReadme(project, 'The Windows app host embeds `assets/app.ico` when built with `dotnet build` or `dotnet publish`.');
}

async function configureDesktopApp(project, template, name, options, icons, raster) {
  if (template.id === 'tauri') return icons.size ? tauriIcons(project, icons, raster) : undefined;
  if (template.id === 'flutter-desktop') return icons.size ? flutterDesktopIcons(project, icons, raster) : undefined;
  if (icons.size) await saveAssets(project, icons);
  if (template.id === 'godot' || template.id.startsWith('godot-native-')) {
    const settings = [['.png', 'icon'], ['.ico', 'windows_native_icon'], ['.icns', 'macos_native_icon']]
      .filter(([extension]) => icons.has(extension))
      .map(([extension, key]) => 'config/' + key + '="res://assets/app' + extension + '"');
    await updateFile(project, 'project.godot', source =>
      source.replace('[application]', '[application]\n\n' + settings.join('\n')));
    return appendReadme(project, 'The project uses the icons in `assets/`. In the Windows export preset, select `assets/app.ico` as the Application Icon when available.');
  }
  if (template.id === 'electron') return icons.size ? electronIcons(project, icons) : undefined;
  if (template.id === 'python-desktop') return pythonIcons(project, name, options, icons);
  if (template.id === 'java-desktop' || template.id === 'kotlin-desktop') return jvmIcons(project, template, name, options, icons);
  if (template.kind === 'dotnet' || template.sdlBackend || (template.language === 'C#' && template.group === 'raylib')) {
    return dotnetIcons(project, template, name, icons);
  }
  if (['swift-desktop', 'objc-desktop'].includes(template.id)) return macBundle(project, template, name, icons.has('.icns'));
}

module.exports = { configureDesktopApp };
