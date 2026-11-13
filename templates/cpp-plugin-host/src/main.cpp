#include "native_plugin.h"
#include <lua.hpp>

#include <fstream>
#include <iostream>
#include <iterator>
#include <memory>
#include <stdexcept>

namespace fs = std::filesystem;

static std::string lua_greeting(const fs::path &file)
{
    std::unique_ptr<lua_State, decltype(&lua_close)> state(luaL_newstate(), lua_close);
    if (!state) throw std::runtime_error("Could not create the Lua interpreter.");
    // No Lua standard libraries are needed by this example.
    std::ifstream input(file, std::ios::binary);
    if (!input) throw std::runtime_error("Could not open the Lua plugin.");
    const std::string source((std::istreambuf_iterator<char>(input)), std::istreambuf_iterator<char>());
    if (luaL_loadbufferx(state.get(), source.data(), source.size(), "plugin", "t") != LUA_OK ||
        lua_pcall(state.get(), 0, 1, 0) != LUA_OK) {
        const char *message = lua_tostring(state.get(), -1);
        throw std::runtime_error(message ? message : "Lua plugin failed.");
    }
    if (lua_type(state.get(), -1) != LUA_TSTRING)
        throw std::runtime_error("Lua plugin must return a string.");
    return lua_tostring(state.get(), -1);
}

int main(int argc, char **argv)
{
    try {
        const auto directory = argc > 1 ? fs::absolute(argv[1]) : executable_path().parent_path() / "plugins";
        for (const auto &file : plugin_files(directory)) {
            const auto extension = file.extension();
            if (extension != ".lua" && !is_native_plugin(file)) continue;
            try {
                const auto message = extension == ".lua" ? lua_greeting(file) : native_greeting(file);
                std::cout << file.filename().string() << ": " << message << '\n';
            } catch (const std::exception &error) {
                std::cerr << "Skipped " << file.filename().string() << ": " << error.what() << '\n';
            }
        }
        return 0;
    } catch (const std::exception &error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
