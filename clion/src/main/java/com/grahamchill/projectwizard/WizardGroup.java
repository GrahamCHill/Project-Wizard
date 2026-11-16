package com.grahamchill.projectwizard;

import com.intellij.icons.AllIcons;

import javax.swing.Icon;

enum WizardGroup {
    RAYLIB("Raylib", AllIcons.Actions.Execute),
    GRAPHICS("Graphics", AllIcons.FileTypes.Image),
    GAMES("Game Engines", AllIcons.Nodes.RunnableMark),
    DESKTOP("Desktop", AllIcons.Nodes.Desktop),
    CLI("Command Line", AllIcons.Nodes.Console),
    SYSTEMS("Systems", AllIcons.FileTypes.BinaryData),
    MOBILE("Mobile", AllIcons.Nodes.Module),
    VR("VR", AllIcons.Actions.ViewAsImage),
    FRONTEND("Web Frontend", AllIcons.Nodes.PpWeb),
    SERVER("Web Server", AllIcons.General.Web),
    DOCKER("Docker", AllIcons.FileTypes.Docker),
    INFRASTRUCTURE("Infrastructure", AllIcons.Nodes.Deploy),
    AI("ML and AI", AllIcons.Nodes.DataSchema),
    BLENDER("Blender", AllIcons.FileTypes.Image),
    DOCUMENTS("Documents", AllIcons.FileTypes.Text),
    GENERAL("General", AllIcons.Nodes.Folder),
    CUSTOM("Custom Templates", AllIcons.FileTypes.Archive);

    final String label;
    final Icon icon;

    WizardGroup(String label, Icon icon) {
        this.label = label;
        this.icon = icon;
    }
}
