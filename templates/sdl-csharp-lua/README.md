# __PROJECT_NAME__

This SDL3 desktop starter selects the **__SDL_BACKEND_LABEL__** renderer. C# owns the app loop and pause state, C++ owns SDL and renders each frame, and embedded Lua computes the moving block’s position. SDL’s 2D API keeps the same scene code across the three backends.

Use .NET 8+, CMake 3.24+, and a native C/C++ toolchain. __SDL_BACKEND_NOTE__

~~~sh
dotnet run
dotnet run -- --self-test
~~~

The self-test calls C++ and Lua without opening a window. In the app, press Space to pause and R to reload the deployed `scripts/behavior.lua` beside the executable. Edit that deployed script to see a change immediately. Edit the source copy for your next build.

The wizard links optional NuGet packages to the app and CMake libraries to the [native bridge](native/README.md).

## Distribution

Build on the target operating system and architecture.

~~~sh
dotnet publish -c Release --use-current-runtime --self-contained -o dist
~~~

Share the whole `dist/` directory. It includes the .NET runtime, the C++ library with SDL and Lua linked in, the Lua script, and the applicable graphics runtime files. The destination system supplies GPU drivers and platform graphics libraries.
