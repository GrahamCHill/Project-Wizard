# __PROJECT_NAME__

The console app calls `assembly_add` in `src/add.asm`. The same function is linked into a CTest example. The NASM source uses the Windows x64 and System V calling conventions and accounts for the Mach-O symbol prefix on Intel Macs.

Use an x86-64 C compiler, CMake 3.24+, and NASM on PATH. With a Visual Studio generator, add `-A x64` to the configure command. With other generators, use an x86-64 compiler or toolchain. On macOS, use the default Makefiles generator or Ninja.

~~~sh
cmake -S . -B build
cmake --build build --config Debug
ctest --test-dir build -C Debug --output-on-failure
~~~

Run `./build/app` with a single-configuration generator or `./build/Debug/app` with a multi-configuration generator. On Windows with Visual Studio, run `.\build\Debug\app.exe`. The app prints `40 + 2 = 42`.
