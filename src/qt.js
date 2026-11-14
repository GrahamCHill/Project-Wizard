const qtVersions = [
  { id: 'qt6', label: 'Qt 6', minimum: '6.5' },
  { id: 'qt5', label: 'Qt 5', minimum: '5.15' }
];

const qtInterfaces = [
  { id: 'widgets', label: 'Widgets' },
  { id: 'quick', label: 'Quick (QML)' }
];

const qtStarter = {
  id: 'qt', label: 'Qt Desktop', group: 'desktop', kind: 'starter', language: 'C++', qt: true, cmakeTarget: 'app',
  description: 'A C++ desktop app using Qt Widgets or Qt Quick (QML). Choose Qt 5 or Qt 6 in Project setup.',
  tools: ['cmake', 'cpp-compiler'],
  requirement: 'CMake 3.24+, a compatible C++ compiler, and a Qt desktop kit.',
  next: 'Follow the build commands in README.md.'
};

function resolveQt(template, options) {
  const version = qtVersions.find(version => version.id === options.build) || qtVersions[0];
  const ui = options.renderer === 'quick' ? 'quick' : 'widgets';
  const quick = ui === 'quick';
  return {
    ...template, qtVersion: version, qtInterface: ui, sourceDirectory: 'qt-' + ui,
    files: ['CMakeLists.txt', 'src/main.cpp', 'gitignore', ...(quick ? ['Main.qml', ...(version.id === 'qt5' ? ['qml.qrc'] : [])] : [])],
    commands: ['cmake -S . -B build -DCMAKE_PREFIX_PATH="<Qt kit folder>"', 'cmake --build build --config Debug'],
    note: 'Use a Qt ' + version.minimum + '+ desktop kit from the selected Qt major that matches your compiler and architecture. ' +
      'Run the app from the build folder or open its app bundle on macOS. On Linux, install the matching Qt runtime and platform plugins on the destination.' +
      (quick ? ' Qt Quick also uses the QtQuick and QtQuick.Window QML modules.' : '')
  };
}

function renderQt(source, template) {
  const version = template.qtVersion;
  const version6 = version.id === 'qt6';
  return source.replaceAll('__QT_PACKAGE__', version6 ? 'Qt6' : 'Qt5')
    .replaceAll('__QT_ADD_EXECUTABLE__', version6 ? 'qt_add_executable' : 'add_executable')
    .replaceAll('__QT_QUICK_PROJECT__', version6 ?
      'qt_standard_project_setup(REQUIRES 6.5)\nqt_add_executable(app WIN32 MACOSX_BUNDLE src/main.cpp)\n' +
      'qt_add_qml_module(app URI ProjectStarter QML_FILES Main.qml)' :
      'add_executable(app WIN32 MACOSX_BUNDLE src/main.cpp qml.qrc)\nset_target_properties(app PROPERTIES AUTORCC ON)')
    .replaceAll('__QT_LOAD_QML__', version6 ?
      'engine.loadFromModule("ProjectStarter", "Main");' : 'engine.load(QUrl(QStringLiteral("qrc:/Main.qml")));')
    .replaceAll('__QT_MINIMUM__', version.minimum)
    .replaceAll('__QT_QML_IMPORTS__', version6 ? 'import QtQuick\nimport QtQuick.Window' : 'import QtQuick 2.15\nimport QtQuick.Window 2.15');
}

module.exports = { qtVersions, qtInterfaces, qtStarter, resolveQt, renderQt };
