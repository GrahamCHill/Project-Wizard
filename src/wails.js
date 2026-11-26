const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { replaceTokens } = require('./projects');

const exec = promisify(execFile);
const wailsVersions = [
  { id: 'wails3', label: 'Wails 3', cli: 'wails3', version: '3.0.0', git: 'github.com/wailsapp/wails/v3/cmd/wails3',
    linux: 'wails3-linux', frontend: 'vanilla-js' },
  { id: 'wails2', label: 'Wails 2', cli: 'wails', version: '2.17.1', git: 'github.com/wailsapp/wails/v2/cmd/wails',
    linux: 'wails2-linux', frontend: 'vanilla' }
].map(version => ({
  ...version,
  generatorTools: ['wails-go', version.id],
  tools: ['wails-go', version.id, 'vite-node', 'npm'],
  platformTools: { win32: ['wails-webview'], darwin: ['wails-macos'], linux: [version.linux] },
  requirement: 'Go 1.26.10 or newer, the ' + version.label + ' CLI, a supported Node.js LTS release, npm, and your OS webview.'
}));

const wailsStarter = {
  id: 'wails', kind: 'wails', group: 'desktop', language: 'Go', label: 'Wails Desktop',
  platforms: ['win32', 'darwin', 'linux'],
  description: 'A Wails 2 or Wails 3 desktop app with a Go backend and a Vite frontend that calls Go methods.',
  next: 'Follow the development and packaging commands in README.md.'
};

const wailsTests = {
  wails2: {
    source: 'app.go', file: 'app_test.go', declaration: /^func \(\w+ \*App\) Greet\(\w+ string\) string/m,
    contents: `package main

import (
	"context"
	"strings"
	"testing"
)

func TestGreetIncludesTheName(t *testing.T) {
	app := NewApp()
	for _, name := range []string{"Ada", "World", "José"} {
		if got := app.Greet(name); !strings.Contains(got, name) {
			t.Fatalf("Greet(%q) = %q, want it to contain the name", name, got)
		}
	}
}

func TestGreetAlwaysReturnsAMessage(t *testing.T) {
	if got := NewApp().Greet(""); strings.TrimSpace(got) == "" {
		t.Fatal("Greet(\\"\\") returned an empty message")
	}
}

func TestStartupKeepsTheRuntimeContext(t *testing.T) {
	type key struct{}
	ctx := context.WithValue(context.Background(), key{}, "value")
	app := NewApp()
	app.startup(ctx)
	if app.ctx != ctx {
		t.Fatal("startup should keep the context that Wails passes in")
	}
}
`
  },
  wails3: {
    source: 'greetservice.go', file: 'greetservice_test.go', declaration: /^func \(\w+ \*GreetService\) Greet\(\w+ string\) string/m,
    contents: `package main

import (
	"strings"
	"testing"
)

func TestGreetIncludesTheName(t *testing.T) {
	service := &GreetService{}
	for _, name := range []string{"Ada", "World", "José"} {
		if got := service.Greet(name); !strings.Contains(got, name) {
			t.Fatalf("Greet(%q) = %q, want it to contain the name", name, got)
		}
	}
}

func TestGreetAlwaysReturnsAMessage(t *testing.T) {
	if got := (&GreetService{}).Greet(""); strings.TrimSpace(got) == "" {
		t.Fatal("Greet(\\"\\") returned an empty message")
	}
}
`
  }
};

// Adds a Go test for the generated greeting method. It returns false, and writes nothing, when the
// generator's template no longer has the method this test calls, so a template change cannot break creation.
async function addWailsTests(output, version, log) {
  const test = wailsTests[version.id];
  const source = await fs.readFile(path.join(output, test.source), 'utf8').catch(() => '');
  if (!test.declaration.test(source)) {
    log?.('Skipped the Go test because ' + test.source + ' does not have the expected Greet method.');
    return false;
  }
  await fs.writeFile(path.join(output, test.file), test.contents, { flag: 'wx' });
  // main.go embeds frontend/dist, which Git ignores and only a frontend build creates. A placeholder
  // lets `go test` compile before the first build. Wails 2 already creates one.
  const dist = path.join(output, 'frontend', 'dist');
  if ((await fs.readdir(dist).catch(() => [])).length === 0) {
    await fs.mkdir(dist, { recursive: true });
    await fs.writeFile(path.join(dist, '.gitkeep'), '');
  }
  return true;
}

function testInstructions(version) {
  return [
    '## Tests', '',
    'Run the Go tests from the project folder:', '',
    '~~~sh', 'go test ./...', 'go vet ./...', '~~~', '',
    'The package embeds `frontend/dist`, which Git ignores, so a fresh clone or CI job needs a frontend build first:', '',
    '~~~sh', 'npm --prefix frontend install', 'npm --prefix frontend run build', 'go test ./...', '~~~', '',
    version.id === 'wails3' ?
      'On Linux, compiling the package also needs the GTK 4 and WebKitGTK 6.0 development files that `wails3 dev` uses.' :
      'On Linux, compiling the package also needs the GTK 3 and WebKitGTK 4.1 development files. Add `-tags webkit2_41` to `go test` and `go vet` when your system provides WebKitGTK 4.1.',
    ''
  ];
}

