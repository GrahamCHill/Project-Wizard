section .text

%ifidn __OUTPUT_FORMAT__, win32
global _assembly_add
_assembly_add:
%else
global assembly_add:function
assembly_add:
%endif
    ; The 32-bit C calling convention passes these arguments on the stack.
    mov eax, [esp + 4]
    add eax, [esp + 8]
    ret

%ifidn __OUTPUT_FORMAT__, elf32
section .note.GNU-stack noalloc noexec nowrite progbits
%endif
