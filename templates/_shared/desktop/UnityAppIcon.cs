using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

public static class ProjectWizardAppIcon
{
    [MenuItem("Tools/Project Wizard/Apply App Icon")]
    public static void Apply()
    {
        var icon = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Game/Art/AppIcon.png");
        if (icon == null) return;

        var target = NamedBuildTarget.Standalone;
        int count = PlayerSettings.GetIconSizes(target, IconKind.Any).Length;
        PlayerSettings.SetIcons(target, Enumerable.Repeat(icon, count).ToArray(), IconKind.Any);
        AssetDatabase.SaveAssets();
    }
}

public sealed class ProjectWizardAppIconImport : AssetPostprocessor
{
    private static void OnPostprocessAllAssets(string[] imported, string[] deleted, string[] moved, string[] movedFrom,
                                               bool didDomainReload)
    {
        if (didDomainReload || imported.Contains("Assets/Game/Art/AppIcon.png"))
            EditorApplication.delayCall += ProjectWizardAppIcon.Apply;
    }
}
