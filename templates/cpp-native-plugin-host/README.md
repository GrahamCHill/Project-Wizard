# __PROJECT_NAME__

A C++17 host discovers shared libraries in `plugins/` beside the executable at startup. The sample library in `src/sample_plugin.cpp` exports the versioned C ABI declared in `include/plugin_api.h`. The host checks that version, calls `plugin_greet()`, and unloads the library after copying its result.

~~~sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build --config Debug --target app
~~~

Run `build/Debug/app` on Linux or macOS, or `build/Debug/app.exe` on Windows. The build puts the sample plugin beside the executable in `plugins/`. You should see the sample plugin's greeting.

To add a plugin, build a library for the host's operating system and architecture. Export `plugin_api_version()` and `plugin_greet()` as shown in the sample, then copy the resulting `.dll`, `.so`, or `.dylib` into `plugins/`. Restart the host to discover it, or pass the path to a different plugin directory as the first argument. The host reports incompatible libraries and continues to the next file. Only load plugins you trust because they execute in the host process.
