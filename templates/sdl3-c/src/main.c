#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>
#include "starter.h"
#include <stdio.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif

struct Game {
    SDL_Window *window;
    SDL_Renderer *renderer;
};

static void drawFrame(void *context)
{
    struct Game *game = (struct Game *)context;
    SDL_Event event;
    while (SDL_PollEvent(&event)) {
        if (event.type == SDL_EVENT_QUIT) {
#ifdef __EMSCRIPTEN__
            emscripten_cancel_main_loop();
#endif
            SDL_DestroyRenderer(game->renderer);
            SDL_DestroyWindow(game->window);
            SDL_Quit();
            game->window = NULL;
            return;
        }
    }

    SDL_SetRenderDrawColor(game->renderer, 20, 30, 48, 255);
    SDL_RenderClear(game->renderer);
    SDL_FRect rectangle = { 32.0f, 32.0f, (float)starter_add(96, 64), 96.0f };
    SDL_SetRenderDrawColor(game->renderer, 62, 177, 210, 255);
    SDL_RenderFillRect(game->renderer, &rectangle);
    SDL_RenderPresent(game->renderer);
}

int main(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    if (!SDL_Init(SDL_INIT_VIDEO)) {
        fprintf(stderr, "SDL_Init: %s\n", SDL_GetError());
        return 1;
    }

    SDL_Window *window = SDL_CreateWindow("__PROJECT_NAME__", 800, 450, SDL_WINDOW_RESIZABLE);
    if (!window) {
        fprintf(stderr, "SDL_CreateWindow: %s\n", SDL_GetError());
        SDL_Quit();
        return 1;
    }
    SDL_Renderer *renderer = SDL_CreateRenderer(window, __SDL_RENDER_DRIVER__);
    if (!renderer) {
        fprintf(stderr, "SDL_CreateRenderer: %s\n", SDL_GetError());
        SDL_DestroyWindow(window);
        SDL_Quit();
        return 1;
    }
    SDL_SetRenderVSync(renderer, 1);

    static struct Game game;
    game.window = window;
    game.renderer = renderer;
#ifdef __EMSCRIPTEN__
    emscripten_set_main_loop_arg(drawFrame, &game, 0, 1);
#else
    while (game.window) drawFrame(&game);
#endif
    return 0;
}
