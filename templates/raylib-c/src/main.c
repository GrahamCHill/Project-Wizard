#include "raylib.h"

int main(void)
{
    InitWindow(960, 540, "__PROJECT_NAME__");
    SetTargetFPS(60);

    while (!WindowShouldClose())
    {
        BeginDrawing();
        ClearBackground(RAYWHITE);
        DrawText("__PROJECT_NAME__", 32, 32, 28, DARKGRAY);
        EndDrawing();
    }

    CloseWindow();
    return 0;
}
