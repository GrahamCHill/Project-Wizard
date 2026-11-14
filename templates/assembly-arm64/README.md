# __PROJECT_NAME__

The console app calls `assembly_add` in `src/add.S`. The same function is linked into a CTest example. It takes two integer arguments in `w0` and `w1` and returns the result in `w0`.

Use CMake 3.24+ and an ARM64 C compiler. On a 64-bit Debian or Ubuntu ARM system, install `build-essential` and `cmake`. On Apple silicon, run `xcode-select --install` and install CMake. The Mach-O build uses the macOS C symbol prefix and Apple Clang. The ELF build works with GCC or Clang targeting AArch64.

## Build and run on ARM64 Linux or Apple silicon

~~~sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
ctest --test-dir build --output-on-failure
./build/app
~~~

The app prints `40 + 2 = 42`. If configuring from a macOS terminal running under Rosetta, add `-DCMAKE_OSX_ARCHITECTURES=arm64` or use a native ARM64 terminal.
