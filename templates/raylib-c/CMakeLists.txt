cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES C)

include(FetchContent)
set(BUILD_EXAMPLES OFF CACHE BOOL "Build Raylib examples")
FetchContent_Declare(raylib
    URL https://github.com/raysan5/raylib/archive/refs/tags/6.0.tar.gz
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    FIND_PACKAGE_ARGS 6.0
)
FetchContent_MakeAvailable(raylib)

add_executable(game src/main.c)
target_compile_features(game PRIVATE c_std_99)
target_link_libraries(game PRIVATE raylib)
set_target_properties(game PROPERTIES OUTPUT_NAME "__PROJECT_NAME__")
