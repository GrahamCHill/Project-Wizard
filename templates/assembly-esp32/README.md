# __PROJECT_NAME__

An ESP-IDF assembly project for the ESP32-C3 (RISC-V) and the original ESP32 (Xtensa). `main/add.S` contains the two implementations, selected by the target compiler. The firmware calls the routine and reports the result over the serial console.

## Build, flash, and monitor

Install and activate [ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c3/get-started/index.html) with toolchains for the targets you want. Use the ESP-IDF terminal or run the SDK's environment export script for your shell.

From the project folder, select and build for ESP32-C3.

~~~sh
idf.py set-target esp32c3
idf.py build
idf.py -p PORT flash monitor
~~~

For an original ESP32 board such as an ESP32-DevKitC, use `idf.py set-target esp32` before building. Changing target resets the build and active SDK configuration. Replace `PORT` with the board’s serial port. Look for `Assembly: 40 + 2 = 42 (PASS)` in the monitor, or press the board's reset button if the message has already scrolled by. Exit the monitor with `Ctrl+]`.
