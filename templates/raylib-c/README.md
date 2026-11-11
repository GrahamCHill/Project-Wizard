# __PROJECT_NAME__

A desktop Raylib project using __NATIVE_LABEL__ and CMake. Install CMake 3.24+, a compatible compiler,
and the [system libraries for your platform](https://github.com/raysan5/raylib/wiki#development-platforms).

```sh
cmake -S . -B build
cmake --build build --config Debug
```

CMake uses an installed compatible Raylib or downloads Raylib 6.0 at configure time.
Launch `__PROJECT_NAME__` from `build/` or `build/Debug/`, depending on your generator.
The executable has the `.exe` extension on Windows.
