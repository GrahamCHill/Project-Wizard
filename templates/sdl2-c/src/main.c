#define SDL_MAIN_HANDLED
#include <SDL.h>
#include "starter.h"
#include <stdio.h>

int main(void)
{
    SDL_SetMainReady();
    if (SDL_Init(SDL_INIT_VIDEO) != 0) {
        fprintf(stderr, "SDL_Init: %s\n", SDL_GetError());
        return 1;
    }

    SDL_Window *window = SDL_CreateWindow(
        "__PROJECT_NAME__", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
        800, 450, SDL_WINDOW_RESIZABLE);
    if (!window) {
        fprintf(stderr, "SDL_CreateWindow: %s\n", SDL_GetError());
        SDL_Quit();
        return 1;
    }

    SDL_Renderer *renderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_PRESENTVSYNC);
    if (!renderer) {
        fprintf(stderr, "SDL_CreateRenderer: %s\n", SDL_GetError());
        SDL_DestroyWindow(window);
        SDL_Quit();
        return 1;
    }

    int running = 1;
    while (running) {
        SDL_Event event;
        while (SDL_PollEvent(&event)) {
            if (event.type == SDL_QUIT) {
                running = 0;
            }
        }

        SDL_SetRenderDrawColor(renderer, 20, 30, 48, 255);
        SDL_RenderClear(renderer);
        SDL_Rect rectangle = { 32, 32, starter_add(96, 64), 96 };
        SDL_SetRenderDrawColor(renderer, 62, 177, 210, 255);
        SDL_RenderFillRect(renderer, &rectangle);
        SDL_RenderPresent(renderer);
    }

    SDL_DestroyRenderer(renderer);
    SDL_DestroyWindow(window);
    SDL_Quit();
    return 0;
}
