cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER___native LANGUAGES CXX)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Debug CACHE STRING "Build type for single-config generators" FORCE)
endif()

# Link the MSVC runtime into the bridge so the DLL can travel with the app.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
add_library(pw_native SHARED src/motion.cpp)
target_compile_features(pw_native PRIVATE cxx_std_17)
set_target_properties(pw_native PROPERTIES
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN YES
    RUNTIME_OUTPUT_DIRECTORY "$<1:${CMAKE_CURRENT_BINARY_DIR}/bin>"
    LIBRARY_OUTPUT_DIRECTORY "$<1:${CMAKE_CURRENT_BINARY_DIR}/bin>")
if(WIN32)
    set_target_properties(pw_native PROPERTIES PREFIX "")
endif()
