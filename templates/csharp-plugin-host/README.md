# __PROJECT_NAME__

The host loads managed assemblies that implement `IPlugin` and Lua scripts that return a string. Each assembly has its own dependency resolver. The contract assembly is shared with the host so plugin types implement the same interface.

~~~sh
dotnet run
~~~

The default directory is `plugins/` beside the built executable. The sample assembly and Lua script are copied there automatically. A standalone managed plugin can be a DLL in that directory. For a plugin with dependencies, publish it to a subfolder named after its entry DLL and keep its dependencies and `.deps.json` together. The host reads `plugins/Name/Name.dll` as the entry point. Pass a different directory with `dotnet run -- path/to/plugins`. The host loads plugins at launch. Use plugins you trust because they execute in the host process.

The Lua example uses MoonSharp’s Lua dialect and restricted standard library set.
