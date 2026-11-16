package com.grahamchill.projectwizard;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.intellij.ide.plugins.PluginManagerCore;
import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.extensions.PluginId;
import com.intellij.util.EnvironmentUtil;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Pattern;

final class WizardEngine {
    private static final PluginId ID = PluginId.getId("com.grahamchill.project-wizard.clion");
    private static final Logger LOG = Logger.getInstance(WizardEngine.class);

    private WizardEngine() {}

    static JsonObject run(JsonObject request) throws IOException, InterruptedException {
        var plugin = PluginManagerCore.getPlugin(ID);
        if (plugin == null) throw new IOException("Project Wizard is not installed correctly.");
        Path location = plugin.getPluginPath();
        Path bridge = location.resolve("clion/bridge.js");
        var integrationEnvironment = EnvironmentUtil.getEnvironmentMap();
        String inheritedPath = integrationEnvironment.entrySet().stream().filter(entry -> pathVariable(entry.getKey()))
            .map(java.util.Map.Entry::getValue).findFirst().orElse("");
        var command = new ProcessBuilder(findNode(inheritedPath), bridge.toString());
        command.directory(location.toFile());
        command.environment().putAll(integrationEnvironment);
        command.environment().keySet().removeIf(WizardEngine::pathVariable);
        command.environment().put("PATH", inheritedPath);
        command.environment().remove("NODE_OPTIONS");
        Path errorFile = Files.createTempFile("project-wizard-", ".log");
        Process process = null;
        try {
            process = command.redirectError(errorFile.toFile()).start();
            try (var input = process.getOutputStream()) {
                input.write(request.toString().getBytes(StandardCharsets.UTF_8));
            }
            String json;
            try (var output = process.getInputStream()) {
                json = new String(output.readAllBytes(), StandardCharsets.UTF_8);
            }
            if (process.waitFor() != 0) {
                LOG.warn(Files.readString(errorFile, StandardCharsets.UTF_8));
                throw new IOException("The project generator failed to start. Check Node.js and see the CLion log for details.");
            }
            JsonObject result = JsonParser.parseString(json).getAsJsonObject();
            if (result.has("log")) {
                for (var line : result.getAsJsonArray("log")) LOG.info(line.getAsString());
            }
            if (result.has("error")) throw new IOException(result.get("error").getAsString());
            return result;
        } finally {
            if (process != null && process.isAlive()) process.destroyForcibly();
            Files.deleteIfExists(errorFile);
        }
    }

    private static boolean pathVariable(String name) {
        return File.separatorChar == '\\' ? name.equalsIgnoreCase("PATH") : name.equals("PATH");
    }

    private static String findNode(String inheritedPath) throws IOException {
        boolean windows = File.separatorChar == '\\';
        var directories = new LinkedHashSet<>(List.of(inheritedPath.split(Pattern.quote(File.pathSeparator))));
        if (!windows) directories.addAll(List.of("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"));
        for (String directory : directories) {
            if (directory.isBlank()) continue;
            Path candidate = Path.of(directory.replace("\"", "")).resolve(windows ? "node.exe" : "node");
            if (candidate.isAbsolute() && Files.isRegularFile(candidate) && Files.isExecutable(candidate)) return candidate.toString();
        }
        throw new IOException("Install Node.js 20.9 or newer, add it to PATH, and restart CLion.");
    }

}
