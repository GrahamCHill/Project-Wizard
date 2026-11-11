cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES __CMAKE_LANGUAGE__)

if(ANDROID)
    include(FetchContent)
    set(PLATFORM Android CACHE STRING "Raylib platform")
    set(BUILD_EXAMPLES OFF CACHE BOOL "Build Raylib examples")
    set(WITH_PIC ON CACHE BOOL "Link static Raylib into NativeActivity")
    FetchContent_Declare(raylib
        URL https://github.com/raysan5/raylib/archive/refs/tags/6.2.tar.gz
        DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    )
    FetchContent_MakeAvailable(raylib)

    add_library(game SHARED src/main.__NATIVE_EXTENSION__)
    target_compile_features(game PRIVATE __NATIVE_STANDARD__)
    target_link_libraries(game PRIVATE raylib android)
    target_link_options(game PRIVATE "LINKER:-u,ANativeActivity_onCreate")
endif()
