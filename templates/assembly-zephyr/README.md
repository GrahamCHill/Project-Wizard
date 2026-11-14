# __PROJECT_NAME__

A Zephyr application for the STM32 Nucleo-F401RE and Nordic nRF52840 DK. It blinks the board’s `led0` using a delay calculated by the Thumb routine in `src/add.S`. The app checks the result before blinking.

## Build and flash

Follow Zephyr’s [Getting Started Guide](https://docs.zephyrproject.org/latest/develop/getting_started/index.html) to set up a west workspace, its Python environment, and the Zephyr SDK with ARM support. Activate the environment and run these commands from the workspace. Replace `APP_PATH` with the absolute path to this project.

~~~sh
west build -b nucleo_f401re -d build-f401re "APP_PATH"
west flash -d build-f401re
~~~

For the Nordic board, use a separate build directory.

~~~sh
west build -b nrf52840dk/nrf52840 -d build-nrf52840 "APP_PATH"
west flash -d build-nrf52840
~~~

Connect the board via its debug USB port and install the flash runner required by the board. STM32 uses ST-LINK with STM32CubeProgrammer by default. For the nRF52840 DK, use a runner supported by your Zephyr version, such as J-Link (`west flash -d build-nrf52840 -r jlink`). The user LED toggles every 500 ms. A solid LED indicates the assembly check failed.
