const fs = require('node:fs/promises');
const path = require('node:path');
const { reactNativeIdentifier } = require('./react-native');

async function write(project, relative, contents) {
  const file = path.join(project, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, contents);
}

async function androidIcon(project, source, raster) {
  const resources = path.join(source, 'res');
  const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [density, size] of Object.entries(densities)) {
    await write(project, path.join(resources, 'mipmap-' + density, 'pw_app_icon.png'),
      await raster.png(size, { opaque: true }));
  }
  await write(project, path.join(resources, 'drawable-xxxhdpi', 'pw_icon_foreground.png'),
    await raster.png(432, { inset: 0.6 }));
  await write(project, path.join(resources, 'mipmap-anydpi-v26', 'pw_app_icon.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n' +
    '    <background android:drawable="@android:color/white"/>\n' +
    '    <foreground android:drawable="@drawable/pw_icon_foreground"/>\n' +
    '</adaptive-icon>\n');
  const file = path.join(project, source, 'AndroidManifest.xml');
  const manifest = await fs.readFile(file, 'utf8');
  const updated = manifest.replace(/<application\b[^>]*>/, tag =>
    tag.replace(/\s+android:(?:icon|roundIcon)="[^"]*"/g, '')
      .replace('<application', '<application android:icon="@mipmap/pw_app_icon" android:roundIcon="@mipmap/pw_app_icon"'));
  if (updated === manifest) throw new Error('Could not set the icon in AndroidManifest.xml.');
  await fs.writeFile(file, updated);
}

async function iosIcon(project, catalog, raster) {
  const folder = path.join(catalog, 'AppIcon.appiconset');
  const info = { author: 'xcode', version: 1 };
  const catalogFile = path.join(project, catalog, 'Contents.json');
  if (!await fs.stat(catalogFile).then(() => true, () => false)) {
    await write(project, path.join(catalog, 'Contents.json'), JSON.stringify({ info }, null, 2) + '\n');
  }
  const contentsFile = path.join(project, folder, 'Contents.json');
  const original = await fs.readFile(contentsFile, 'utf8').then(JSON.parse, error => {
    if (error.code !== 'ENOENT') throw error;
  });
  const images = [];
  for (const item of original?.images || []) {
    const dimension = Math.round(parseFloat(item.size) * (parseFloat(item.scale) || 1));
    if (!(dimension >= 16 && dimension <= 1024)) continue;
    const filename = /^[a-zA-Z0-9._@ -]+\.png$/i.test(item.filename || '') ? item.filename :
      'Icon-' + dimension + '.png';
    await write(project, path.join(folder, filename), await raster.png(dimension, { opaque: true }));
    images.push({ ...item, filename });
  }
  if (!images.length) {
    const filename = 'Icon-1024.png';
    await write(project, path.join(folder, filename), await raster.png(1024, { opaque: true }));
    images.push({ idiom: 'universal', platform: 'ios', size: '1024x1024', filename });
  }
  await write(project, path.join(folder, 'Contents.json'), JSON.stringify({ images, info }, null, 2) + '\n');
}

async function configureMobileIcons(project, template, name, raster) {
  if (template.id === 'expo-mobile') {
    const file = path.join(project, 'app.json');
    const { expo, ...config } = JSON.parse(await fs.readFile(file, 'utf8'));
    await write(project, 'assets/app-icon.png', await raster.png(1024, { opaque: true }));
    await write(project, 'assets/adaptive-icon.png', await raster.png(1024, { inset: 0.6 }));
    expo.icon = './assets/app-icon.png';
    expo.android = { ...expo.android, adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#ffffff' } };
    await fs.writeFile(file, JSON.stringify({ ...config, expo }, null, 2) + '\n');
    return;
  }
  if (template.id === 'ios-swiftui') {
    await iosIcon(project, 'Sources/Assets.xcassets', raster);
    const file = path.join(project, 'project.yml');
    const spec = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, spec.replace('        GENERATE_INFOPLIST_FILE:',
      '        ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon\n        GENERATE_INFOPLIST_FILE:'));
    return;
  }
  if (template.id === 'react-native-mobile' || template.id === 'flutter-mobile') {
    await androidIcon(project, 'android/app/src/main', raster);
    const catalog = template.id === 'flutter-mobile' ? 'ios/Runner/Assets.xcassets' :
      path.join('ios', reactNativeIdentifier(name), 'Images.xcassets');
    await iosIcon(project, catalog, raster);
    return;
  }
  await androidIcon(project, 'src/main', raster);
}

module.exports = { configureMobileIcons };
