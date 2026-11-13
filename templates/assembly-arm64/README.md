# __PROJECT_NAME__

The console app calls `assembly_add` in `src/add.S`. The same function is linked into a CTest example. It takes two integer arguments in `w0` and `w1` and returns the result in `w0`.

Use CMake 3.24+ and an ARM64 C compiler. On Apple silicon, install the Xcode Command Line Tools. On Linux, use GCC or Clang targeting AArch64.

~~~sh
cmake -S . -B build
cmake --build build --config Debug
ctest --test-dir build -C Debug --output-on-failure
~~~

Run `./build/app` with a single-configuration generator or `./build/Debug/app` with a multi-configuration generator. The app prints `40 + 2 = 42`.
