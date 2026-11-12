using Raylib_cs;

if (args is ["--self-test"])
{
    int result = NativeMotion.Advance(94, 10, 100);
    Console.WriteLine($"C++ motion result: {result}");
    return result == 4 ? 0 : 1;
}

const int width = 960;
const int height = 540;
const int radius = 24;
int position = 0;
Raylib.InitWindow(width, height, "__PROJECT_NAME__");
Raylib.SetTargetFPS(60);

try
{
    while (!Raylib.WindowShouldClose())
    {
        int step = Raylib.IsKeyDown(KeyboardKey.Left) ? -5 : Raylib.IsKeyDown(KeyboardKey.Right) ? 5 : 2;
        position = NativeMotion.Advance(position, step, width - 2 * radius);
        Raylib.BeginDrawing();
        Raylib.ClearBackground(Color.RayWhite);
        Raylib.DrawText("__PROJECT_NAME__", 32, 32, 28, Color.DarkGray);
        Raylib.DrawText("C# draws with Raylib. C++ moves the circle.", 32, 76, 20, Color.DarkGray);
        Raylib.DrawText("Hold Left or Right to steer.", 32, 106, 20, Color.DarkGray);
        Raylib.DrawCircle(position + radius, height / 2, radius, Color.Blue);
        Raylib.EndDrawing();
    }
}
finally
{
    Raylib.CloseWindow();
}

return 0;
