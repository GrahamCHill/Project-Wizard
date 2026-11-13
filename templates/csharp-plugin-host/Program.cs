using System.Reflection;
using System.Runtime.Loader;
using MoonSharp.Interpreter;
using PluginContract;

string directory = args.Length == 0 ? Path.Combine(AppContext.BaseDirectory, "plugins") : Path.GetFullPath(args[0]);
if (!Directory.Exists(directory))
{
    Console.Error.WriteLine($"No plugin directory at {directory}.");
    return 1;
}

var scripts = Directory.EnumerateFiles(directory, "*.lua");
var assemblies = Directory.EnumerateFiles(directory, "*.dll").Concat(
    Directory.EnumerateDirectories(directory)
        .Select(folder => Path.Combine(folder, Path.GetFileName(folder) + ".dll"))
        .Where(File.Exists));

foreach (string file in scripts.Concat(assemblies).Order(StringComparer.Ordinal))
{
    try
    {
        if (Path.GetExtension(file).Equals(".lua", StringComparison.OrdinalIgnoreCase))
        {
            var script = new Script(CoreModules.Preset_HardSandbox);
            var message = script.DoString(File.ReadAllText(file));
            if (message.Type != DataType.String) throw new InvalidOperationException("Lua plugin must return a string.");
            Console.WriteLine($"{Path.GetFileName(file)}: {message.String}");
        }
        else
        {
            var context = new PluginLoadContext(file);
            var assembly = context.LoadFromAssemblyPath(file);
            var plugins = assembly.GetTypes().Where(type =>
                type.IsClass && !type.IsAbstract && typeof(IPlugin).IsAssignableFrom(type)).ToArray();
            if (plugins.Length == 0) throw new InvalidOperationException("No IPlugin implementation was found.");
            foreach (var type in plugins)
            {
                var plugin = (IPlugin)Activator.CreateInstance(type)!;
                Console.WriteLine($"{type.Name}: {plugin.Greet()}");
            }
        }
    }
    catch (Exception error)
    {
        Console.Error.WriteLine($"Skipped {Path.GetFileName(file)}: {error.GetBaseException().Message}");
    }
}
return 0;

sealed class PluginLoadContext(string path) : AssemblyLoadContext
{
    private readonly AssemblyDependencyResolver resolver = new(path);

    protected override Assembly? Load(AssemblyName name)
    {
        var contract = typeof(IPlugin).Assembly;
        if (name.Name == contract.GetName().Name) return contract;
        var path = resolver.ResolveAssemblyToPath(name);
        return path is null ? null : LoadFromAssemblyPath(path);
    }

    protected override IntPtr LoadUnmanagedDll(string name)
    {
        var path = resolver.ResolveUnmanagedDllToPath(name);
        return path is null ? IntPtr.Zero : LoadUnmanagedDllFromPath(path);
    }
}
