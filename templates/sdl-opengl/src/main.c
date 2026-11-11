#if STARTER_SDL_MAJOR == 3
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>
#include <SDL3/SDL_opengl.h>
#else
#define SDL_MAIN_HANDLED
#include <SDL.h>
#include <SDL_opengl.h>
#endif
#include "starter.h"
#include <stdio.h>

int main(int argc, char **argv)
{
    (void)argc;
    (void)argv;
#if STARTER_SDL_MAJOR == 3
    const int initialized = SDL_Init(SDL_INIT_VIDEO);
#else
    SDL_SetMainReady();
    const int initialized = SDL_Init(SDL_INIT_VIDEO) == 0;
#endif
    if (!initialized) {
        fprintf(stderr, "SDL_Init: %s\n", SDL_GetError());
        return 1;
    }

    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 3);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_FLAGS, SDL_GL_CONTEXT_FORWARD_COMPATIBLE_FLAG);
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);

    const int windowWidth = starter_add(400, 400);
#if STARTER_SDL_MAJOR == 3
    SDL_Window *window = SDL_CreateWindow("__PROJECT_NAME__", windowWidth, 450,
        SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_HIGH_PIXEL_DENSITY);
#else
    SDL_Window *window = SDL_CreateWindow("__PROJECT_NAME__", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
        windowWidth, 450, SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_ALLOW_HIGHDPI);
#endif
    if (!window) {
        fprintf(stderr, "SDL_CreateWindow: %s\n", SDL_GetError());
        SDL_Quit();
        return 1;
    }

    SDL_GLContext context = SDL_GL_CreateContext(window);
    if (!context) {
        fprintf(stderr, "SDL_GL_CreateContext: %s\n", SDL_GetError());
        SDL_DestroyWindow(window);
        SDL_Quit();
        return 1;
    }
    SDL_GL_SetSwapInterval(1);

    int running = 1;
    while (running) {
        SDL_Event event;
        while (SDL_PollEvent(&event)) {
#if STARTER_SDL_MAJOR == 3
            if (event.type == SDL_EVENT_QUIT) {
#else
            if (event.type == SDL_QUIT) {
#endif
                running = 0;
            }
        }

        int width = 0;
        int height = 0;
#if STARTER_SDL_MAJOR == 3
        SDL_GetWindowSizeInPixels(window, &width, &height);
#else
        SDL_GL_GetDrawableSize(window, &width, &height);
#endif
        glViewport(0, 0, width, height);
        glClearColor(0.08f, 0.16f, 0.27f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        SDL_GL_SwapWindow(window);
    }

#if STARTER_SDL_MAJOR == 3
    SDL_GL_DestroyContext(context);
#else
    SDL_GL_DeleteContext(context);
#endif
    SDL_DestroyWindow(window);
    SDL_Quit();
    return 0;
}
