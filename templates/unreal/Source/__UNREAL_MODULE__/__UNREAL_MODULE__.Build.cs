using UnrealBuildTool;

public class __UNREAL_MODULE__ : ModuleRules
{
    public __UNREAL_MODULE__(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine" });
    }
}
