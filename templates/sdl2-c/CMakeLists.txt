cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES __CMAKE_LANGUAGE__)

include(FetchContent)
set(SDL_SHARED OFF CACHE BOOL "Build SDL as a static library")
set(SDL_STATIC ON CACHE BOOL "Build SDL as a static library")
set(SDL_TESTS OFF CACHE BOOL "Build SDL's tests")
set(SDL_TEST_LIBRARY OFF CACHE BOOL "Build SDL's test library")
FetchContent_Declare(sdl2
    URL https://github.com/libsdl-org/SDL/releases/download/release-2.32.10/SDL2-2.32.10.tar.gz
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
FetchContent_MakeAvailable(sdl2)

add_executable(app src/main.__NATIVE_EXTENSION__)
target_compile_features(app PRIVATE __NATIVE_STANDARD__)
target_link_libraries(app PRIVATE SDL2::SDL2-static)
