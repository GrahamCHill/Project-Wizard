using UnrealBuildTool;

public class __UNREAL_MODULE__EditorTarget : TargetRules
{
    public __UNREAL_MODULE__EditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("__UNREAL_MODULE__");
    }
}
