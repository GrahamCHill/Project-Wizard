    .syntax unified
    .thumb
    .text
    .balign 2
    .global assembly_add
    .type assembly_add, %function
    .thumb_func
assembly_add:
    adds r0, r0, r1
    bx lr
    .size assembly_add, . - assembly_add
    .section .note.GNU-stack,"",%progbits
