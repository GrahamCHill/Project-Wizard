# __PROJECT_NAME__

An AVR assembly sketch for the Arduino Uno R3 (ATmega328P). `sketch/AssemblyBlink/add.S` calculates a blink delay that the Arduino sketch checks before using it. The nested sketch folder lets the outer project name contain spaces while keeping the `.ino` filename matched to its folder.

## Build and upload with Arduino CLI

Install [Arduino CLI](https://arduino.github.io/arduino-cli/latest/installation/). Install the AVR board core and compile from the generated project folder.

~~~sh
arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli compile --fqbn arduino:avr:uno --build-path build sketch/AssemblyBlink
arduino-cli board list
arduino-cli upload --port PORT --fqbn arduino:avr:uno --input-dir build sketch/AssemblyBlink
~~~

Substitute the board’s port for `PORT`, for example `COM3`, `/dev/ttyACM0`, or `/dev/cu.usbmodem1101`. The onboard LED turns on and off every 250 ms. A solid LED indicates the assembly check failed.

You can also open `sketch/AssemblyBlink/AssemblyBlink.ino` in Arduino IDE. Select **Arduino Uno** under **Arduino AVR Boards**, select the port, and use **Verify** or **Upload**.
