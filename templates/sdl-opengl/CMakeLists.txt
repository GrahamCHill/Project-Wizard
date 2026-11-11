cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES __CMAKE_LANGUAGE__)

include(FetchContent)
set(SDL_SHARED OFF CACHE BOOL "Build SDL as a static library")
set(SDL_STATIC ON CACHE BOOL "Build SDL as a static library")
set(SDL_TESTS OFF CACHE BOOL "Build SDL's tests")
set(SDL_TEST_LIBRARY OFF CACHE BOOL "Build SDL's test library")
FetchContent_Declare(sdl__SDL_MAJOR__
    URL https://github.com/libsdl-org/SDL/releases/download/release-__SDL_VERSION__/SDL__SDL_MAJOR__-__SDL_VERSION__.tar.gz
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
FetchContent_MakeAvailable(sdl__SDL_MAJOR__)

find_package(OpenGL REQUIRED)

add_executable(app src/main.__NATIVE_EXTENSION__)
target_compile_features(app PRIVATE __NATIVE_STANDARD__)
target_compile_definitions(app PRIVATE STARTER_SDL_MAJOR=__SDL_MAJOR__)
target_link_libraries(app PRIVATE SDL__SDL_MAJOR__::SDL__SDL_MAJOR__-static OpenGL::GL)
