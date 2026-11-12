using System.Runtime.InteropServices;

public static partial class NativeMotion
{
    [LibraryImport("pw_native", EntryPoint = "pw_advance")]
    [DefaultDllImportSearchPaths(DllImportSearchPath.AssemblyDirectory | DllImportSearchPath.SafeDirectories)]
    public static partial int Advance(int position, int step, int width);
}
