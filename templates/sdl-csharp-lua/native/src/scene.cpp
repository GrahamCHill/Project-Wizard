#define SDL_MAIN_HANDLED
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>
#include <lua.hpp>

#if defined(_WIN32)
#define PW_EXPORT __declspec(dllexport)
#else
#define PW_EXPORT __attribute__((visibility("default")))
#endif

namespace {
SDL_Window *window = nullptr;
SDL_Renderer *renderer = nullptr;
lua_State *script = nullptr;

int fail(const char *message)
{
    SDL_LogError(SDL_LOG_CATEGORY_APPLICATION, "%s", message ? message : "Lua returned a non-string error");
    return 0;
}
}

extern "C" PW_EXPORT int pw_load_script(const char *source)
{
    lua_State *candidate = luaL_newstate();
    if (!candidate) return fail("Could not allocate a Lua state");
    // The sample needs only the Lua language and receives no filesystem or process API.
    if (luaL_loadbufferx(candidate, source, SDL_strlen(source), "behavior.lua", "t") != LUA_OK ||
        lua_pcall(candidate, 0, 0, 0) != LUA_OK) {
        fail(lua_tostring(candidate, -1));
        lua_close(candidate);
        return 0;
    }
    lua_getglobal(candidate, "update");
    const bool has_update = lua_isfunction(candidate, -1);
    lua_pop(candidate, 1);
    if (!has_update) {
        lua_close(candidate);
        return fail("The Lua script must define update(position, ticks)");
    }

    if (script) lua_close(script);
    script = candidate;
    return 1;
}

extern "C" PW_EXPORT int pw_advance(int position, int ticks)
{
    if (!script) return -1;
    lua_getglobal(script, "update");
    lua_pushinteger(script, position);
    lua_pushinteger(script, ticks);
    if (lua_pcall(script, 2, 1, 0) != LUA_OK) {
        fail(lua_tostring(script, -1));
        lua_pop(script, 1);
        return -1;
    }
    int is_integer = 0;
    const auto value = lua_tointegerx(script, -1, &is_integer);
    lua_pop(script, 1);
    if (!is_integer || value < 0 || value >= 100) {
        fail("Lua update must return an integer from 0 to 99");
        return -1;
    }
    return static_cast<int>(value);
}

extern "C" PW_EXPORT int pw_open(const char *title, const char *icon, const char *vulkan_loader)
{
    SDL_SetMainReady();
    if (*vulkan_loader && SDL_strcmp(PW_SDL_BACKEND, "vulkan") == 0)
        SDL_SetHint(SDL_HINT_VULKAN_LIBRARY, vulkan_loader);
    if (!SDL_Init(SDL_INIT_VIDEO)) return fail(SDL_GetError());
    window = SDL_CreateWindow(title, 800, 450, SDL_WINDOW_RESIZABLE);
    if (!window) return fail(SDL_GetError());
    if (*icon) {
        if (SDL_Surface *image = SDL_LoadPNG(icon)) {
            SDL_SetWindowIcon(window, image);
            SDL_DestroySurface(image);
        }
    }
    renderer = SDL_CreateRenderer(window, PW_SDL_BACKEND);
    if (!renderer) return fail(SDL_GetError());
    SDL_Log("SDL renderer: %s", SDL_GetRendererName(renderer));
    SDL_SetRenderVSync(renderer, 1);
    return 1;
}

extern "C" PW_EXPORT int pw_events()
{
    int actions = 0;
    SDL_Event event;
    while (SDL_PollEvent(&event)) {
        if (event.type == SDL_EVENT_QUIT) actions |= 1;
        if (event.type != SDL_EVENT_KEY_DOWN || event.key.repeat) continue;
        if (event.key.key == SDLK_ESCAPE) actions |= 1;
        if (event.key.key == SDLK_SPACE) actions ^= 2;
        if (event.key.key == SDLK_R) actions |= 4;
    }
    return actions;
}

extern "C" PW_EXPORT int pw_draw(int position, int paused)
{
    int width, height;
    if (!SDL_GetCurrentRenderOutputSize(renderer, &width, &height)) return fail(SDL_GetError());
    const SDL_FRect block{width * (0.08f + 0.76f * position / 100.0f), height * 0.48f, 52, 52};
    if (!SDL_SetRenderDrawColor(renderer, 24, 31, 46, 255) || !SDL_RenderClear(renderer) ||
        !SDL_SetRenderDrawColor(renderer, 96, 211, 181, 255) || !SDL_RenderFillRect(renderer, &block) ||
        !SDL_SetRenderDrawColor(renderer, 230, 235, 242, 255) ||
        !SDL_RenderDebugText(renderer, 24, 24, "Space: pause  R: reload Lua  Esc: quit") ||
        (paused && !SDL_RenderDebugText(renderer, 24, 42, "Paused")) || !SDL_RenderPresent(renderer)) {
        return fail(SDL_GetError());
    }
    SDL_Delay(8);
    return 1;
}

extern "C" PW_EXPORT void pw_close()
{
    if (script) lua_close(script);
    if (renderer) SDL_DestroyRenderer(renderer);
    if (window) SDL_DestroyWindow(window);
    script = nullptr;
    renderer = nullptr;
    window = nullptr;
    SDL_Quit();
}
