#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>
#include "starter.h"
#include <stdio.h>

int main(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    if (!SDL_Init(SDL_INIT_VIDEO)) {
        fprintf(stderr, "SDL_Init: %s\n", SDL_GetError());
        return 1;
    }

    SDL_Window *window = NULL;
    SDL_Renderer *renderer = NULL;
    if (!SDL_CreateWindowAndRenderer("__PROJECT_NAME__", 800, 450,
                                     SDL_WINDOW_RESIZABLE, &window, &renderer)) {
        fprintf(stderr, "SDL_CreateWindowAndRenderer: %s\n", SDL_GetError());
        SDL_Quit();
        return 1;
    }
    SDL_SetRenderVSync(renderer, 1);

    int running = 1;
    while (running) {
        SDL_Event event;
        while (SDL_PollEvent(&event)) {
            if (event.type == SDL_EVENT_QUIT) {
                running = 0;
            }
        }

        SDL_SetRenderDrawColor(renderer, 20, 30, 48, 255);
        SDL_RenderClear(renderer);
        SDL_FRect rectangle = { 32.0f, 32.0f, (float)starter_add(96, 64), 96.0f };
        SDL_SetRenderDrawColor(renderer, 62, 177, 210, 255);
        SDL_RenderFillRect(renderer, &rectangle);
        SDL_RenderPresent(renderer);
    }

    SDL_DestroyRenderer(renderer);
    SDL_DestroyWindow(window);
    SDL_Quit();
    return 0;
}
