        AREA |.text|, CODE, READONLY
        EXPORT assembly_add

assembly_add PROC
        add w0, w0, w1
        ret
        ENDP

        END
