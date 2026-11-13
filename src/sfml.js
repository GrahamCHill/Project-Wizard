const sfmlVersions = [
  {
    id: 'sfml3', label: 'SFML 3.1.0', version: '3.1.0',
    tools: ['cmake-3.28', 'cpp-compiler', 'git'], platformTools: { linux: ['sfml-desktop'] },
    requirement: 'CMake 3.28+, a C++17 compiler, Git, and SFML 3 development dependencies on Linux.',
    tokens: {
      SFML_HASH: '91209a112c2bd0bc6f4ce0d5f3e413cfb48b57c0de59f5507dc81f71b1ad7a5c',
      SFML_GRAPHICS_TARGET: 'SFML::Graphics', SFML_IMGUI_VERSION: '3.0',
      SFML_IMGUI_HASH: '561a04407dcc913b8f1c25a164ad4907852b51fb4f11907d1ab9db6351af911b',
      SFML_DEAR_IMGUI_VERSION: '1.91.9b', SFML_DEAR_IMGUI_HASH: '8e1bbc76c71d74fef2fb85db7e7ca8eba13d6a86623c54992b60162db554ffdb',
      SFML_LINUX_EXTRA: ' libxi-dev libharfbuzz-dev', SFML_GIT_REQUIREMENT: ' and Git',
      SFML_LEGACY_POLICIES: '', SFML_WINDOW_MODE: 'sf::VideoMode({800, 500})',
      SFML_POLL_EVENT: 'while (const auto event = window.pollEvent())', SFML_EVENT_VALUE: '*event',
      SFML_CLOSED: 'event->is<sf::Event::Closed>()', SFML_KEY: 'sf::Keyboard::Key'
    }
  },
  {
    id: 'sfml2', label: 'SFML 2.6.2', version: '2.6.2',
    tools: ['cmake-3.28', 'cpp-compiler'], platformTools: { linux: ['sfml2-desktop'] },
    requirement: 'CMake 3.28+, a C++17 compiler, and SFML 2 development dependencies on Linux.',
    tokens: {
      SFML_HASH: '15ff4d608a018f287c6a885db0a2da86ea389e516d2323629e4d4407a7ce047f',
      SFML_GRAPHICS_TARGET: 'sfml-graphics', SFML_IMGUI_VERSION: '2.6',
      SFML_IMGUI_HASH: 'b1195ca1210dd46c8049cfc8cae7f31cd34f1591da7de1c56297b277ac9c5cc0',
      SFML_DEAR_IMGUI_VERSION: '1.89.9', SFML_DEAR_IMGUI_HASH: '1acc27a778b71d859878121a3f7b287cd81c29d720893d2b2bf74455bf9d52d6',
      SFML_LINUX_EXTRA: '', SFML_GIT_REQUIREMENT: '',
      SFML_LEGACY_POLICIES: '# Keep the legacy SFML and ImGui-SFML CMake files usable with CMake 4.\nset(CMAKE_POLICY_VERSION_MINIMUM 3.10)\n',
      SFML_WINDOW_MODE: 'sf::VideoMode(800, 500)',
      SFML_POLL_EVENT: 'sf::Event event{};\n        while (window.pollEvent(event))', SFML_EVENT_VALUE: 'event',
      SFML_CLOSED: 'event.type == sf::Event::Closed', SFML_KEY: 'sf::Keyboard'
    }
  }
];

function renderSfml(text, selection) {
  const { version, tokens } = sfmlVersions.find(item => item.id === selection) || sfmlVersions[0];
  const replacements = { ...tokens, SFML_VERSION: version };
  return text.replace(/__(SFML_[A-Z_]+)__/g, (match, key) => replacements[key] ?? match);
}

module.exports = { sfmlVersions, renderSfml };
