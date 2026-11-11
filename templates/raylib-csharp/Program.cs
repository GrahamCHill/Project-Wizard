using Raylib_cs;

Raylib.InitWindow(960, 540, "__PROJECT_NAME__");
Raylib.SetTargetFPS(60);

while (!Raylib.WindowShouldClose())
{
    Raylib.BeginDrawing();
    Raylib.ClearBackground(Color.RayWhite);
    Raylib.DrawText("__PROJECT_NAME__", 32, 32, 28, Color.DarkGray);
    Raylib.EndDrawing();
}

Raylib.CloseWindow();
