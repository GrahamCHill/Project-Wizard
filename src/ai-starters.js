const { starter } = require('./standard-templates');

const providerTable = [
  '| Provider | Set | Default model |',
  '| --- | --- | --- |',
  '| `anthropic` (Claude) | `ANTHROPIC_API_KEY` | `claude-opus-5-5` |',
  '| `groq` | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |',
  '| `openai`, `together`, `mistral`, `openrouter`, `deepseek`, `xai`, `gemini` | The provider’s own key variable, such as `OPENAI_API_KEY` | Choose one with `--model` |',
  '| `ollama`, `lmstudio` | No key. Start the local server | Choose one with `--model` |',
  '| `custom` | `LLM_BASE_URL`, and `LLM_API_KEY` if it needs one | Choose one with `--model` |'
].join('\n');

function llmNote(run, test) {
  return [
    'One chat client for **Claude**, **Groq**, and any **OpenAI-compatible** server. Each provider is a small adapter behind the same interface, so the chat loop, tools, and tests do not depend on which one you use.',
    '',
    'Claude uses the official Anthropic SDK and Groq uses the official Groq SDK. The other providers use the OpenAI SDK with a base URL, which is how those services expose their API.',
    '',
    providerTable,
    '',
    'Set the key as an environment variable, then pick the provider with `--provider` or `LLM_PROVIDER`. Run `--list-providers` to see what each one needs, and `--list-models` to see which models your key can use. Model names change often, so check the provider’s documentation if the default is retired.',
    '',
    '### Claude settings',
    '',
    '| Variable | Effect |',
    '| --- | --- |',
    '| `ANTHROPIC_EFFORT` | `low`, `medium`, `high`, `xhigh`, or `max`. Controls how much the model thinks. |',
    '| `ANTHROPIC_THINKING` | `adaptive` (default) or `off`. Models older than Claude 4.6, such as Haiku 4.5, need `off`. |',
    '| `ANTHROPIC_FALLBACKS` | `default` (default) lets the API retry on another model if a safety classifier declines the request. Set `off` to disable it. |',
    '| `LLM_MAX_TOKENS` | Largest reply to allow. Defaults to 64000 for Claude and 4096 for the others. |',
    '',
    '### Tools',
    '',
    'The example tools `calculate` and `get_time` show the full loop: the model asks for a tool, the program validates the arguments against the tool’s schema, runs it, and sends the result back. The model chooses the arguments, so they are treated as untrusted. `calculate` parses arithmetic itself instead of calling `eval`. Add your own tools in `tools`, and use `--no-tools` to turn them off.',
    '',
    '### Tests',
    '',
    `${test} The tests start a local server that speaks each provider’s streaming protocol and point the real SDKs at it. They check the exact requests the SDKs send and how replies are parsed, with no network and no API key. ${run}`
  ].join('\n');
}

