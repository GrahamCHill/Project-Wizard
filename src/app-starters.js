const { starter } = require('./standard-templates');

const appStarters = [
  starter('browser-extension', 'frontend', 'JavaScript', 'Browser Extension (Chrome, Firefox, Safari)',
    'A Manifest V3 extension built from one source for Chrome and Chromium browsers, Firefox, and Safari.',
    ['node-ts', 'npm'], [
      'README.md', 'gitignore', 'package.json',
      'manifests/base.json', 'manifests/chrome.json', 'manifests/firefox.json', 'manifests/safari.json',
      'scripts/build.mjs', 'scripts/icons.mjs', 'scripts/safari.mjs',
      'src/background.js', 'src/content.js', 'src/shared/api.js', 'src/shared/text.js', 'src/shared/settings.js',
      'src/popup/popup.html', 'src/popup/popup.css', 'src/popup/popup.js', 'src/options/options.html', 'src/options/options.js',
      'test/helpers.js', 'test/text-and-settings.test.js', 'test/background-and-content.test.js', 'test/build.test.js'
    ], undefined, {
      requirement: 'Node.js 22.18 or newer and npm. Safari also needs a Mac with Xcode.'
    }),
  starter('cloudflare-worker', 'server', 'JavaScript', 'Cloudflare Worker',
    'A Worker with a small JSON API, optional Workers KV storage, and unit tests that call it without a server.',
    ['node-22', 'npm'], [
      'package.json', 'wrangler.jsonc', 'gitignore', 'src/index.js', 'test/worker.test.js'
    ], ['npm install', 'npm test', 'npm run dev', 'npm run check', 'npm run deploy'], {
      requirement: 'Node.js 22.12 or newer and npm. Deploying needs a free Cloudflare account.',
      note: [
        'A Worker is a function that receives a `Request` and returns a `Response`, and it runs close to your users on Cloudflare’s network. Tests call `worker.fetch(request, env)` directly, so they need no server and no account.',
        '',
        '`npm run dev` starts a local server at http://localhost:8787. Try `/healthz` and `/api/greet?name=Ada`. `npm run check` bundles the Worker without uploading it, which catches syntax and import errors. `npm run deploy` publishes it and asks you to sign in to Cloudflare the first time.',
        '',
        '`POST /api/visits` counts visits in Workers KV. Create a namespace with `npx wrangler kv namespace create VISITS` and add the id it prints to `wrangler.jsonc`, where a commented example is ready. Without it the route answers `501`, and the tests cover both cases with a fake KV.',
        '',
        'Wrangler sends anonymous usage data to Cloudflare. Set `WRANGLER_SEND_METRICS=false` to turn that off.'
      ].join('\n')
    }),
  starter('go-cobra-cli', 'cli', 'Go', 'Go Command Line with Cobra',
    'A multi-command Go CLI using Cobra, with flags, validation, distinct exit codes, and tests that run each command.',
    ['go'], ['go.mod', 'main.go', 'cmd/root.go', 'cmd/errors.go', 'cmd/greet.go', 'cmd/version.go', 'cmd/cmd_test.go', 'gitignore'],
    ['go mod tidy', 'go run . greet Ada --shout --times 2', 'go test ./...', 'go vet ./...', 'go build -o bin/ .'], {
      note: [
        '`go mod tidy` downloads Cobra and writes `go.sum`. Run it once first.',
        '',
        'Each command is built by a function with no global state, and `Execute(args, stdout, stderr)` returns an exit code, so a test can run the whole command line and check both outputs and the code: `0` for success, `1` for a command that ran and failed, and `2` for a usage mistake such as an unknown flag. Add a command by copying `cmd/greet.go` and registering it in `NewRootCmd`.',
        '',
        'Set the version at build time with `-ldflags "-X <module path>/cmd.Version=1.2.3"`, using the module path from `go.mod`.'
      ].join('\n')
    })
];

module.exports = { appStarters };
