# Native bridge

`src/motion.cpp` exports the C ABI used by `../NativeMotion.cs`. The .NET project configures and builds this directory automatically. Optional CMake libraries selected in Project Wizard are linked to the `pw_native` target.
