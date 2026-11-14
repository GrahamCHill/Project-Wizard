#include "assembly_add.h"
#include <zephyr/drivers/gpio.h>
#include <zephyr/kernel.h>

static const struct gpio_dt_spec led = GPIO_DT_SPEC_GET(DT_ALIAS(led0), gpios);

int main(void)
{
    if (!gpio_is_ready_dt(&led) || gpio_pin_configure_dt(&led, GPIO_OUTPUT_INACTIVE) < 0)
        return 1;

    const int delay_ms = assembly_add(200, 300);
    if (delay_ms != 500) {
        gpio_pin_set_dt(&led, 1);
        return 1;
    }

    for (;;) {
        if (gpio_pin_toggle_dt(&led) < 0)
            return 1;
        k_msleep(delay_ms);
    }
}
