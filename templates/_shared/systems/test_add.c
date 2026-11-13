#include "assembly_add.h"
#include <stdio.h>

int main(void)
{
    int result = assembly_add(7, -3);
    if (result != 4) {
        fprintf(stderr, "assembly_add(7, -3) returned %d, expected 4\n", result);
        return 1;
    }
    return 0;
}
