# __PROJECT_NAME__

The C++ host scans a `plugins/` directory next to the executable at launch. Native plugins export the C interface in `include/plugin_api.h` and return UTF-8 text. Lua plugins are `.lua` files that return a string. The host checks the native ABI version and reports failed loads while continuing to the next file.

~~~sh
cmake -S . -B build
cmake --build build --config Debug --target app
~~~

Run `build/app` on single-configuration builds without a build type, `build/Debug/app` when the build type is Debug, or `build/Debug/app.exe` with Visual Studio. The build puts the native and Lua samples beside the executable in `plugins/`. Drop compatible libraries into that directory and restart, or pass the path to a different plugin directory as the first argument. Use plugins you trust because they execute in the host process.