const aiStarters = [
  starter('ai-llm-chat-python', 'ai', 'Python', 'LLM Chat: Claude, Groq, and More (Python)',
    'A streaming chat CLI with tool use for Claude, Groq, and OpenAI-compatible models, with tests that run without a network.',
    ['ml-python'], [
      'pyproject.toml', 'gitignore',
      'src/llm_chat/__init__.py', 'src/llm_chat/__main__.py', 'src/llm_chat/agent.py', 'src/llm_chat/cli.py',
      'src/llm_chat/providers.py', 'src/llm_chat/tools.py',
      'tests/mock_llm.py', 'tests/test_cli.py', 'tests/test_providers.py', 'tests/test_tools_and_agent.py'
    ], ['python3 -m llm_chat "What is 17 * 23?"', 'python3 -m llm_chat --provider groq "Say hello"', 'python3 -m llm_chat --list-providers',
      'python3 -m unittest discover -s tests'],
    {
      pythonMinimum: '3.11', pythonPackage: true,
      pythonPackages: ['anthropic>=2.14,<3', 'groq>=1.7,<2', 'openai>=3.60,<4'],
      requirement: 'Python 3.11 or newer. Running a chat needs an API key for the provider you choose. The tests need none.',
      note: llmNote('Run them with `python3 -m unittest discover -s tests`.', 'The tests use the standard `unittest` module.')
    }),
  starter('ai-llm-chat-typescript', 'ai', 'TypeScript', 'LLM Chat: Claude, Groq, and More (TypeScript)',
    'A streaming chat CLI with tool use for Claude, Groq, and OpenAI-compatible models, with tests that run without a network.',
    ['node-ts', 'npm'], [
      'package.json', 'tsconfig.json', 'gitignore',
      'src/providers.ts', 'src/tools.ts', 'src/agent.ts', 'src/cli.ts',
      'test/providers.test.ts', 'test/tools-and-agent.test.ts', 'test/cli.test.ts', 'test-support/mock-llm.ts'
    ], ['npm install', 'npm start -- "What is 17 * 23?"', 'npm start -- --provider groq "Say hello"', 'npm start -- --list-providers',
      'npm test', 'npm run typecheck'],
    {
      requirement: 'Node.js 22.18 or newer, which runs TypeScript directly, and npm. Running a chat needs an API key for the provider you choose. The tests need none.',
      note: llmNote('Type-check with `npm run typecheck`.', 'The tests use the built-in `node:test` runner, and Node runs the TypeScript files directly.')
    }),
  starter('mcp-server-python', 'ai', 'Python', 'MCP Server (Python)',
    'A Model Context Protocol server with tools, a resource, and a prompt, tested in memory and over stdio.',
    ['ml-python'], [
      'pyproject.toml', 'gitignore', 'mcp.example.json',
      'src/mcp_app/__init__.py', 'src/mcp_app/__main__.py', 'src/mcp_app/server.py',
      'tests/test_server.py', 'tests/test_stdio.py'
    ], ['python3 -m mcp_app', 'python3 -m unittest discover -s tests'],
    {
      pythonMinimum: '3.11', pythonPackage: true, pythonPackages: ['mcp>=2.3,<3'],
      requirement: 'Python 3.11 or newer. The server needs no network or API key.',
      note: [
        'An **MCP server** lets AI applications such as Claude Desktop and Claude Code call your code. It offers **tools** (actions), **resources** (data to read), and **prompts** (reusable instructions). This one uses the official `mcp` 2.x SDK and its `MCPServer` class, and runs over stdio.',
        '',
        '`src/mcp_app/server.py` has three tools (`add`, `text_stats` with structured output, and `slugify`), a notes resource at `notes://{name}`, and a code-review prompt. Add your own with the `@server.tool()`, `@server.resource()`, and `@server.prompt()` decorators. Raise `ToolError` or `ResourceNotFoundError` for failures you expect, so the model gets a clear message. Over stdio the protocol uses stdout, so never `print` to it. Write logs to stderr.',
        '',
        '### Connect it',
        '',
        'Use the full path to the Python in your project’s `.venv`.',
        '',
        '- **Claude Code:** `claude mcp add --transport stdio my-server -- /path/to/.venv/bin/python -m mcp_app` (on Windows, `.venv\\Scripts\\python.exe`).',
        '- **Claude Desktop:** add the entry from `mcp.example.json` to the `mcpServers` section of `claude_desktop_config.json`, then restart the app.',
        '- **MCP Inspector:** `npx @modelcontextprotocol/inspector /path/to/.venv/bin/python -m mcp_app` opens a browser UI to call the tools and read the resources.',
        '',
        '### Tests',
        '',
        '`tests/test_server.py` connects an in-process `Client` to the server, so it needs no subprocess. It checks the tool schemas and hints, structured output, argument validation, error results, resources, and the prompt. `tests/test_stdio.py` starts the server as a subprocess, the way a real host does, and calls a tool over stdio.'
      ].join('\n')
    }),
  starter('mcp-server-typescript', 'ai', 'TypeScript', 'MCP Server (TypeScript)',
    'A Model Context Protocol server with tools, a resource, and a prompt, tested in memory and over stdio.',
    ['node-ts', 'npm'], [
      'package.json', 'tsconfig.json', 'tsconfig.build.json', 'gitignore',
      'src/server.ts', 'src/index.ts', 'test/server.test.ts', 'test/stdio.test.ts'
    ], ['npm install', 'npm test', 'npm run typecheck', 'npm run build', 'npm run inspect'],
    {
      requirement: 'Node.js 22.18 or newer, which runs TypeScript directly, and npm. The server needs no network or API key.',
      note: [
        'An **MCP server** lets AI applications such as Claude Desktop and Claude Code call your code. It offers **tools** (actions), **resources** (data to read), and **prompts** (reusable instructions). This one uses the official `@modelcontextprotocol/server` 2.x SDK, Zod schemas, and stdio.',
        '',
        '`src/server.ts` has three tools (`add`, `text_stats`, and `slugify`) with input and output schemas, a notes resource at `notes://{name}`, and a code-review prompt. Add your own with `registerTool`, `registerResource`, and `registerPrompt`. Return `isError: true` for failures you expect, so the model gets a clear message. Over stdio the protocol uses stdout, so never call `console.log`. Use `console.error`.',
        '',
        '### Connect it',
        '',
        '- **Claude Code:** `claude mcp add --transport stdio my-server -- node /path/to/project/src/index.ts`, or point it at `dist/index.js` after `npm run build`.',
        '- **Claude Desktop:** add `{ "command": "node", "args": ["/path/to/project/dist/index.js"] }` under `mcpServers` in `claude_desktop_config.json`, then restart the app.',
        '- **MCP Inspector:** `npm run inspect` opens a browser UI to call the tools and read the resources.',
        '',
        '### Tests',
        '',
        '`test/server.test.ts` joins a client and the server with a linked pair of in-memory transports, so it needs no subprocess. It checks the tool schemas and hints, structured output, validation, error results, resources, and the prompt. `test/stdio.test.ts` starts the server as a subprocess, the way a real host does, and calls a tool over stdio.'
      ].join('\n')
    })
];

