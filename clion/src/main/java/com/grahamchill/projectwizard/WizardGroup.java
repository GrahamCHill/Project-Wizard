package com.grahamchill.projectwizard;

import com.intellij.icons.AllIcons;

import javax.swing.Icon;

/**
 * Categories in the New Project dialog. The constants match the ids in src/groups.js, which merges related template
 * groups (for example Raylib, MonoGame, graphics, and game engines are all GAMES). A test checks that every group the
 * generated registry uses has a constant here.
 */
enum WizardGroup {
    GAMES("Games & Graphics", AllIcons.Nodes.RunnableMark),
    APPS("Desktop & Mobile", AllIcons.Nodes.Desktop),
    CLI("Command Line", AllIcons.Nodes.Console),
    SYSTEMS("Systems", AllIcons.FileTypes.BinaryData),
    VR("VR", AllIcons.Actions.ViewAsImage),
    WEB("Web", AllIcons.General.Web),
    CLOUD("Cloud & DevOps", AllIcons.Nodes.Deploy),
    AI("Data & AI", AllIcons.Nodes.DataSchema),
    BLENDER("Blender", AllIcons.FileTypes.Image),
    DOCUMENTS("Documents", AllIcons.FileTypes.Text),
    MISC("Misc", AllIcons.Nodes.Folder),
    GENERAL("General", AllIcons.Nodes.Folder),
    CUSTOM("Custom Templates", AllIcons.FileTypes.Archive);

    final String label;
    final Icon icon;

    WizardGroup(String label, Icon icon) {
        this.label = label;
        this.icon = icon;
    }
}
