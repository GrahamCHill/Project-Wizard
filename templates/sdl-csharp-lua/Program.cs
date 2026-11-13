string scriptPath = Path.Combine(AppContext.BaseDirectory, "scripts", "behavior.lua");
if (args is ["--self-test"])
{
    int position = NativeScene.ScriptedPosition(File.ReadAllText(scriptPath), 95, 2);
    Console.WriteLine($"Lua moved the scene through C++ to {position}.");
    return position == 1 ? 0 : 1;
}

bool smoke = args is ["--smoke-render"];
string icon = Path.Combine(AppContext.BaseDirectory, "assets", "app.png");
string loader = OperatingSystem.IsWindows()
    ? Path.Combine(AppContext.BaseDirectory, "vulkan-1.dll")
    : Path.Combine(AppContext.BaseDirectory, "lib", "libvulkan.so.1");
if (OperatingSystem.IsMacOS())
{
    loader = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "Frameworks", "libMoltenVK.dylib"));
}

try
{
    if (NativeScene.LoadScript(File.ReadAllText(scriptPath)) == 0 ||
        NativeScene.Open("__PROJECT_NAME__ — __SDL_BACKEND_LABEL__", File.Exists(icon) ? icon : "",
            File.Exists(loader) ? loader : "") == 0)
    {
        return 1;
    }

    int position = 0;
    bool paused = false;
    do
    {
        int events = NativeScene.Events();
        if ((events & 1) != 0) break;
        if ((events & 2) != 0) paused = !paused;
        if ((events & 4) != 0 && ReloadScript())
            position = 0;
        if (!paused) position = NativeScene.Advance(position, 1);
        if (position < 0 || NativeScene.Draw(position, paused ? 1 : 0) == 0) return 1;
        if (smoke) Console.WriteLine("Presented a frame with __SDL_BACKEND_LABEL__.");
    } while (!smoke);
}
finally
{
    NativeScene.Close();
}
return 0;

bool ReloadScript()
{
    try
    {
        return NativeScene.LoadScript(File.ReadAllText(scriptPath)) != 0;
    }
    catch (IOException error)
    {
        Console.Error.WriteLine($"Could not reload Lua: {error.Message}");
        return false;
    }
}
