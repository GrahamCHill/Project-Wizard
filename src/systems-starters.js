const assemblyFiles = {
  'systems/AssemblyApp.cmake': 'cmake/AssemblyApp.cmake',
  'systems/assembly_add.h': 'include/assembly_add.h',
  'systems/main.c': 'src/main.c',
  'systems/test_add.c': 'tests/test_add.c',
  'systems/board.gitignore': '.gitignore'
};

const aarch64Files = { ...assemblyFiles, 'systems/aarch64-add.S': 'src/add.S' };

const desktopAssembly = {
  group: 'systems', kind: 'starter', language: 'Assembly',
  description: 'A console app and CTest example that call the same assembly function.',
  next: 'Follow the build, test, and run commands in README.md.', sharedFiles: assemblyFiles
};

const nasmAssembly = {
  ...desktopAssembly, tools: ['cmake', 'c-compiler', 'nasm'],
  files: ['CMakeLists.txt', 'src/add.asm', 'README.md']
};

const boardAssembly = {
  group: 'systems', kind: 'starter', language: 'Assembly', platforms: ['win32', 'darwin', 'linux'],
  next: 'Follow the board setup and build instructions in README.md.'
};

const thumbFiles = {
  'systems/thumb-add.S': 'src/add.S',
  'systems/assembly_add.h': 'include/assembly_add.h',
  'systems/board.gitignore': '.gitignore'
};

const kernelModule = {
  group: 'systems', kind: 'starter', language: 'C', platforms: ['linux'],
  tools: ['gnu-make', 'c-compiler', 'linux-kernel-headers'],
  requirement: 'GNU Make, a C compiler, and a Linux kernel build tree with module support and matching headers.',
  next: 'Run make to build the module, then follow the steps in README.md to try it in a Linux VM.',
  files: ['Kbuild', 'src/module.c', 'README.md'],
  sharedFiles: { 'systems/KernelMakefile': 'Makefile', 'systems/kernel.gitignore': '.gitignore' }
};

const systemsStarters = [
  {
    ...nasmAssembly, id: 'assembly-x86', label: 'x86 Assembly (32-bit NASM)',
    platforms: ['win32', 'linux'], architectures: ['ia32', 'x64'], platformTools: { linux: ['x86-c-compiler'] },
    requirement: 'CMake 3.24+, NASM, and a C toolchain targeting 32-bit x86.'
  },
  {
    ...nasmAssembly, id: 'assembly-x64', label: 'x86-64 Assembly (NASM)',
    platforms: ['win32', 'darwin', 'linux'], architectures: ['x64'],
    requirement: 'An x86-64 toolchain with CMake 3.24+, NASM, and a C compiler.'
  },
  {
    ...desktopAssembly, id: 'assembly-arm64', label: 'ARM64 Assembly (Linux and macOS)',
    platforms: ['darwin', 'linux'], architectures: ['arm64'], tools: ['cmake', 'c-compiler'],
    requirement: 'An ARM64 Linux or Apple silicon macOS toolchain with CMake 3.24+ and Clang or GCC.',
    files: ['CMakeLists.txt', 'README.md'], sharedFiles: aarch64Files
  },
  {
    ...desktopAssembly, id: 'assembly-arm64-windows', label: 'ARM64 Assembly (Windows)',
    platforms: ['win32'], architectures: ['x64', 'arm64'], tools: ['cmake-3.26', 'arm64-visual-studio'],
    requirement: 'CMake 3.26+, Visual Studio ARM64 C++ build tools with armasm64, and a Windows SDK.',
    files: ['CMakeLists.txt', 'src/add.asm', 'README.md']
  },
  {
    ...boardAssembly, id: 'assembly-raspberry-pi', label: 'Raspberry Pi OS Assembly (ARM64)',
    description: 'An AArch64 console app for Raspberry Pi OS with native and Linux cross-build instructions.',
    tools: ['cmake', 'pi-arm64-compiler'],
    requirement: 'CMake 3.24+ and a native ARM64 compiler or a Linux AArch64 cross-toolchain with C development files.',
    files: ['CMakeLists.txt', 'cmake/RaspberryPi64.cmake', 'README.md'],
    sharedFiles: aarch64Files
  },
  {
    ...boardAssembly, id: 'assembly-pico', label: 'Raspberry Pi Pico / Pico 2 Assembly',
    description: 'A bare-metal Thumb routine drives the onboard LED on Raspberry Pi Pico and Pico 2.',
    tools: ['cmake', 'ninja', 'git', 'pico-sdk', 'arm-none-eabi'],
    requirement: 'Pico SDK 2.x, GNU Arm Embedded with Newlib, CMake 3.24+, Ninja, and Git.',
    files: ['CMakeLists.txt', 'src/main.c', 'README.md'], sharedFiles: thumbFiles
  },
  {
    ...boardAssembly, id: 'assembly-arduino', label: 'Arduino Uno R3 Assembly (AVR)',
    description: 'An AVR assembly routine sets the blink interval in a buildable Arduino sketch.',
    tools: ['arduino-cli', 'arduino-avr'], requirement: 'Arduino CLI and the Arduino AVR board core.',
    files: ['sketch/AssemblyBlink/AssemblyBlink.ino', 'sketch/AssemblyBlink/add.S', 'README.md'],
    sharedFiles: { 'systems/board.gitignore': '.gitignore' }
  },
  {
    ...boardAssembly, id: 'assembly-esp32', label: 'ESP32 Assembly (Xtensa / RISC-V)',
    description: 'An ESP-IDF serial example for ESP32 and ESP32-C3 that checks an assembly routine on the board.',
    tools: ['esp-idf'], requirement: 'An activated ESP-IDF environment with tools for ESP32 or ESP32-C3.',
    files: ['CMakeLists.txt', 'main/CMakeLists.txt', 'main/main.c', 'main/add.S', 'gitignore', 'README.md'],
    sharedFiles: { 'systems/assembly_add.h': 'main/assembly_add.h' }
  },
  {
    ...boardAssembly, id: 'assembly-zephyr', label: 'Zephyr Assembly (STM32 / Nordic)',
    description: 'A Thumb-powered LED example for the STM32 Nucleo-F401RE and Nordic nRF52840 DK.',
    tools: ['zephyr'], requirement: 'An activated Zephyr west workspace and Zephyr SDK with the ARM toolchain.',
    files: ['CMakeLists.txt', 'prj.conf', 'src/main.c', 'README.md'], sharedFiles: thumbFiles
  },
  {
    ...kernelModule, id: 'linux-kernel-hello', label: 'Linux Kernel Module',
    description: 'A loadable kernel module that writes to the kernel log when it loads and unloads.'
  },
  {
    ...kernelModule, id: 'linux-kernel-chardev', label: 'Linux Kernel Module (Character Device)',
    description: 'A loadable kernel module that exposes a read-only greeting through a character device.'
  }
];

module.exports = { systemsStarters };
