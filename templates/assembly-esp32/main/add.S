    .text
    .balign 4
    .global assembly_add
    .type assembly_add, @function
assembly_add:
#if defined(__riscv)
    add a0, a0, a1
    ret
#elif defined(__XTENSA_CALL0_ABI__)
    add a2, a2, a3
    ret
#elif defined(__XTENSA__)
    entry sp, 16
    add a2, a2, a3
    retw
#else
#error "Choose an ESP32-C3 or ESP32 target."
#endif
    .size assembly_add, . - assembly_add