async function createWailsProject(name, project, tools, build, log) {
  const version = wailsVersions.find(option => option.id === build);
  if (!version || version.generatorTools.some(id => !tools[id] || tools[id].usable === false)) {
    throw new Error('Install Go and the selected Wails CLI from the setup guide, then refresh templates.');
  }
  const modern = version.id === 'wails3';
  const cli = tools[version.id].file;
  const go = tools['wails-go'].file;
  const installedVersion = tools[version.id].version || version.version;
  const slug = replaceTokens('app-__PROJECT_SLUG__', name);
  const output = path.join(project, slug);
  const args = ['init', '-n', slug, '-t', version.frontend, '-d', modern ? project : output];
  if (modern) args.push('-mod', 'example.com/' + slug, '-productname', name, '-productidentifier', 'com.example.' + slug, '--skipgomodtidy');
  const env = { ...process.env, GOWORK: 'off', PATH: path.dirname(go) + path.delimiter + (process.env.PATH || '') };
  try {
    log?.('Generating ' + version.label + ' Desktop.');
    const { stdout, stderr } = await exec(cli, args, {
      cwd: project, env, windowsHide: true, timeout: 300000, maxBuffer: 4 * 1024 * 1024
    });
    if (stdout.trim()) log?.(stdout.trim());
    if (stderr.trim()) log?.(stderr.trim());
  } catch (error) {
    log?.([error.stdout, error.stderr].filter(Boolean).join('\n') || error.message);
    throw new Error(version.label + ' generation failed. Open Project Wizard output for details.');
  }
  const entries = await fs.readdir(output);
  if (entries.includes('.git')) throw new Error(version.label + ' initialized Git during scaffolding.');
  const required = ['go.mod', 'main.go', 'frontend/package.json', 'build/appicon.png', modern ? 'Taskfile.yml' : 'wails.json'];
  for (const item of required) {
    await fs.access(path.join(output, item)).catch(() => {
      throw new Error(version.label + ' did not create ' + item + '.');
    });
  }
  if (modern) {
    const config = path.join(output, 'build/config.yml');
    const yaml = await fs.readFile(config, 'utf8');
    const values = { productName: name, productIdentifier: 'com.example.' + slug };
    await fs.writeFile(config, yaml.replace(/^(  (productName|productIdentifier): )"[^"]*"/gm,
      (line, key, field) => key + JSON.stringify(values[field])));
  } else {
    const config = path.join(output, 'wails.json');
    const settings = JSON.parse(await fs.readFile(config, 'utf8'));
    settings.info = { ...settings.info, productName: name };
    await fs.writeFile(config, JSON.stringify(settings, null, 2) + '\n');
  }
  const hasTests = await addWailsTests(output, version, log);
  await fs.writeFile(path.join(output, 'README.md'), [
    '# ' + name, '', 'A ' + version.label + ' desktop app with a Vite frontend that calls a Go greeting method.', '',
    '## Development', '',
    'Use Go 1.26.10 or newer, Node.js LTS and npm. Install the CLI on PATH. Run these commands from the project folder.', '',
    '~~~sh', 'go install ' + version.git + '@v' + installedVersion, version.cli + ' dev', '~~~', '',
    'On Windows, install Microsoft Edge WebView2 Runtime. On macOS, install Xcode Command Line Tools.', '',
    modern ?
      'On Linux, install a C compiler, pkg-config, GTK 4, and WebKitGTK 6.0 development files.' :
      'On Linux, install a C compiler, pkg-config, GTK 3, and WebKitGTK 4.1 development files. Use `wails dev -tags webkit2_41`.', '',
    '## Distribution', '',
    ...(modern ? ['Run `wails3 build` for a build or `wails3 task package` to package for your current platform. Outputs go under `bin/`.'] :
      ['Run `wails build` to package for the current platform. On Linux use `wails build -tags webkit2_41`. Outputs go under `build/bin/`.']),
    'On macOS, share the complete `.app` bundle. Linux users need the matching system webview libraries.', '',
    ...(hasTests ? testInstructions(version) : [])
  ].join('\n'));
  const generated = await fs.realpath(output);
  if (path.dirname(generated) !== await fs.realpath(project)) {
    throw new Error('The Wails generator wrote outside the project staging folder.');
  }
  // Copy first: Windows can reject renaming directories produced by the generator.
  for (const entry of await fs.readdir(generated)) await fs.cp(path.join(generated, entry), path.join(project, entry), {
    recursive: true, force: false, errorOnExist: true
  });
  await fs.rm(generated, { recursive: true, force: true });
}

module.exports = { addWailsTests, createWailsProject, wailsStarter, wailsVersions };
