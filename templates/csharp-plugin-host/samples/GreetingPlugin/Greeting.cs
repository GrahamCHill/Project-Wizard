using PluginContract;

public sealed class Greeting : IPlugin
{
    public string Greet() => "Hello from a dynamically loaded C# plugin";
}
