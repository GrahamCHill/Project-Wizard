cmake_minimum_required(VERSION 3.24)
find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(__PROJECT_IDENTIFIER__ LANGUAGES C ASM)

target_sources(app PRIVATE src/main.c src/add.S)
target_include_directories(app PRIVATE include)
