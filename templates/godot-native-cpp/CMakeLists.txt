cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES CXX)

include(FetchContent)
set(GODOTCPP_API_VERSION "4.3" CACHE STRING "Minimum Godot API version")
set(GODOTCPP_BUILD_PROFILE "${CMAKE_CURRENT_SOURCE_DIR}/build_profile.json" CACHE FILEPATH "Binding classes")
FetchContent_Declare(godot_cpp
    URL https://codeload.github.com/godotengine/godot-cpp/tar.gz/refs/tags/10.0.0-stable
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
FetchContent_MakeAvailable(godot_cpp)

add_library(pw_native SHARED src/native.cpp)
target_compile_features(pw_native PRIVATE cxx_std_17)
target_link_libraries(pw_native PRIVATE godot::cpp)
set_target_properties(pw_native PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY "$<1:${CMAKE_CURRENT_SOURCE_DIR}/bin>"
    RUNTIME_OUTPUT_DIRECTORY "$<1:${CMAKE_CURRENT_SOURCE_DIR}/bin>"
)
