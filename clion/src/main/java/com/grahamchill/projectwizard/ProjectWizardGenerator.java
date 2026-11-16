package com.grahamchill.projectwizard;

import com.google.gson.JsonObject;
import com.intellij.facet.ui.ValidationResult;
import com.intellij.ide.util.projectWizard.AbstractNewProjectStep;
import com.intellij.ide.util.projectWizard.CustomStepProjectGenerator;
import com.intellij.ide.util.projectWizard.ProjectSettingsStepBase;
import com.intellij.openapi.module.Module;
import com.intellij.openapi.progress.ProgressManager;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;
import com.intellij.openapi.util.io.FileUtil;
import com.intellij.openapi.util.SystemInfo;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.platform.DirectoryProjectGenerator;
import com.intellij.platform.HideableProjectGenerator;
import com.intellij.platform.ProjectGeneratorPeer;
import com.jetbrains.cidr.cpp.cmake.projectWizard.generators.CLionProjectGenerator;
import org.jetbrains.annotations.NotNull;

import javax.swing.Icon;
import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;

public abstract class ProjectWizardGenerator extends CLionProjectGenerator<JsonObject> implements
    CustomStepProjectGenerator<JsonObject>, HideableProjectGenerator {
    private static final Set<String> IDE_ENTRIES = Set.of(".idea", ".git");
    private final String templateId;
    private final String label;
    private final WizardGroup group;
    private final List<String> platforms;
    private final List<String> nativeNames;

    protected ProjectWizardGenerator(String templateId, String label, WizardGroup group, List<String> platforms, List<String> nativeNames) {
        this.templateId = templateId;
        this.label = label;
        this.group = group;
        this.platforms = platforms;
        this.nativeNames = nativeNames;
    }

    @Override
    public @NotNull String getName() { return label; }

    @Override
    public Icon getLogo() { return group.icon; }

    @Override public String getGroupName() { return "project-wizard-" + group.name(); }

    @Override public String getGroupDisplayName() { return group.label; }

    @Override public int getGroupOrder() { return GroupOrders.OTHER.order + group.ordinal() + 1; }

    @Override
    public @NotNull ProjectGeneratorPeer<JsonObject> createPeer() { return new WizardPeer(templateId); }

    @Override
    public boolean isHidden() {
        String platform = SystemInfo.isWindows ? "win32" : SystemInfo.isMac ? "darwin" : SystemInfo.isLinux ? "linux" : "";
        if (!platforms.contains(platform)) return true;
        if (nativeNames.isEmpty()) return false;
        return AbstractNewProjectStep.EP_NAME.getExtensionsIfPointIsRegistered().stream()
            .filter(generator -> !(generator instanceof ProjectWizardGenerator))
            .anyMatch(generator -> nativeNames.stream().anyMatch(name -> name.equalsIgnoreCase(generator.getName())) &&
                (!(generator instanceof HideableProjectGenerator hideable) || !hideable.isHidden()));
    }

    @Override
    public ProjectSettingsStepBase<JsonObject> createStep(DirectoryProjectGenerator<JsonObject> generator,
                                                          AbstractNewProjectStep.AbstractCallback<JsonObject> callback) {
        return new ProjectSettingsStepBase<>(generator, callback) {
            @Override
            protected JPanel createAndFillContentPanel() {
                var content = new JPanel(new BorderLayout(0, 8));
                content.add(createBasePanel(), BorderLayout.NORTH);
                content.add(getPeer().getComponent(myLocationField, () -> {
                    if (myCreateButton != null) myCreateButton.setEnabled(checkValid());
                }), BorderLayout.CENTER);
                return content;
            }
        };
    }

    @Override
    public @NotNull ValidationResult validate(@NotNull String baseDirPath) {
        try {
            Path destination = Path.of(FileUtil.expandUserHome(baseDirPath));
            if (!destination.isAbsolute() || destination.getFileName() == null) return new ValidationResult("Choose an absolute project path.");
            String name = destination.getFileName().toString();
            if (!name.matches("[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}") || name.endsWith(".") || name.endsWith(" ") ||
                name.matches("(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9]) *(\\..*)?")) {
                return new ValidationResult("Choose a project folder name of 1–80 letters, numbers, spaces, dots, hyphens, or underscores.");
            }
            if (Files.exists(destination)) {
                if (Files.isSymbolicLink(destination) || !Files.isDirectory(destination)) {
                    return new ValidationResult("Choose a new or empty project folder.");
                }
                try (var files = Files.list(destination)) {
                    if (files.anyMatch(file -> !IDE_ENTRIES.contains(file.getFileName().toString()))) {
                        return new ValidationResult("Choose a new or empty project folder.");
                    }
                }
            }
            return ValidationResult.OK;
        } catch (InvalidPathException error) {
            return new ValidationResult("Choose a valid project path.");
        } catch (Exception error) {
            return new ValidationResult("The project folder could not be checked.");
        }
    }

    @Override
    public void generateProject(@NotNull Project project, @NotNull VirtualFile baseDir,
                                @NotNull JsonObject settings, @NotNull Module module) {
        settings.addProperty("action", "create");
        settings.addProperty("destination", baseDir.getPath());
        var failure = new java.util.concurrent.atomic.AtomicReference<Exception>();
        ProgressManager.getInstance().runProcessWithProgressSynchronously(() -> {
            try {
                WizardEngine.run(settings);
            } catch (Exception error) {
                failure.set(error);
            }
        }, "Creating Project Wizard Project", false, project);
        baseDir.refresh(false, true);
        if (failure.get() != null) Messages.showErrorDialog(project, failure.get().getMessage(), "Project Wizard");
    }
}
