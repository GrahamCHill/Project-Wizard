#!/usr/bin/env node
// Command line chat. Run `npm start -- --help` for the options.
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { AgentError, runTurn } from './agent.ts';
import { ConfigError, makeProvider, PRESETS, type HistoryItem, type Provider, type ToolCall } from './providers.ts';
import { defaultTools } from './tools.ts';

const SYSTEM = 'You are a concise, helpful assistant. Use the tools when they help, and say when you are unsure.';

const HELP = `Usage: npm start -- [options] [prompt...]

Chat with Claude, Groq, or any OpenAI-compatible model. Give a prompt to ask one question and exit,
or give none to start an interactive chat.

Options:
  -p, --provider <name>   ${Object.keys(PRESETS).join(', ')}
                          (default: anthropic, or $LLM_PROVIDER)
  -m, --model <name>      Model name (default: the provider's default, or $LLM_MODEL)
      --base-url <url>    Override the provider's API base URL
      --system <text>     System prompt
      --no-tools          Do not offer the example tools
      --list-providers    Show the providers and what each needs, then exit
      --list-models       List the models the provider offers, then exit
  -h, --help              Show this help`;

export function describeProviders(): string {
  return Object.entries(PRESETS)
    .map(([name, preset]) => {
      const needs = name === 'custom' ? 'LLM_BASE_URL and LLM_API_KEY' : preset.keyEnv || 'no key';
      return `${name.padEnd(11)} ${needs.padEnd(30)} ${preset.note}`.trimEnd();
    })
    .join('\n');
}

export interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
  /** Reads one line, or returns null at the end of input. */
  readLine: (prompt: string) => Promise<string | null>;
}

const processIo: Io = {
  out: text => void process.stdout.write(text),
  err: text => void process.stderr.write(text),
  readLine: async prompt => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await rl.question(prompt);
    } catch {
      return null;
    } finally {
      rl.close();
    }
  }
};

export async function main(argv: string[], env: Record<string, string | undefined> = process.env, io: Io = processIo): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        provider: { type: 'string', short: 'p', default: env.LLM_PROVIDER || 'anthropic' },
        model: { type: 'string', short: 'm' },
        'base-url': { type: 'string' },
        system: { type: 'string', default: SYSTEM },
        'no-tools': { type: 'boolean', default: false },
        'list-providers': { type: 'boolean', default: false },
        'list-models': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false }
      }
    });
  } catch (error) {
    io.err(`error: ${(error as Error).message}\n`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    io.out(HELP + '\n');
    return 0;
  }
  if (values['list-providers']) {
    io.out(describeProviders() + '\n');
    return 0;
  }
  try {
    const provider: Provider = makeProvider(values.provider, { model: values.model, baseURL: values['base-url'], env });
    if (values['list-models']) {
      io.out((await provider.listModels()).join('\n') + '\n');
      return 0;
    }
    const tools = values['no-tools'] ? [] : defaultTools();
    const history: HistoryItem[] = [];
    const ask = async (text: string): Promise<void> => {
      const turn = await runTurn(provider, history, text, tools, {
        system: values.system,
        onText: chunk => io.out(chunk),
        onTool: (call: ToolCall) => io.err(`  [tool] ${call.name}(${JSON.stringify(call.arguments)})\n`)
      });
      io.out('\n');
      if (turn.stopReason === 'refusal') io.err(`[The model declined this request${turn.detail ? ': ' + turn.detail : ''}.]\n`);
      else if (turn.stopReason === 'max_tokens') io.err('[The answer was cut off. Raise LLM_MAX_TOKENS to allow a longer one.]\n');
    };
    if (positionals.length) {
      await ask(positionals.join(' '));
      return 0;
    }
    io.err(`Chatting with ${provider.name} (${provider.model}). Type /reset to start over or /exit to quit.\n`);
    for (;;) {
      const line = await io.readLine('you> ');
      if (line === null) return 0;
      const text = line.trim();
      if (text === '/exit' || text === '/quit') return 0;
      if (text === '/reset') history.length = 0;
      else if (text) await ask(text);
    }
  } catch (error) {
    if (error instanceof ConfigError || error instanceof AgentError) {
      io.err(`error: ${error.message}\n`);
      return 2;
    }
    // The SDKs raise their own typed errors, for example for a bad key or a rate limit.
    io.err(`error: ${(error as Error).name}: ${(error as Error).message}\n`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
