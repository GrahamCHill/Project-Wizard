/* Walk around a world made in Blender, drawn with SDL 3.
 *
 * world.c reads the glTF file, player.c moves the player, and raster.c draws the 3D scene into a block of pixels on the CPU.
 * This file does what SDL is for: it opens the window, reads the keyboard and mouse, and puts the pixels on the screen. */
#include <SDL3/SDL.h>
#include <stdio.h>
#include <string.h>

#include "player.h"
#include "raster.h"
#include "world.h"

#define VIEW_WIDTH 640    /* the 3D picture is drawn this small and scaled up, which keeps the software renderer quick */
#define VIEW_HEIGHT 360
#define FIELD_OF_VIEW 70.0f
#define MOUSE_SENSITIVITY 0.0025f /* radians per pixel */
#define TURN_SPEED 2.0f           /* radians per second, for the arrow keys */

/* The world file may be given on the command line. Otherwise look in the folder you started from, then next to the program. */
static const char *find_world(const char *requested, char *buffer, size_t size) {
    if (requested) return requested;
    if (SDL_GetPathInfo("assets/world.gltf", NULL)) return "assets/world.gltf";
    const char *base = SDL_GetBasePath();
    snprintf(buffer, size, "%sassets/world.gltf", base ? base : "");
    return buffer;
}

int main(int argc, char **argv) {
    const char *requested = NULL;
    const char *screenshot = NULL;
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--screenshot") == 0 && i + 1 < argc) screenshot = argv[++i];
        else requested = argv[i];
    }

    char path_buffer[1024];
    const char *path;
    World world;
    char error[256];

    if (!SDL_Init(SDL_INIT_VIDEO)) {
        fprintf(stderr, "Cannot start SDL: %s\n", SDL_GetError());
        return 1;
    }
    path = find_world(requested, path_buffer, sizeof path_buffer);
    if (!world_load(path, &world, error, sizeof error)) {
        fprintf(stderr, "Cannot load %s: %s\n", path, error);
        SDL_Quit();
        return 1;
    }

    SDL_Window *window = SDL_CreateWindow("__PROJECT_NAME__", 1280, 720, SDL_WINDOW_RESIZABLE);
    SDL_Renderer *renderer = window ? SDL_CreateRenderer(window, NULL) : NULL;
    SDL_Texture *texture = renderer ? SDL_CreateTexture(renderer, SDL_PIXELFORMAT_ARGB8888, SDL_TEXTUREACCESS_STREAMING, VIEW_WIDTH, VIEW_HEIGHT) : NULL;
    Frame frame;
    if (!texture || !frame_init(&frame, VIEW_WIDTH, VIEW_HEIGHT)) {
        fprintf(stderr, "Cannot create the window: %s\n", SDL_GetError());
        if (texture) SDL_DestroyTexture(texture);
        if (renderer) SDL_DestroyRenderer(renderer);
        if (window) SDL_DestroyWindow(window);
        world_free(&world);
        SDL_Quit();
        return 1;
    }
    SDL_SetTextureScaleMode(texture, SDL_SCALEMODE_LINEAR);
    SDL_SetRenderLogicalPresentation(renderer, VIEW_WIDTH, VIEW_HEIGHT, SDL_LOGICAL_PRESENTATION_LETTERBOX);
    SDL_SetRenderVSync(renderer, 1);
    if (!screenshot) SDL_SetWindowRelativeMouseMode(window, true);

    Player player;
    player_init(&player, &world);

    int running = 1, frames = 0, frames_this_second = 0;
    Uint64 last = SDL_GetTicksNS(), second_started = last;
    float mouse_x = 0, mouse_y = 0;
    while (running) {
        SDL_Event event;
        while (SDL_PollEvent(&event)) {
            if (event.type == SDL_EVENT_QUIT || (event.type == SDL_EVENT_KEY_DOWN && event.key.key == SDLK_ESCAPE)) running = 0;
            if (event.type == SDL_EVENT_MOUSE_MOTION) {
                mouse_x += event.motion.xrel;
                mouse_y += event.motion.yrel;
            }
        }

        Uint64 now = SDL_GetTicksNS();
        float dt = (float)(now - last) / 1e9f;
        last = now;

        const bool *keys = SDL_GetKeyboardState(NULL);
        float turn = (float)keys[SDL_SCANCODE_LEFT] - (float)keys[SDL_SCANCODE_RIGHT];
        float look_up = (float)keys[SDL_SCANCODE_UP] - (float)keys[SDL_SCANCODE_DOWN];
        player_look(&player, turn * TURN_SPEED * dt - mouse_x * MOUSE_SENSITIVITY, look_up * TURN_SPEED * dt - mouse_y * MOUSE_SENSITIVITY);
        mouse_x = mouse_y = 0;

        float forward = (float)keys[SDL_SCANCODE_W] - (float)keys[SDL_SCANCODE_S];
        float strafe = (float)keys[SDL_SCANCODE_D] - (float)keys[SDL_SCANCODE_A];
        player_update(&player, &world, dt, strafe, forward, keys[SDL_SCANCODE_SPACE]);

        float eye[3], direction[3];
        player_eye(&player, eye);
        player_direction(&player, direction);
        frame_clear(&frame, 24, 28, 36);
        render_world(&frame, &world, eye, direction, FIELD_OF_VIEW);

        SDL_UpdateTexture(texture, NULL, frame.pixels, VIEW_WIDTH * (int)sizeof(Uint32));
        SDL_RenderClear(renderer);
        SDL_RenderTexture(renderer, texture, NULL, NULL);
        SDL_RenderPresent(renderer);

        frames_this_second++;
        if (now - second_started >= 1000000000ull) {
            char title[160];
            snprintf(title, sizeof title, "__PROJECT_NAME__ - %d fps", frames_this_second);
            SDL_SetWindowTitle(window, title);
            frames_this_second = 0;
            second_started = now;
        }

        /* With --screenshot the program draws a few frames from the spawn point, saves a picture, and quits. */
        if (screenshot && ++frames == 5) {
            SDL_Surface *picture = SDL_CreateSurfaceFrom(VIEW_WIDTH, VIEW_HEIGHT, SDL_PIXELFORMAT_ARGB8888, frame.pixels, VIEW_WIDTH * (int)sizeof(Uint32));
            if (!picture || !SDL_SavePNG(picture, screenshot)) fprintf(stderr, "Cannot save %s: %s\n", screenshot, SDL_GetError());
            SDL_DestroySurface(picture);
            break;
        }
    }

    frame_free(&frame);
    SDL_DestroyTexture(texture);
    SDL_DestroyRenderer(renderer);
    SDL_DestroyWindow(window);
    world_free(&world);
    SDL_Quit();
    return 0;
}
