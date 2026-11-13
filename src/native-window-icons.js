const fs = require('node:fs/promises');
const path = require('node:path');

const sdlIcon = [
  '    #if SDL_MAJOR_VERSION >= 3',
  '    SDL_Surface *icon = SDL_CreateSurfaceFrom(48, 48, SDL_PIXELFORMAT_RGBA32, app_icon_pixels, 48 * 4);',
  '    #else',
  '    SDL_Surface *icon = SDL_CreateRGBSurfaceWithFormatFrom(app_icon_pixels, 48, 48, 32, 48 * 4, SDL_PIXELFORMAT_RGBA32);',
  '    #endif',
  '    if (icon) {',
  '        SDL_SetWindowIcon(window, icon);',
  '    #if SDL_MAJOR_VERSION >= 3',
  '        SDL_DestroySurface(icon);',
  '    #else',
  '        SDL_FreeSurface(icon);',
  '    #endif',
  '    }'
].join('\n');

function windowIconCode(template, build) {
  if (template.sfml) {
    return ['    window.setFramerateLimit(60);', '    window.setIcon(' +
      (build === 'sfml2' ? '48, 48' : '{48, 48}') + ', app_icon_pixels);'];
  }
  if (/^sdl[23]-/.test(template.id)) {
    const marker = template.id.includes('-vulkan-') ? '    VulkanApp app = { 0 };' :
      template.id.includes('-opengl-') ? '    SDL_GLContext context = SDL_GL_CreateContext(window);' :
        template.id.startsWith('sdl2-') ? '    SDL_Renderer *renderer = SDL_CreateRenderer' : '    SDL_SetRenderVSync';
    return [marker, sdlIcon, true];
  }
  if (template.group === 'raylib' || template.id === 'cpp-lua-desktop') {
    return ['    SetTargetFPS(60);', [
      '    Image icon = { app_icon_pixels, 48, 48, 1, PIXELFORMAT_UNCOMPRESSED_R8G8B8A8 };',
      '    SetWindowIcon(icon);'
    ].join('\n'), true];
  }
  if (['qt-widgets', 'qt-quick'].includes(template.id)) {
    const application = template.id === 'qt-widgets' ? 'QApplication' : 'QGuiApplication';
    return [`    ${application} application(argc, argv);`,
      '    application.setWindowIcon(QIcon(QPixmap::fromImage(QImage(app_icon_pixels, 48, 48, 48 * 4, QImage::Format_RGBA8888))));',
      false, '#include <QIcon>\n#include <QImage>\n#include <QPixmap>'];
  }
  if (template.id === 'wxwidgets') {
    return ['        auto *window = new MainWindow();', [
      '        wxImage image(48, 48);',
      '        image.InitAlpha();',
      '        for (int i = 0; i < 48 * 48; ++i) {',
      '            image.SetRGB(i % 48, i / 48, app_icon_pixels[i * 4], app_icon_pixels[i * 4 + 1], app_icon_pixels[i * 4 + 2]);',
      '            image.SetAlpha(i % 48, i / 48, app_icon_pixels[i * 4 + 3]);',
      '        }',
      '        wxIcon icon;',
      '        icon.CopyFromBitmap(wxBitmap(image));',
      '        window->SetIcon(icon);'
    ].join('\n')];
  }
}

async function configureNativeWindowIcon(project, template, build, raster) {
  const setup = windowIconCode(template, build);
  if (!setup) return;
  const [marker, code, before, includes] = setup;
  const file = path.join(project, 'src', template.language === 'C' ? 'main.c' : 'main.cpp');
  const source = await fs.readFile(file, 'utf8');
  if (!source.includes(marker)) throw new Error('Could not configure the app window icon in ' + file + '.');
  const rgba = await raster.rgba(48);
  const lines = [];
  for (let offset = 0; offset < rgba.length; offset += 16) {
    lines.push('    ' + [...rgba.subarray(offset, offset + 16)].join(', ') + ',');
  }
  await fs.writeFile(path.join(project, 'src', 'app_icon.h'),
    ['#pragma once', '', 'static unsigned char app_icon_pixels[] = {', ...lines, '};', ''].join('\n'), { flag: 'wx' });
  const updated = source.replace(marker, before ? code + '\n' + marker : marker + '\n' + code);
  await fs.writeFile(file, '#include "app_icon.h"\n' + (includes ? includes + '\n' : '') + updated);
}

module.exports = { configureNativeWindowIcon };
