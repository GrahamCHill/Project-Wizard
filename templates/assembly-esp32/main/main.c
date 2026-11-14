#include <stdio.h>
#include "assembly_add.h"

void app_main(void)
{
    const int result = assembly_add(40, 2);
    printf("Assembly: 40 + 2 = %d (%s)\n", result, result == 42 ? "PASS" : "FAIL");
}
