# __PROJECT_NAME__

Move the circle with the arrow keys. The sample uses SFML 3.1 for the window, input, and 2D rendering.

Use CMake 3.28+, a C++17 compiler, and Git. CMake fetches SFML and its build dependencies on the first configuration. On Debian or Ubuntu, install the graphics development packages before configuring.

~~~sh
sudo apt install pkg-config libx11-dev libxrandr-dev libxcursor-dev libxi-dev libudev-dev libgl1-mesa-dev libfreetype-dev libharfbuzz-dev
~~~

~~~sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build --config Debug
~~~

On Linux, run `./build/app`. With Visual Studio, run `.\build\Debug\app.exe`. On macOS, open the app bundle in `build/` or its configuration subfolder.
