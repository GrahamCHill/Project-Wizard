include(FetchContent)
FetchContent_Declare(lua
    URL https://www.lua.org/ftp/lua-5.4.9.tar.gz
    URL_HASH SHA256=2335b6c582a52654f94612bf10d2f4672805d05329aa6568b1d8cd9e5c6fb8e6
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
FetchContent_MakeAvailable(lua)

file(GLOB lua_sources CONFIGURE_DEPENDS "${lua_SOURCE_DIR}/src/*.c")
list(FILTER lua_sources EXCLUDE REGEX "/(lua|luac|onelua)\\.c$")
add_library(lua_runtime STATIC ${lua_sources})
set_target_properties(lua_runtime PROPERTIES POSITION_INDEPENDENT_CODE ON)
target_include_directories(lua_runtime PUBLIC "${lua_SOURCE_DIR}/src")
if(UNIX)
    target_compile_definitions(lua_runtime PRIVATE LUA_USE_POSIX)
    target_link_libraries(lua_runtime PUBLIC m)
endif()
