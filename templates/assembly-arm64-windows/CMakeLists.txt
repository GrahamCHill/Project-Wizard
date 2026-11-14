cmake_minimum_required(VERSION 3.26)
project(__PROJECT_IDENTIFIER__ LANGUAGES C)

if(NOT CMAKE_C_COMPILER_ARCHITECTURE_ID STREQUAL "ARM64")
    message(FATAL_ERROR "Configure a Visual Studio build with -A ARM64 as shown in README.md.")
endif()
enable_language(ASM_MARMASM)

set(ASSEMBLY_SOURCE src/add.asm)
include(cmake/AssemblyApp.cmake)
