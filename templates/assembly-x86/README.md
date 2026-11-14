# __PROJECT_NAME__

This is a 32-bit x86 console application. The C launcher and the CTest example both call `assembly_add` in `src/add.asm`. Use CMake 3.24+, NASM on PATH, and a 32-bit x86 C toolchain.

## Windows

Install the x86/x64 C++ build tools and Windows SDK in Visual Studio or Build Tools. These commands use the Visual Studio generator installed on your system.

~~~powershell
cmake -S . -B build -A Win32
cmake --build build --config Debug
ctest --test-dir build -C Debug --output-on-failure
.\build\Debug\app.exe
~~~

## Linux

On x86-64 Debian or Ubuntu, install the 32-bit development and runtime libraries with `sudo apt install build-essential gcc-multilib nasm cmake`. On a 32-bit x86 installation, use the native GCC and omit `-DCMAKE_C_FLAGS=-m32` if it is unnecessary.

~~~sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug -DCMAKE_C_FLAGS=-m32
cmake --build build
ctest --test-dir build --output-on-failure
./build/app
~~~

The app prints `40 + 2 = 42`. For macOS, choose the x86-64 or ARM64 starter.
