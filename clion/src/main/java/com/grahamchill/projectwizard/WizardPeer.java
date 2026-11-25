package com.grahamchill.projectwizard;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.intellij.ide.util.PropertiesComponent;
import com.intellij.ide.util.projectWizard.SettingsStep;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.ui.TextFieldWithBrowseButton;
import com.intellij.openapi.ui.ValidationInfo;
import com.intellij.openapi.util.io.FileUtil;
import com.intellij.platform.ProjectGeneratorPeer;
import com.intellij.ui.DocumentAdapter;
import com.intellij.ui.components.JBCheckBox;
import com.intellij.ui.components.JBLabel;
import com.intellij.ui.components.JBScrollPane;
import com.intellij.ui.components.JBTextArea;
import com.intellij.ui.components.JBTextField;
import org.jetbrains.annotations.NotNull;

import javax.swing.*;
import javax.swing.event.DocumentEvent;
import javax.swing.filechooser.FileNameExtensionFilter;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.io.File;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class WizardPeer implements ProjectGeneratorPeer<JsonObject> {
    private static final String ZIP_FOLDER = "projectWizard.clion.zipDirectory";
    private final String templateId;
    private final JPanel panel = new JPanel(new BorderLayout(0, 8));
    private final JPanel optionsPanel = column();
    private final JBTextField search = new JBTextField();
    private final JBLabel status = new JBLabel();
    private final JBTextArea description = new JBTextArea(2, 32);
    private final JComboBox<Template> templateBox = new JComboBox<>();
    private final JButton refresh = new JButton("Refresh");
    private final JButton custom = new JButton("Custom ZIP folder…");
    private final JButton monoGame = new JButton("Install MonoGame templates");
    private final JComboBox<String> git = new JComboBox<>(new String[]{"Automatic", "Initialize", "Skip"});
    private final Map<String, JComboBox<Choice>> choices = new LinkedHashMap<>();
    private final Map<String, JBCheckBox> targets = new LinkedHashMap<>();
    private final List<SettingsListener> listeners = new ArrayList<>();
    private final List<Template> templates = new ArrayList<>();
    private final List<String> iconPaths = new ArrayList<>();
    private final JBTextArea dependencies = new JBTextArea(3, 27);
    private final JBTextField pythonVersion = new JBTextField();
    private final JBCheckBox testing = new JBCheckBox("Add an example test");
    private final JButton icons = new JButton("Choose app icons…");
    private final JComboBox<Choice> libraries = new JComboBox<>();
    private final JButton springPlugins = new JButton("Choose Spring plugins…");
    private final List<String> selectedSpringPlugins = new ArrayList<>();
    private String springDatabase = "auto";
    private TextFieldWithBrowseButton location;
    private Runnable checkValid = () -> {};
    private Template active;
    private String zipFolder = PropertiesComponent.getInstance().getValue(ZIP_FOLDER, "");
    private boolean busy;
    private boolean loaded;
    private boolean updating;
    private String error;

    WizardPeer(String templateId) {
        this.templateId = templateId;
        JPanel header = column();
        JPanel tools = new JPanel(new FlowLayout(FlowLayout.LEADING, 4, 1));
        tools.add(refresh);
        refresh.setVisible(templateId == null);
        if (templateId == null) {
            search.getEmptyText().setText("Search ZIP and MonoGame templates");
            header.add(search);
            header.add(row("Template", templateBox));
            tools.add(custom);
        }
        header.add(tools);
        header.add(monoGame);
        header.add(status);
        panel.add(header, BorderLayout.NORTH);
        description.setEditable(false);
        description.setLineWrap(true);
        description.setWrapStyleWord(true);
        description.setOpaque(false);
        var scroll = new JBScrollPane(optionsPanel);
        scroll.setPreferredSize(new Dimension(490, 260));
        scroll.setHorizontalScrollBarPolicy(ScrollPaneConstants.HORIZONTAL_SCROLLBAR_NEVER);
        panel.add(scroll, BorderLayout.CENTER);

        search.getDocument().addDocumentListener(new DocumentAdapter() {
            @Override protected void textChanged(@NotNull DocumentEvent event) { filterTemplates(); }
        });
        templateBox.addActionListener(event -> { if (!updating) showOptions(); });
        refresh.addActionListener(event -> load("catalog"));
        custom.addActionListener(event -> chooseZipFolder());
        monoGame.addActionListener(event -> load("installMonoGame"));
        icons.addActionListener(event -> chooseIcons());
        springPlugins.addActionListener(event -> chooseSpringPlugins());
        testing.addActionListener(event -> {
            choices.get("framework").setEnabled(testing.isSelected());
            changed();
        });
        libraries.addActionListener(event -> {
            if (updating || !(libraries.getSelectedItem() instanceof Choice choice) || choice.id().isEmpty()) return;
            String prefix = choice.id().toLowerCase(Locale.ROOT);
            if (dependencies.getText().lines().noneMatch(line -> line.trim().split("\\s+", 2)[0].equalsIgnoreCase(prefix))) {
                String existing = dependencies.getText().stripTrailing();
                dependencies.setText(existing.isEmpty() ? choice.line() : existing + "\n" + choice.line());
            }
            libraries.setSelectedIndex(0);
        });
        monoGame.setEnabled(false);
        monoGame.setVisible(false);
    }

    @Override public @NotNull JComponent getComponent(@NotNull TextFieldWithBrowseButton location, @NotNull Runnable checkValid) {
        this.location = location;
        this.checkValid = checkValid;
        return getComponent();
    }

    @Override public @NotNull JComponent getComponent() {
        if (!busy && !loaded && error == null) load("catalog");
        return panel;
    }

    @Override public void buildUI(@NotNull SettingsStep step) { step.addSettingsComponent(getComponent()); }

    @Override public boolean isBackgroundJobRunning() { return busy; }

    @Override public void addSettingsListener(@NotNull SettingsListener listener) { listeners.add(listener); }

    @Override public ValidationInfo validate() {
        if (busy) return new ValidationInfo("Wait for Project Wizard to finish.");
        if (error != null) return new ValidationInfo(error);
        if (active == null) return new ValidationInfo("Choose a template.", templateBox);
        if (selected("build").data().has("canCreate") && !flag(selected("build").data(), "canCreate")) {
            return new ValidationInfo("Install the tools required by the selected build.");
        }
        if (!targets.isEmpty() && targets.values().stream().noneMatch(JBCheckBox::isSelected)) {
            return new ValidationInfo("Choose at least one target platform.");
        }
        if (!iconPaths.isEmpty() && targets.containsKey("native") && !targets.get("native").isSelected()) {
            return new ValidationInfo("Select the desktop target to include app icons.", icons);
        }
        if ("python".equals(text(active.options(), "type")) && !flag(selected("environment").data(), "available")) {
            return new ValidationInfo("Install the required Python version and environment manager.");
        }
        return null;
    }

    @Override public @NotNull JsonObject getSettings() {
        var request = new JsonObject();
        if (active != null) request.addProperty("templateId", active.id());
        request.addProperty("zipDirectory", zipFolder);
        if (git.getSelectedIndex() != 0) request.addProperty("initializeGit", git.getSelectedIndex() == 1);
        var selectedIcons = new JsonArray();
        iconPaths.forEach(selectedIcons::add);
        request.add("iconPaths", selectedIcons);
        var options = new JsonObject();
        for (String key : List.of("language", "renderer", "build", "environment", "framework")) {
            if (choices.containsKey(key)) options.addProperty(key, selected(key).id());
        }
        if (!targets.isEmpty()) {
            var selectedTargets = new JsonArray();
            targets.forEach((id, box) -> { if (box.isSelected()) selectedTargets.add(id); });
            options.add("targets", selectedTargets);
        }
        options.addProperty("pythonVersion", pythonVersion.getText());
        options.addProperty("dependencies", dependencies.getText());
        options.addProperty("testing", testing.isSelected());
        if (active != null && !object(active.options(), "spring").isEmpty()) {
            var plugins = new JsonArray();
            selectedSpringPlugins.forEach(plugins::add);
            options.add("springPlugins", plugins);
            options.addProperty("springDatabase", springDatabase);
        }
        options.addProperty("executableIcon", !iconPaths.isEmpty());
        request.add("options", options);
        return request;
    }

    private void load(String action) {
        if (busy) return;
        var request = new JsonObject();
        request.addProperty("action", action);
        if (templateId == null) request.addProperty("zipDirectory", zipFolder);
        else request.addProperty("templateId", templateId);
        if (location != null) {
            try {
                Path parent = Path.of(FileUtil.expandUserHome(location.getText())).getParent();
                if (parent != null) request.addProperty("parent", parent.toString());
            } catch (java.nio.file.InvalidPathException ignored) { }
        }
        busy = true;
        error = null;
        status.setText(action.equals("installMonoGame") ? "Installing MonoGame templates…" : "Loading project options…");
        setBusy();
        ApplicationManager.getApplication().executeOnPooledThread(() -> {
            try {
                JsonObject result = WizardEngine.run(request);
                ApplicationManager.getApplication().invokeLater(() -> finish(result, null), com.intellij.openapi.application.ModalityState.any());
            } catch (Exception failure) {
                ApplicationManager.getApplication().invokeLater(() -> finish(null, failure.getMessage()), com.intellij.openapi.application.ModalityState.any());
            }
        });
    }

    private void finish(JsonObject result, String failure) {
        busy = false;
        error = failure;
        refresh.setVisible(result == null || flag(result, "canRefresh"));
        if (result != null) {
            loaded = true;
            templates.clear();
            for (var item : array(result, "templates")) {
                templates.add(new Template(item.getAsJsonObject()));
            }
            templates.sort(Comparator.comparing(Template::label, String.CASE_INSENSITIVE_ORDER));
            monoGame.setVisible(templateId == null && flag(result, "canInstallMonoGame"));
            String zipError = text(result, "zipError");
            status.setText(templateId == null ? (zipError.isEmpty() ? templates.size() + " templates available" : zipError) : "");
            filterTemplates();
        } else status.setText(failure);
        setBusy();
    }

    private void setBusy() {
        for (var control : List.of(search, templateBox, refresh, custom, monoGame)) control.setEnabled(!busy);
        changed();
    }

    private void filterTemplates() {
        String previous = active == null ? "" : active.id();
        String query = search.getText().toLowerCase(Locale.ROOT).strip();
        var matching = templates.stream().filter(template -> template.searchText().contains(query)).toList();
        updating = true;
        templateBox.setModel(new DefaultComboBoxModel<>(matching.toArray(Template[]::new)));
        matching.stream().filter(template -> template.id().equals(previous)).findFirst().ifPresent(templateBox::setSelectedItem);
        updating = false;
        showOptions();
    }

    private void showOptions() {
        var selectedTemplate = (Template)templateBox.getSelectedItem();
        if (active == selectedTemplate) { changed(); return; }
        active = selectedTemplate;
        optionsPanel.removeAll();
        choices.clear();
        targets.clear();
        iconPaths.clear();
        icons.setText("Choose app icons…");
        dependencies.setText("");
        pythonVersion.setText("");
        testing.setSelected(false);
        selectedSpringPlugins.clear();
        springDatabase = "auto";
        springPlugins.setText("Choose Spring plugins…");
        if (active != null) populateOptions(active.options());
        optionsPanel.revalidate();
        optionsPanel.repaint();
        changed();
    }

    private void populateOptions(JsonObject options) {
        updating = true;
        description.setText((text(active.data(), "description") + " " + text(active.data(), "requirement")).strip());
        optionsPanel.add(description);
        addChoice("language", object(options, "languageChoice"));
        addChoice("renderer", object(options, "rendererChoice"));
        addChoice("build", builds());
        JsonObject spring = object(options, "spring");
        if (!spring.isEmpty()) {
            array(spring, "includedPlugins").forEach(plugin -> selectedSpringPlugins.add(plugin.getAsString()));
            optionsPanel.add(springPlugins);
        }
        JsonObject targetChoice = object(options, "targetChoice");
        if (!targetChoice.isEmpty()) {
            JPanel boxes = new JPanel(new FlowLayout(FlowLayout.LEADING, 4, 0));
            for (var item : array(targetChoice, "options")) {
                Choice choice = new Choice(item.getAsJsonObject());
                var checkbox = new JBCheckBox(choice.toString(), choice.id().equals(text(targetChoice, "defaultId")));
                checkbox.addActionListener(event -> changed());
                targets.put(choice.id(), checkbox);
                boxes.add(checkbox);
            }
            optionsPanel.add(row("Targets", boxes));
        }
        if ("python".equals(text(options, "type"))) {
            var environmentOptions = new JsonObject();
            environmentOptions.addProperty("label", "Python environment");
            environmentOptions.addProperty("defaultId", text(options, "defaultEnvironment"));
            environmentOptions.add("options", array(options, "environments"));
            addChoice("environment", environmentOptions);
            pythonVersion.getEmptyText().setText("Default installed version");
            optionsPanel.add(row("Python version", pythonVersion));
        }
        JsonObject languageOptions = languageOptions();
        if (!text(languageOptions, "dependencies").isEmpty()) {
            optionsPanel.add(libraries);
            libraries();
            optionsPanel.add(row(text(languageOptions, "dependencies"), new JBScrollPane(dependencies)));
        }
        if (!array(languageOptions, "frameworks").isEmpty()) {
            testing.setText(text(languageOptions, "test"));
            optionsPanel.add(testing);
            addChoice("framework", frameworks());
            choices.get("framework").setEnabled(false);
        }
        if (!array(options, "executableIconFormats").isEmpty()) optionsPanel.add(icons);
        optionsPanel.add(row("Git repository", git));
        updating = false;
    }

    private void addChoice(String key, JsonObject model) {
        if (model.isEmpty()) return;
        var box = new JComboBox<Choice>();
        choices.put(key, box);
        setChoices(box, model, "");
        optionsPanel.add(row(text(model, "label"), box));
        box.addActionListener(event -> {
            if (updating) return;
            updating = true;
            if (key.equals("renderer") && choices.containsKey("build")) setChoices(choices.get("build"), builds(), selected("build").id());
            if (key.equals("language")) {
                if (choices.containsKey("framework")) setChoices(choices.get("framework"), frameworks(), selected("framework").id());
                libraries();
            }
            updating = false;
            changed();
        });
    }

    private JsonObject languageOptions() {
        var variant = object(object(active.options(), "languageOptions"), selected("language").id());
        return variant.isEmpty() ? active.options() : variant;
    }

    private JsonObject builds() {
        var variant = object(object(active.options(), "buildsByRenderer"), selected("renderer").id());
        return variant.isEmpty() ? object(active.options(), "buildChoice") : variant;
    }

    private JsonObject frameworks() {
        var model = new JsonObject();
        model.addProperty("label", "Test framework");
        model.add("options", array(languageOptions(), "frameworks"));
        return model;
    }

    private void libraries() {
        var model = new DefaultComboBoxModel<Choice>();
        var prompt = new JsonObject();
        prompt.addProperty("label", "Add a library preset…");
        model.addElement(new Choice(prompt));
        for (var item : array(languageOptions(), "libraries")) model.addElement(new Choice(item.getAsJsonObject()));
        libraries.setModel(model);
        libraries.setVisible(model.getSize() > 1);
    }

    private static void setChoices(JComboBox<Choice> box, JsonObject data, String previous) {
        var model = new DefaultComboBoxModel<Choice>();
        for (var item : array(data, "options")) model.addElement(new Choice(item.getAsJsonObject()));
        box.setModel(model);
        String target = previous.isEmpty() ? text(data, "defaultId") : previous;
        for (int i = 0; i < model.getSize(); i++) {
            if (model.getElementAt(i).id().equals(target)) { box.setSelectedIndex(i); return; }
        }
        if (!previous.isEmpty()) {
            String defaultId = text(data, "defaultId");
            for (int i = 0; i < model.getSize(); i++) if (model.getElementAt(i).id().equals(defaultId)) box.setSelectedIndex(i);
        }
    }

    private Choice selected(String key) {
        var box = choices.get(key);
        return box != null && box.getSelectedItem() instanceof Choice choice ? choice : new Choice(new JsonObject());
    }

    private void chooseZipFolder() {
        var chooser = new JFileChooser(zipFolder.isEmpty() ? null : new File(zipFolder));
        chooser.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
        chooser.setDialogTitle("Choose ZIP Templates Folder");
        if (chooser.showOpenDialog(panel) == JFileChooser.APPROVE_OPTION) {
            zipFolder = chooser.getSelectedFile().getAbsolutePath();
            PropertiesComponent.getInstance().setValue(ZIP_FOLDER, zipFolder);
            load("catalog");
        }
    }

    private void chooseSpringPlugins() {
        if (active == null || busy) return;
        JsonObject config = object(active.options(), "spring");
        JPanel content = column();
        var boxes = new LinkedHashMap<String, JBCheckBox>();
        var included = array(config, "includedPlugins").asList().stream().map(value -> value.getAsString()).toList();
        for (var item : array(config, "plugins")) {
            JsonObject plugin = item.getAsJsonObject();
            String id = text(plugin, "id");
            var box = new JBCheckBox(text(plugin, "label"), selectedSpringPlugins.contains(id));
            box.setToolTipText(text(plugin, "description"));
            box.setEnabled(!included.contains(id));
            boxes.put(id, box);
            content.add(box);
        }
        var database = new JComboBox<Choice>();
        var databases = new JsonObject();
        databases.add("options", array(config, "databases"));
        setChoices(database, databases, springDatabase);
        content.add(row("SQL database", database));
        content.add(new JBLabel("JPA and JDBC use H2 by default. External databases need connection settings."));
        if (JOptionPane.showConfirmDialog(panel, content, "Spring plugins", JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.PLAIN_MESSAGE) == JOptionPane.OK_OPTION) {
            selectedSpringPlugins.clear();
            boxes.forEach((id, box) -> { if (box.isSelected()) selectedSpringPlugins.add(id); });
            springDatabase = ((Choice)database.getSelectedItem()).id();
            springPlugins.setText("Spring plugins: " + selectedSpringPlugins.size() + " selected…");
            changed();
        }
    }

    private void chooseIcons() {
        var chooser = new JFileChooser();
        chooser.setMultiSelectionEnabled(true);
        String[] formats = array(active.options(), "executableIconFormats").asList().stream()
            .map(format -> format.getAsString().substring(1)).toArray(String[]::new);
        chooser.setFileFilter(new FileNameExtensionFilter("App icons", formats));
        chooser.setAcceptAllFileFilterUsed(false);
        if (chooser.showOpenDialog(panel) == JFileChooser.APPROVE_OPTION) {
            iconPaths.clear();
            Arrays.stream(chooser.getSelectedFiles()).map(File::getAbsolutePath).forEach(iconPaths::add);
            icons.setText(iconPaths.size() + " icon files selected…");
            changed();
        }
    }

    private void changed() {
        checkValid.run();
        boolean valid = validate() == null;
        listeners.forEach(listener -> listener.stateChanged(valid));
    }

    private static JPanel column() {
        var column = new JPanel();
        column.setLayout(new BoxLayout(column, BoxLayout.Y_AXIS));
        return column;
    }

    private static JPanel row(String label, JComponent control) {
        var row = new JPanel(new BorderLayout(6, 0));
        var fieldLabel = new JBLabel(label);
        fieldLabel.setLabelFor(control);
        row.add(fieldLabel, BorderLayout.WEST);
        row.add(control, BorderLayout.CENTER);
        row.setMaximumSize(new Dimension(Integer.MAX_VALUE, row.getPreferredSize().height + 2));
        return row;
    }

    private static JsonArray array(JsonObject object, String key) {
        return object.get(key) instanceof JsonArray values ? values : new JsonArray();
    }

    private static JsonObject object(JsonObject parent, String key) {
        return parent.get(key) instanceof JsonObject value ? value : new JsonObject();
    }

    private static String text(JsonObject object, String key) {
        JsonElement value = object.get(key);
        return value != null && value.isJsonPrimitive() ? value.getAsString() : "";
    }

    private static boolean flag(JsonObject object, String key) { return "true".equals(text(object, key)); }

    private record Template(JsonObject data) {
        String id() { return text(data, "id"); }
        String label() { return text(data, "label"); }
        JsonObject options() { return object(data, "options"); }
        String searchText() { return (label() + " " + id() + " " + text(data, "group") + " " + text(data, "description") +
            " " + text(data, "language") + " " + array(data, "variants")).toLowerCase(Locale.ROOT); }
        @Override public String toString() { return label(); }
    }

    private record Choice(JsonObject data) {
        String id() { return text(data, "id"); }
        String line() { return text(data, "line"); }
        @Override public String toString() { return text(data, "label"); }
    }
}
