cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES C CXX)

include(FetchContent)
set(BUILD_EXAMPLES OFF CACHE BOOL "Build Raylib examples")
FetchContent_Declare(raylib
    URL https://codeload.github.com/raysan5/raylib/tar.gz/refs/tags/6.0
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    FIND_PACKAGE_ARGS 6.0
)
FetchContent_Declare(lua
    URL https://www.lua.org/ftp/lua-5.4.9.tar.gz
    URL_HASH SHA256=2335b6c582a52654f94612bf10d2f4672805d05329aa6568b1d8cd9e5c6fb8e6
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
FetchContent_MakeAvailable(raylib lua)
file(GLOB lua_sources CONFIGURE_DEPENDS "${lua_SOURCE_DIR}/src/*.c")
list(FILTER lua_sources EXCLUDE REGEX "/(lua|luac|onelua)\\.c$")
add_library(lua_runtime STATIC ${lua_sources})
target_include_directories(lua_runtime PUBLIC "${lua_SOURCE_DIR}/src")
if(UNIX)
    target_compile_definitions(lua_runtime PRIVATE LUA_USE_POSIX)
    target_link_libraries(lua_runtime PUBLIC m)
endif()

add_executable(app src/main.cpp)
target_compile_features(app PRIVATE cxx_std_17)
target_link_libraries(app PRIVATE raylib lua_runtime)

add_custom_target(copy_script
    COMMAND "${CMAKE_COMMAND}" -E make_directory "$<TARGET_FILE_DIR:app>"
    COMMAND "${CMAKE_COMMAND}" -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/scripts/message.lua" "$<TARGET_FILE_DIR:app>/message.lua"
    VERBATIM
)
add_dependencies(app copy_script)
