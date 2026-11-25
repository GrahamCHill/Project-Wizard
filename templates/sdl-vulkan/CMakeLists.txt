cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES __CMAKE_LANGUAGE__)

find_package(Vulkan 1.3.216 REQUIRED)
if(TARGET Vulkan::glslc)
    set(shader_compiler Vulkan::glslc)
    set(shader_flags --target-env=vulkan1.1)
elseif(TARGET Vulkan::glslangValidator)
    set(shader_compiler Vulkan::glslangValidator)
    set(shader_flags -V --target-env vulkan1.1)
else()
    message(FATAL_ERROR "Install glslc or glslangValidator (included in the Vulkan SDK) to compile the shaders.")
endif()

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

add_executable(app src/main.__NATIVE_EXTENSION__)
target_compile_features(app PRIVATE __NATIVE_STANDARD__)
target_link_libraries(app PRIVATE SDL__SDL_MAJOR__::SDL__SDL_MAJOR__-static Vulkan::Vulkan)

set(shader_directory "${CMAKE_CURRENT_BINARY_DIR}/generated")
file(MAKE_DIRECTORY "${shader_directory}")
foreach(stage IN ITEMS vert frag)
    set(shader "${CMAKE_CURRENT_SOURCE_DIR}/shaders/triangle.${stage}")
    set(spirv "${shader_directory}/triangle.${stage}.spv")
    set(header "${shader_directory}/triangle_${stage}.h")
    add_custom_command(OUTPUT "${header}"
        BYPRODUCTS "${spirv}"
        COMMAND $<TARGET_FILE:${shader_compiler}> ${shader_flags} "${shader}" -o "${spirv}"
        COMMAND "${CMAKE_COMMAND}" "-DINPUT=${spirv}" "-DOUTPUT=${header}"
            "-DSYMBOL=triangle_${stage}" -DMODE=SPIRV
            -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/EmbedShader.cmake"
        DEPENDS "${shader}" "${CMAKE_CURRENT_SOURCE_DIR}/cmake/EmbedShader.cmake"
        VERBATIM)
    target_sources(app PRIVATE "${header}")
endforeach()
target_include_directories(app PRIVATE "${shader_directory}")
