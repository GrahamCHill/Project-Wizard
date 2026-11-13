const assemblyFiles = {
  'systems/AssemblyApp.cmake': 'cmake/AssemblyApp.cmake',
  'systems/assembly_add.h': 'include/assembly_add.h',
  'systems/main.c': 'src/main.c',
  'systems/test_add.c': 'tests/test_add.c',
  'systems/assembly.gitignore': '.gitignore'
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
    id: 'assembly-x64', group: 'systems', kind: 'starter', language: 'Assembly', label: 'x86-64 Assembly (NASM)',
    description: 'An assembly function called from a C console app, with a test that calls the same function.',
    platforms: ['win32', 'darwin', 'linux'], architectures: ['x64'], tools: ['cmake', 'c-compiler', 'nasm'],
    requirement: 'An x86-64 toolchain with CMake 3.24+, NASM, and a C compiler.',
    next: 'Build and test the project using README.md.',
    files: ['CMakeLists.txt', 'src/add.asm', 'README.md'], sharedFiles: assemblyFiles
  },
  {
    id: 'assembly-arm64', group: 'systems', kind: 'starter', language: 'Assembly', label: 'ARM64 Assembly',
    description: 'An AArch64 assembly function called from a C console app, with a test that calls the same function.',
    platforms: ['darwin', 'linux'], architectures: ['arm64'], tools: ['cmake', 'c-compiler'],
    requirement: 'An ARM64 Linux or Apple silicon macOS toolchain with CMake 3.24+ and Clang or GCC.',
    next: 'Build and test the project using README.md.',
    files: ['CMakeLists.txt', 'src/add.S', 'README.md'], sharedFiles: assemblyFiles
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
