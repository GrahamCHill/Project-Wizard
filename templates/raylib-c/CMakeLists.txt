cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES __CMAKE_LANGUAGE__)

include(FetchContent)
set(BUILD_EXAMPLES OFF CACHE BOOL "Build Raylib examples")
if(EMSCRIPTEN)
    set(PLATFORM Web CACHE STRING "Raylib target platform" FORCE)
else()
    set(raylib_lookup FIND_PACKAGE_ARGS 6.0)
endif()
FetchContent_Declare(raylib
    URL https://github.com/raysan5/raylib/archive/refs/tags/6.0.tar.gz
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    ${raylib_lookup}
)
FetchContent_MakeAvailable(raylib)

add_executable(game src/main.__NATIVE_EXTENSION__)
target_compile_features(game PRIVATE __NATIVE_STANDARD__)
target_link_libraries(game PRIVATE raylib)
set_target_properties(game PROPERTIES OUTPUT_NAME "__PROJECT_NAME__")
