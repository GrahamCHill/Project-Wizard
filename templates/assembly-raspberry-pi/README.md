# __PROJECT_NAME__

An ARM64 userspace app for Raspberry Pi 3, 4, 5, Zero 2 W, and other models running 64-bit Raspberry Pi OS. The C app and its test call the AArch64 routine in `src/add.S`.

## Build on the Pi

Use a 64-bit Raspberry Pi OS installation (`dpkg --print-architecture` should print `arm64`). Install a C compiler and CMake 3.24 or newer.

~~~sh
sudo apt install build-essential cmake
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
ctest --test-dir build --output-on-failure
./build/app
~~~

## Cross-compile from Debian or Ubuntu

On Windows, use a WSL Ubuntu or Debian terminal. On macOS, use a Debian or Ubuntu VM, or build directly on the Pi over SSH.

~~~sh
sudo apt install cmake gcc-aarch64-linux-gnu libc6-dev-arm64-cross
cmake -S . -B build-pi -DCMAKE_TOOLCHAIN_FILE=cmake/RaspberryPi64.cmake
cmake --build build-pi
scp build-pi/app build-pi/test_add USER@PI_HOST:/home/USER/
~~~

Replace `USER` and `PI_HOST` with the Pi login and hostname. Run `./test_add` and `./app` on the Pi. A passing test exits with code `0`, and the app prints `40 + 2 = 42`. Use a cross-toolchain with a Linux C library compatible with the Pi’s OS release.
