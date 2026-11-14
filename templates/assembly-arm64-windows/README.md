# __PROJECT_NAME__

This Windows ARM64 console project calls `assembly_add` in `src/add.asm` from C. The same function is called by the CTest example. Microsoft `armasm64` assembles the function into an ARM64 COFF object. The two integer arguments arrive in `w0` and `w1`, and the result is returned in `w0`.

Install CMake 3.26+, Visual Studio or Build Tools with the ARM64 C++ build tools, and a Windows SDK. Use the Visual Studio generator and select `ARM64` as the target architecture. You can build on x64 Windows with the ARM64 cross-tools and run the output on Windows ARM64.

~~~powershell
cmake -S . -B build -A ARM64
cmake --build build --config Debug
~~~

On Windows ARM64, run the tests and console app. The app prints `40 + 2 = 42`.

~~~powershell
ctest --test-dir build -C Debug --output-on-failure
.\build\Debug\app.exe
~~~
