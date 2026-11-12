# __PROJECT_NAME__

C# owns the window and rendering through Raylib-cs. The C++ bridge computes the circle’s position every frame through a C ABI. Edit the drawing in `Program.cs` and the movement in `native/src/motion.cpp`.

Install .NET 8 or newer, CMake 3.24 or newer, and a C++ compiler for the operating system where you will run the app. Put CMake on PATH or set the `CMakeExecutable` MSBuild property to its executable path. .NET builds the native library through CMake and copies it beside the managed app.

~~~sh
dotnet run
dotnet run -- --self-test
~~~

The second command calls the C++ function without opening a window. For a graphics run, the host needs a desktop session, an OpenGL driver, and the system libraries used by Raylib. Build and publish on the target OS and architecture.

See the [native bridge README](native/README.md) for selected CMake library examples and [Raylib-cs](https://github.com/raylib-cs/raylib-cs) for supported native platforms.
