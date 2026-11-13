# __PROJECT_NAME__

Use the **Circle controls** panel to change the size and color of the SFML shape. The sample uses SFML 3.1 and ImGui-SFML 3.0 with Dear ImGui 1.91.9b. The build pins these versions together for backend compatibility.

Use CMake 3.28+, a C++17 compiler, and Git. CMake fetches the libraries on the first configuration. On Debian or Ubuntu, install the graphics development packages before configuring.

~~~sh
sudo apt install pkg-config libx11-dev libxrandr-dev libxcursor-dev libxi-dev libudev-dev libgl1-mesa-dev libfreetype-dev libharfbuzz-dev
~~~

~~~sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build --config Debug
~~~

On Linux, run `./build/app`. With Visual Studio, run `.\build\Debug\app.exe`. On macOS, open the app bundle in `build/` or its configuration subfolder.
