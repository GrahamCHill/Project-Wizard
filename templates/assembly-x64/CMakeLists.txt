cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES C ASM_NASM)

set(ASSEMBLY_SOURCE src/add.asm)
include(cmake/AssemblyApp.cmake)
