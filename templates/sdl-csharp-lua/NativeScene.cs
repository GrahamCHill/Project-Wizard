using System.Runtime.InteropServices;

public static partial class NativeScene
{
    public static int ScriptedPosition(string source, int position, int ticks)
    {
        if (LoadScript(source) == 0) throw new InvalidOperationException("Could not load the Lua behavior.");
        try
        {
            int result = Advance(position, ticks);
            if (result < 0) throw new InvalidOperationException("Lua update failed.");
            return result;
        }
        finally
        {
            Close();
        }
    }

    [LibraryImport("pw_native", EntryPoint = "pw_load_script", StringMarshalling = StringMarshalling.Utf8)]
    internal static partial int LoadScript(string source);

    [LibraryImport("pw_native", EntryPoint = "pw_open", StringMarshalling = StringMarshalling.Utf8)]
    internal static partial int Open(string title, string icon, string vulkanLoader);

    [LibraryImport("pw_native", EntryPoint = "pw_events")]
    internal static partial int Events();

    [LibraryImport("pw_native", EntryPoint = "pw_advance")]
    internal static partial int Advance(int position, int ticks);

    [LibraryImport("pw_native", EntryPoint = "pw_draw")]
    internal static partial int Draw(int position, int paused);

    [LibraryImport("pw_native", EntryPoint = "pw_close")]
    internal static partial void Close();
}
