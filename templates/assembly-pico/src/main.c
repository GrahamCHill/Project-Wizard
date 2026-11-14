#include "assembly_add.h"
#include "pico/stdlib.h"

int main(void)
{
    const uint led = PICO_DEFAULT_LED_PIN;
    gpio_init(led);
    gpio_set_dir(led, GPIO_OUT);
    const int delay_ms = assembly_add(200, 300);
    if (delay_ms != 500) {
        gpio_put(led, true);
        return 1;
    }

    for (;;) {
        gpio_put(led, true);
        sleep_ms((uint)delay_ms);
        gpio_put(led, false);
        sleep_ms((uint)delay_ms);
    }
}
