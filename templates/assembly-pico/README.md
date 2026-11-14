# __PROJECT_NAME__

Bare-metal Thumb assembly for the Raspberry Pi Pico (RP2040) and the Arm cores of Pico 2 (RP2350). The C code uses the SDK to blink the onboard LED. The routine in `src/add.S` computes the delay and the app checks it at startup. Use the non-wireless Pico or Pico 2 board.

## Install the toolchain

Install CMake 3.24+, Ninja, Git, and the Arm GNU bare-metal toolchain with Newlib. On Debian or Ubuntu, install `cmake ninja-build git gcc-arm-none-eabi libnewlib-arm-none-eabi libstdc++-arm-none-eabi-newlib`. The [Pico C/C++ SDK guide](https://www.raspberrypi.com/documentation/microcontrollers/c_sdk.html) covers setup on Windows, macOS, and Linux.

From the generated project folder, put the SDK next to the project or use an existing checkout. Pico 2 requires Pico SDK 2.x.

~~~sh
git clone --branch 2.3.1 --recurse-submodules https://github.com/raspberrypi/pico-sdk.git ../pico-sdk
~~~

## Build and flash

~~~sh
cmake -S . -B build-pico -G Ninja -DPICO_SDK_PATH=../pico-sdk -DPICO_BOARD=pico
cmake --build build-pico
~~~

For Pico 2, build into a separate folder with `cmake -S . -B build-pico2 -G Ninja -DPICO_SDK_PATH=../pico-sdk -DPICO_BOARD=pico2` and `cmake --build build-pico2`.

Hold **BOOTSEL** while connecting the board over USB. Copy the matching `assembly_blink.uf2` from its build folder onto the mounted drive. The board reboots and its LED blinks every half-second. A solid LED indicates the assembly check failed.
