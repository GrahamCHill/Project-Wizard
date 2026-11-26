cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES C)

include(FetchContent)
include(CTest)

# yyjson reads the glTF file's JSON. Raylib is the window, the graphics, and the input.
set(YYJSON_BUILD_TESTS OFF CACHE BOOL "")
set(YYJSON_BUILD_MISC OFF CACHE BOOL "")
FetchContent_Declare(yyjson
    URL https://github.com/ibireme/yyjson/archive/refs/tags/0.13.0.tar.gz
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
set(BUILD_EXAMPLES OFF CACHE BOOL "Build Raylib examples")
FetchContent_Declare(raylib
    URL https://github.com/raysan5/raylib/archive/refs/tags/6.0.tar.gz
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    FIND_PACKAGE_ARGS 6.0
)
FetchContent_MakeAvailable(yyjson raylib)

# The world loader and the player know nothing about Raylib, so the tests can run without a window or a graphics card.
add_library(world STATIC src/world.c src/player.c)
target_include_directories(world PUBLIC src)
target_compile_features(world PUBLIC c_std_99)
target_link_libraries(world PUBLIC yyjson)
if(NOT WIN32)
    target_link_libraries(world PUBLIC m)
endif()

add_executable(game src/main.c)
target_link_libraries(game PRIVATE world raylib)
set_target_properties(game PROPERTIES OUTPUT_NAME "__PROJECT_NAME__")

# Copy the assets next to the program, so it runs from the build folder.
add_custom_command(TARGET game POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory "${CMAKE_CURRENT_SOURCE_DIR}/assets" "$<TARGET_FILE_DIR:game>/assets")

if(BUILD_TESTING)
    add_executable(world_test tests/world_test.c)
    target_link_libraries(world_test PRIVATE world)
    add_test(NAME world COMMAND world_test "${CMAKE_CURRENT_SOURCE_DIR}/assets/world.gltf"
        WORKING_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}")
endif()
