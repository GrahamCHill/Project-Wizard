section .text

%ifidn __OUTPUT_FORMAT__, win64
global assembly_add
assembly_add:
    lea eax, [rcx + rdx]         ; Windows x64 arguments
%elifidn __OUTPUT_FORMAT__, macho64
global _assembly_add
_assembly_add:
    lea eax, [rdi + rsi]         ; macOS symbol prefix and System V arguments
%elifidn __OUTPUT_FORMAT__, elf64
global assembly_add:function
assembly_add:
    lea eax, [rdi + rsi]         ; System V arguments
%else
    %error "This example needs a 64-bit Windows, macOS, or Linux target."
%endif
    ret

%ifidn __OUTPUT_FORMAT__, elf64
section .note.GNU-stack noalloc noexec nowrite progbits
%endif
