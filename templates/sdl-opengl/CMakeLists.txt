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
target_link_libraries(app PRIVATE SDL__SDL_MAJOR__::SDL__SDL_MAJOR__-static OpenGL::GL)

set(shader_directory "${CMAKE_CURRENT_BINARY_DIR}/generated")
file(MAKE_DIRECTORY "${shader_directory}")
foreach(stage IN ITEMS vert frag)
    set(shader "${CMAKE_CURRENT_SOURCE_DIR}/shaders/triangle.${stage}")
    set(header "${shader_directory}/triangle_${stage}.h")
    add_custom_command(OUTPUT "${header}"
        COMMAND "${CMAKE_COMMAND}" "-DINPUT=${shader}" "-DOUTPUT=${header}"
            "-DSYMBOL=triangle_${stage}" -DMODE=TEXT
            -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/EmbedShader.cmake"
        DEPENDS "${shader}" "${CMAKE_CURRENT_SOURCE_DIR}/cmake/EmbedShader.cmake"
        VERBATIM)
    target_sources(app PRIVATE "${header}")
endforeach()
target_include_directories(app PRIVATE "${shader_directory}")
