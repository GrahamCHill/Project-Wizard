#include "raylib.h"
#include "starter.h"

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif

static void drawFrame(void)
{
    BeginDrawing();
    ClearBackground(RAYWHITE);
    DrawText("__PROJECT_NAME__", 32, 32, 28, DARKGRAY);
    DrawText(TextFormat("2 + 3 = %d", starter_add(2, 3)), 32, 76, 20, DARKGRAY);
    EndDrawing();
}

int main(void)
{
    InitWindow(960, 540, "__PROJECT_NAME__");
#ifdef __EMSCRIPTEN__
    emscripten_set_main_loop(drawFrame, 0, 1);
#else
    SetTargetFPS(60);
    while (!WindowShouldClose()) drawFrame();
    CloseWindow();
#endif
    return 0;
}
