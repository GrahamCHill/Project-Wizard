#include <stdint.h>

extern "C" uint8_t assembly_add8(uint8_t left, uint8_t right);

static uint8_t blink_delay;

void setup()
{
    pinMode(LED_BUILTIN, OUTPUT);
    blink_delay = assembly_add8(100, 150);
}

void loop()
{
    digitalWrite(LED_BUILTIN, HIGH);
    if (blink_delay != 250) return;
    delay(blink_delay);
    digitalWrite(LED_BUILTIN, LOW);
    delay(blink_delay);
}
