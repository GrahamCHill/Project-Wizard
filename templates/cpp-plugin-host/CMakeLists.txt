cmake_minimum_required(VERSION 3.24)
if(POLICY CMP0168)
    cmake_policy(SET CMP0168 NEW)
endif()
project(__PROJECT_IDENTIFIER__ LANGUAGES C CXX)

include(cmake/Lua.cmake)
include(cmake/PluginHost.cmake)
target_link_libraries(app PRIVATE lua_runtime)

add_custom_target(copy_lua
    COMMAND "${CMAKE_COMMAND}" -E make_directory "$<TARGET_FILE_DIR:app>/plugins"
    COMMAND "${CMAKE_COMMAND}" -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/plugins/greeting.lua" "$<TARGET_FILE_DIR:app>/plugins/greeting.lua"
    VERBATIM)
add_dependencies(app copy_lua)
