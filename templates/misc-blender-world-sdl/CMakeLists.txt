cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES C)

include(FetchContent)
include(CTest)

# yyjson reads the glTF file's JSON. SDL is the window, the keyboard and mouse, and the way pixels reach the screen.
set(YYJSON_BUILD_TESTS OFF CACHE BOOL "")
set(YYJSON_BUILD_MISC OFF CACHE BOOL "")
FetchContent_Declare(yyjson
    URL https://github.com/ibireme/yyjson/archive/refs/tags/0.13.0.tar.gz
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
set(SDL_SHARED OFF CACHE BOOL "Build SDL as a static library")
set(SDL_STATIC ON CACHE BOOL "Build SDL as a static library")
set(SDL_TESTS OFF CACHE BOOL "Build SDL's tests")
set(SDL_TEST_LIBRARY OFF CACHE BOOL "Build SDL's test library")
FetchContent_Declare(sdl3
    URL https://github.com/libsdl-org/SDL/releases/download/release-3.4.16/SDL3-3.4.16.tar.gz
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
FetchContent_MakeAvailable(yyjson sdl3)

# The loader, the player, and the renderer know nothing about SDL, so the tests run without a window or a graphics card.
add_library(world STATIC src/world.c src/player.c src/raster.c)
target_include_directories(world PUBLIC src)
target_compile_features(world PUBLIC c_std_99)
target_link_libraries(world PUBLIC yyjson)
if(NOT WIN32)
    target_link_libraries(world PUBLIC m)
endif()

add_executable(game src/main.c)
target_link_libraries(game PRIVATE world SDL3::SDL3-static)
set_target_properties(game PROPERTIES OUTPUT_NAME "__PROJECT_NAME__")
if(WIN32)
    set_target_properties(game PROPERTIES WIN32_EXECUTABLE ON)
endif()

# Copy the assets next to the program, so it runs from the build folder.
add_custom_command(TARGET game POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory "${CMAKE_CURRENT_SOURCE_DIR}/assets" "$<TARGET_FILE_DIR:game>/assets")

if(BUILD_TESTING)
    set(world_file "${CMAKE_CURRENT_SOURCE_DIR}/assets/world.gltf")
    add_executable(world_test tests/world_test.c)
    target_link_libraries(world_test PRIVATE world)
    add_test(NAME world COMMAND world_test "${world_file}" WORKING_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}")
    add_executable(raster_test tests/raster_test.c)
    target_link_libraries(raster_test PRIVATE world)
    add_test(NAME raster COMMAND raster_test "${world_file}" WORKING_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}")
endif()