aiStarters.push(
  starter('data-duckdb-python', 'ai', 'Python', 'DuckDB Analytics (Python)',
    'An embedded analytics warehouse: load CSV files, enforce rules, run SQL reports, and export Parquet, with tests.',
    ['ml-python'], [
      'pyproject.toml', 'gitignore',
      'data/customers.csv', 'data/products.csv', 'data/orders.csv',
      'sql/schema.sql', 'sql/reports/monthly_revenue.sql', 'sql/reports/top_customers.sql',
      'sql/reports/category_by_quarter.sql', 'sql/reports/customer_cohorts.sql',
      'src/shop_analytics/__init__.py', 'src/shop_analytics/__main__.py', 'src/shop_analytics/cli.py',
      'src/shop_analytics/db.py', 'src/shop_analytics/pipeline.py', 'tests/test_pipeline.py'
    ], ['python3 -m shop_analytics load', 'python3 -m shop_analytics check', 'python3 -m shop_analytics reports',
      'python3 -m shop_analytics report monthly_revenue', 'python3 -m shop_analytics query "SELECT category, COUNT(*) AS products FROM products GROUP BY 1"',
      'python3 -m shop_analytics export', 'python3 -m unittest discover -s tests'],
    {
      pythonMinimum: '3.11', pythonPackage: true, pythonPackages: ['duckdb>=2,<3'],
      requirement: 'Python 3.11 or newer. DuckDB is a library, so there is no server to install.',
      note: [
        '[DuckDB](https://duckdb.org/) is an embedded analytical database. It runs inside your program, keeps a database in one file (or in memory), and is fast at scans, joins, and aggregations over millions of rows. It reads CSV and Parquet files directly, so it often replaces a script full of loops or a pandas pipeline.',
        '',
        'This project is a small shop warehouse: customers, products, and a year of orders. `load` creates the tables from `sql/schema.sql`, which declares types, keys, and `CHECK` rules that DuckDB enforces, then reads the CSV files in `data/`. `check` runs data-quality rules and exits with 1 when one is broken. `report` runs a query from `sql/reports/`, and `export` writes each table to Parquet.',
        '',
        'The reports show features worth knowing: window functions for a running total and month-over-month change (`monthly_revenue`), `QUALIFY` to filter on a window (`top_customers`), `PIVOT` (`category_by_quarter`), and a cohort analysis (`customer_cohorts`). Add a report by saving a `.sql` file in `sql/reports/`. It appears in `reports` straight away.',
        '',
        'Everything except `load` opens the database read-only, so `query` can run any SQL without changing your data, and several processes can read the file at once. Values go into queries as parameters (`?`), never into the SQL text. Replace the CSV files with your own, edit `TABLES` in `pipeline.py` and the schema to match, and the rest keeps working.',
        '',
        '### Tests',
        '',
        'Most tests build a tiny warehouse whose results are small enough to check by hand, and a few check the shipped sample data: that it loads, passes its own rules, and that every report adds up to the same total revenue.'
      ].join('\n')
    })
);

module.exports = { aiStarters };
