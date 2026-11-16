package com.grahamchill.projectwizard;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.intellij.ide.plugins.PluginManagerCore;
import com.intellij.openapi.application.PathManager;
import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.extensions.PluginId;
import com.intellij.util.EnvironmentUtil;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import java.util.stream.Stream;

final class WizardEngine {
    private static final PluginId ID = PluginId.getId("com.grahamchill.project-wizard.clion");
    private static final Logger LOG = Logger.getInstance(WizardEngine.class);
    private static Catalog recentCatalog;

    private WizardEngine() {}

    static synchronized JsonObject catalog(JsonObject request, boolean refresh) throws IOException, InterruptedException {
        String key = request.toString();
        long now = System.nanoTime();
        if (!refresh && recentCatalog != null && recentCatalog.key().equals(key) && now < recentCatalog.expires()) {
            return recentCatalog.result();
        }
        JsonObject result = run(request);
        recentCatalog = new Catalog(key, System.nanoTime() + java.util.concurrent.TimeUnit.MINUTES.toNanos(1), result);
        return result;
    }

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
        command.environment().put("PATH", withBundledToolchains(inheritedPath));
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

    private static String withBundledToolchains(String inheritedPath) {
        Path bin = Path.of(PathManager.getBinPath());
        var directories = new ArrayList<String>();
        for (String tool : List.of("cmake", "ninja", "mingw")) {
            Path root = bin.resolve(tool);
            if (!Files.isDirectory(root)) continue;
            try (Stream<Path> paths = Files.find(root, 5, (file, attributes) -> {
                String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
                return attributes.isRegularFile() && !root.relativize(file).startsWith("cygwin") &&
                    (name.equals(tool) || name.equals(tool + ".exe") ||
                    (tool.equals("mingw") && name.equals("gcc.exe")));
            })) {
                paths.map(Path::getParent).distinct().forEach(path -> directories.add(path.toString()));
            } catch (IOException error) {
                LOG.info("Could not locate bundled " + tool, error);
            }
        }
        directories.add(inheritedPath);
        return String.join(File.pathSeparator, directories);
    }

    private record Catalog(String key, long expires, JsonObject result) {}
}
