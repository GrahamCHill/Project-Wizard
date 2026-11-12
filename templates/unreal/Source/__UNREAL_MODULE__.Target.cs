using UnrealBuildTool;

public class __UNREAL_MODULE__Target : TargetRules
{
    public __UNREAL_MODULE__Target(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("__UNREAL_MODULE__");
    }
}
