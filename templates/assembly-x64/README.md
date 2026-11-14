# __PROJECT_NAME__

The console app calls `assembly_add` in `src/add.asm`. The same function is linked into a CTest example. The NASM source uses the Windows x64 and System V calling conventions and accounts for the Mach-O symbol prefix on Intel Macs.

Use an x86-64 C compiler, CMake 3.24+, and NASM on PATH.

## Windows

Install Visual Studio or Build Tools with the C++ desktop workload and Windows SDK, then use a Visual Studio generator.

~~~powershell
cmake -S . -B build -A x64
cmake --build build --config Debug
ctest --test-dir build -C Debug --output-on-failure
.\build\Debug\app.exe
~~~

## Linux and Intel macOS

On Debian or Ubuntu, install `build-essential`, `cmake`, and `nasm`. On macOS, install the Xcode Command Line Tools with `xcode-select --install`, then install CMake and NASM. Use CMake's default Makefiles generator or Ninja on macOS.

~~~sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
ctest --test-dir build --output-on-failure
./build/app
~~~

The app prints `40 + 2 = 42`.
