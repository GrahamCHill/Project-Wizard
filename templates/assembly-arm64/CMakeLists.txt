cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES C ASM)

set(ASSEMBLY_SOURCE src/add.S)
include(cmake/AssemblyApp.cmake)
