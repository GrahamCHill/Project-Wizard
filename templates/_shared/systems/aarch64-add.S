#if !defined(__aarch64__) && !defined(__arm64__)
#error "This example needs an ARM64 compiler."
#endif

#ifdef __APPLE__
#define ADD_SYMBOL _assembly_add
#else
#define ADD_SYMBOL assembly_add
#endif

    .text
    .p2align 2
    .globl ADD_SYMBOL
#ifdef __ELF__
    .type ADD_SYMBOL, %function
#endif
ADD_SYMBOL:
    add w0, w0, w1
    ret
#ifdef __ELF__
    .size ADD_SYMBOL, . - ADD_SYMBOL
    .section .note.GNU-stack,"",%progbits
#endif
