#include <cstdio>
#include <memory>
#include <string>
#include <lua.hpp>
#include <raylib.h>
#include "starter.h"

int main()
{
    std::unique_ptr<lua_State, decltype(&lua_close)> lua(luaL_newstate(), lua_close);
    if (!lua) {
        std::fputs("Could not start Lua.\n", stderr);
        return 1;
    }
    luaL_openlibs(lua.get());

    const std::string script = std::string(GetApplicationDirectory()) + "message.lua";
    if (luaL_dofile(lua.get(), script.c_str()) != LUA_OK) {
        std::fprintf(stderr, "%s\n", lua_tostring(lua.get(), -1));
        return 1;
    }
    lua_getglobal(lua.get(), "message");
    lua_pushinteger(lua.get(), starter_add(2, 3));
    if (lua_pcall(lua.get(), 1, 1, 0) != LUA_OK || !lua_isstring(lua.get(), -1)) {
        std::fputs("The Lua message function must return text.\n", stderr);
        return 1;
    }
    const std::string message = lua_tostring(lua.get(), -1);

    InitWindow(640, 360, "__PROJECT_NAME__");
    SetTargetFPS(60);
    while (!WindowShouldClose()) {
        BeginDrawing();
        ClearBackground(RAYWHITE);
        DrawText(message.c_str(), 32, 150, 28, DARKBLUE);
        EndDrawing();
    }
    CloseWindow();
}
