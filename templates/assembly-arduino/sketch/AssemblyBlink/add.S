    .text
    .global assembly_add8
    .type assembly_add8, @function
assembly_add8:
    /* AVR-GCC passes the two byte arguments in r24 and r22. */
    add r24, r22
    ret
    .size assembly_add8, . - assembly_add8
