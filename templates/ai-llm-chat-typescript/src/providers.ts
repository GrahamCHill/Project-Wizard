// Provider adapters.
//
// Every adapter streams one assistant turn and returns it in a neutral form, so the chat loop in agent.ts
// never needs to know which API is behind it.
//
// * Claude uses the official Anthropic SDK.
// * Groq uses the official Groq SDK.
// * Everything else that speaks the OpenAI chat completions protocol (OpenAI, Together, Mistral, OpenRouter,
//   DeepSeek, xAI, Gemini, Ollama, LM Studio, vLLM, ...) uses the OpenAI SDK with a base URL.
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import OpenAI from 'openai';

// --- Neutral types -------------------------------------------------------------------------------------

export interface JsonSchema {
  type: 'object';
  properties: Record<string, { type?: string; description?: string }>;
  required: string[];
  // JSON Schema allows more keywords. The Anthropic SDK's input type expects this index signature.
  [keyword: string]: unknown;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Set when the model sent arguments that were not valid JSON, so the loop can tell it so. */
  error?: string;
}

export interface ToolResult {
  id: string;
  name: string;
  content: string;
  isError: boolean;
}

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';

export interface Turn {
  text: string;
  toolCalls: ToolCall[];
  stopReason: StopReason;
  provider: string;
  model: string;
  /** The provider's own assistant message. Claude needs its thinking blocks sent back unchanged. */
  native?: unknown;
  detail: string;
}

export type HistoryItem =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls: ToolCall[]; native?: unknown; provider: string }
  | { role: 'tool'; results: ToolResult[] };

export class ConfigError extends Error {}

export interface Provider {
  name: string;
  model: string;
  streamTurn(system: string | undefined, history: HistoryItem[], tools: ToolSpec[], onText: (text: string) => void): Promise<Turn>;
  listModels(): Promise<string[]>;
}

// --- Claude (Anthropic SDK) ----------------------------------------------------------------------------

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

type StreamParams = Parameters<Anthropic['beta']['messages']['stream']>[0];

export interface AnthropicOptions {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  thinking?: boolean;
  fallbacks?: boolean;
  client?: Anthropic;
}

export class AnthropicProvider implements Provider {
  readonly name = 'anthropic';
  readonly model: string;
  private readonly client: Anthropic;
  private readonly maxTokens: number;
  private readonly effort: AnthropicOptions['effort'];
  private readonly thinking: boolean;
  private readonly fallbacks: boolean;

  constructor(options: AnthropicOptions = {}) {
    // With no key, the SDK reads ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile.
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey ?? null, baseURL: options.baseURL ?? null });
    this.model = options.model ?? DEFAULT_CLAUDE_MODEL;
    this.maxTokens = options.maxTokens ?? 64000;
    this.effort = options.effort;
    this.thinking = options.thinking ?? true;
    this.fallbacks = options.fallbacks ?? true;
  }

  static messages(history: HistoryItem[]): Anthropic.Beta.BetaMessageParam[] {
    const out: Anthropic.Beta.BetaMessageParam[] = [];
    for (const item of history) {
      if (item.role === 'user') {
        out.push({ role: 'user', content: item.text });
      } else if (item.role === 'assistant') {
        if (item.provider === 'anthropic' && item.native) {
          // Send the blocks back exactly as received, including any thinking blocks.
          out.push({ role: 'assistant', content: item.native as Anthropic.Beta.BetaContentBlockParam[] });
        } else {
          const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
          if (item.text) blocks.push({ type: 'text', text: item.text });
          for (const call of item.toolCalls) blocks.push({ type: 'tool_use', id: call.id, name: call.name, input: call.arguments });
          out.push({ role: 'assistant', content: blocks });
        }
      } else {
        // Tool results go back in a single user message.
        out.push({
          role: 'user',
          content: item.results.map(result => ({
            type: 'tool_result' as const,
            tool_use_id: result.id,
            content: result.content,
            is_error: result.isError
          }))
        });
      }
    }
    return out;
  }

  async streamTurn(system: string | undefined, history: HistoryItem[], tools: ToolSpec[], onText: (text: string) => void): Promise<Turn> {
    const params: StreamParams = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: AnthropicProvider.messages(history),
      ...(system ? { system } : {}),
      ...(this.thinking ? { thinking: { type: 'adaptive' as const } } : {}),
      ...(this.effort ? { output_config: { effort: this.effort } } : {}),
      // eager_input_streaming streams large tool inputs as they are generated. The API then no longer
      // validates them, which is why the agent loop checks every input before it runs a tool.
      ...(tools.length
        ? {
            tools: tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.parameters,
              eager_input_streaming: true
            }))
          }
        : {}),
      // Lets the API retry on another model if a safety classifier declines the request.
      ...(this.fallbacks ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {})
    };
    const stream = this.client.beta.messages.stream(params);
    stream.on('text', onText);
    const message = await stream.finalMessage();

    const toolCalls: ToolCall[] = [];
    let text = '';
    for (const block of message.content) {
      if (block.type === 'text') text += block.text;
      if (block.type === 'tool_use') {
        const valid = typeof block.input === 'object' && block.input !== null && !Array.isArray(block.input);
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: valid ? (block.input as Record<string, unknown>) : {},
          ...(valid ? {} : { error: 'Tool input was not a JSON object.' })
        });
      }
    }
    const reasons: Record<string, StopReason> = { end_turn: 'end_turn', tool_use: 'tool_use', max_tokens: 'max_tokens', refusal: 'refusal' };
    const details = (message as { stop_details?: { category?: string | null } | null }).stop_details;
    return {
      text,
      toolCalls,
      stopReason: reasons[message.stop_reason ?? ''] ?? 'other',
      provider: this.name,
      model: message.model,
      native: message.content,
      detail: message.stop_reason === 'refusal' ? (details?.category ?? '') : ''
    };
  }

  async listModels(): Promise<string[]> {
    const ids: string[] = [];
    for await (const model of this.client.models.list()) ids.push(model.id);
    return ids.sort();
  }
}

// --- Chat completions (Groq SDK and OpenAI SDK) --------------------------------------------------------

interface ChatChunk {
  choices: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{ index?: number; id?: string | null; function?: { name?: string | null; arguments?: string | null } | null }>;
    } | null;
    finish_reason?: string | null;
  }>;
}

/** The part of the Groq and OpenAI clients that this adapter uses. */
export interface ChatClient {
  chat: { completions: { create(params: Record<string, unknown>): Promise<AsyncIterable<ChatChunk>> } };
  models: { list(): PromiseLike<{ data: Array<{ id: string }> }> };
}

export function toChatMessages(system: string | undefined, history: HistoryItem[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = system ? [{ role: 'system', content: system }] : [];
  for (const item of history) {
    if (item.role === 'user') {
      out.push({ role: 'user', content: item.text });
    } else if (item.role === 'assistant') {
      const message: Record<string, unknown> = { role: 'assistant', content: item.text || null };
      if (item.toolCalls.length) {
        message.tool_calls = item.toolCalls.map(call => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.arguments) }
        }));
      }
      out.push(message);
    } else {
      for (const result of item.results) {
        out.push({ role: 'tool', tool_call_id: result.id, content: (result.isError ? 'Error: ' : '') + result.content });
      }
    }
  }
  return out;
}

function parseArguments(raw: string): { value: Record<string, unknown>; error?: string } {
  try {
    const value: unknown = JSON.parse(raw || '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return { value: {}, error: 'Tool arguments were not a JSON object.' };
    return { value: value as Record<string, unknown> };
  } catch (error) {
    return { value: {}, error: `Tool arguments were not valid JSON: ${(error as Error).message}.` };
  }
}

export class ChatCompletionsProvider implements Provider {
  readonly name: string;
  readonly model: string;
  private readonly client: ChatClient;
  private readonly maxTokens: number;
  private readonly maxTokensParam: string;

  constructor(name: string, client: ChatClient, model: string, maxTokens = 4096, maxTokensParam = 'max_tokens') {
    this.name = name;
    this.client = client;
    this.model = model;
    this.maxTokens = maxTokens;
    this.maxTokensParam = maxTokensParam;
  }

  async streamTurn(system: string | undefined, history: HistoryItem[], tools: ToolSpec[], onText: (text: string) => void): Promise<Turn> {
    const params: Record<string, unknown> = {
      model: this.model,
      messages: toChatMessages(system, history),
      stream: true,
      [this.maxTokensParam]: this.maxTokens
    };
    if (tools.length) {
      params.tools = tools.map(tool => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } }));
    }
    let text = '';
    let finish: string | null | undefined;
    const slots = new Map<number | string, { id: string; name: string; arguments: string }>();
    for await (const chunk of await this.client.chat.completions.create(params)) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta;
      if (delta?.content) {
        text += delta.content;
        onText(delta.content);
      }
      for (const part of delta?.tool_calls ?? []) {
        // Servers number tool calls with `index`. A few send whole calls without one.
        const key = part.index ?? part.id ?? slots.size;
        const slot = slots.get(key) ?? { id: '', name: '', arguments: '' };
        slot.id = part.id ?? slot.id;
        slot.name = part.function?.name ?? slot.name;
        slot.arguments += part.function?.arguments ?? '';
        slots.set(key, slot);
      }
      finish = choice.finish_reason ?? finish;
    }
    const toolCalls: ToolCall[] = [...slots.values()].map((slot, position) => {
      const { value, error } = parseArguments(slot.arguments);
      return { id: slot.id || `call_${position}`, name: slot.name, arguments: value, ...(error ? { error } : {}) };
    });
    const reasons: Record<string, StopReason> = { stop: 'end_turn', tool_calls: 'tool_use', length: 'max_tokens', content_filter: 'refusal' };
    const stopReason: StopReason = toolCalls.length ? 'tool_use' : (finish ? (reasons[finish] ?? 'other') : 'end_turn');
    return { text, toolCalls, stopReason, provider: this.name, model: this.model, detail: '' };
  }

  async listModels(): Promise<string[]> {
    return (await this.client.models.list()).data.map(model => model.id).sort();
  }
}

// --- Presets and construction --------------------------------------------------------------------------

export interface Preset {
  kind: 'anthropic' | 'groq' | 'openai';
  keyEnv: string;
  baseURL: string;
  defaultModel: string;
  keyRequired: boolean;
  maxTokensParam: string;
  note: string;
}

function preset(kind: Preset['kind'], keyEnv: string, baseURL = '', extra: Partial<Preset> = {}): Preset {
  return { kind, keyEnv, baseURL, defaultModel: '', keyRequired: true, maxTokensParam: 'max_tokens', note: '', ...extra };
}

// Base URLs and variable names come from each provider's documentation. Check them if a request fails.
export const PRESETS: Record<string, Preset> = {
  anthropic: preset('anthropic', 'ANTHROPIC_API_KEY', '', {
    defaultModel: DEFAULT_CLAUDE_MODEL, keyRequired: false, note: 'Claude. Also accepts ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile.'
  }),
  groq: preset('groq', 'GROQ_API_KEY', '', {
    defaultModel: 'llama-3.3-70b-versatile', maxTokensParam: 'max_completion_tokens', note: "Groq's own SDK. Run `--list-models` to see the models your key can use."
  }),
  openai: preset('openai', 'OPENAI_API_KEY', 'https://api.openai.com/v1', { maxTokensParam: 'max_completion_tokens' }),
  together: preset('openai', 'TOGETHER_API_KEY', 'https://api.together.xyz/v1'),
  mistral: preset('openai', 'MISTRAL_API_KEY', 'https://api.mistral.ai/v1'),
  openrouter: preset('openai', 'OPENROUTER_API_KEY', 'https://openrouter.ai/api/v1'),
  deepseek: preset('openai', 'DEEPSEEK_API_KEY', 'https://api.deepseek.com'),
  xai: preset('openai', 'XAI_API_KEY', 'https://api.x.ai/v1'),
  gemini: preset('openai', 'GEMINI_API_KEY', 'https://generativelanguage.googleapis.com/v1beta/openai/'),
  ollama: preset('openai', '', 'http://localhost:11434/v1', { keyRequired: false, note: 'Local. Start Ollama first.' }),
  lmstudio: preset('openai', '', 'http://localhost:1234/v1', { keyRequired: false, note: 'Local. Start the LM Studio server.' }),
  custom: preset('openai', 'LLM_API_KEY', '', { keyRequired: false, note: 'Any OpenAI-compatible server. Set LLM_BASE_URL, and LLM_API_KEY if it needs one.' })
};

type Env = Record<string, string | undefined>;

function number(env: Env, name: string, fallback: number): number {
  const value = (env[name] ?? '').trim();
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) throw new ConfigError(`${name} must be a whole number, not '${value}'.`);
  return Number(value);
}

export interface MakeProviderOptions {
  model?: string;
  baseURL?: string;
  env?: Env;
  /** Substitute the SDK client, for example in tests. */
  client?: unknown;
}

/** Builds the adapter for a preset name. */
export function makeProvider(name: string, options: MakeProviderOptions = {}): Provider {
  const env = options.env ?? process.env;
  const selected = PRESETS[name];
  if (!selected) throw new ConfigError(`Unknown provider '${name}'. Choose one of: ${Object.keys(PRESETS).join(', ')}.`);
  const key = selected.keyEnv ? (env[selected.keyEnv] ?? '').trim() : '';
  const model = options.model || (env.LLM_MODEL ?? '').trim() || selected.defaultModel;
  const baseURL = options.baseURL || (env.LLM_BASE_URL ?? '').trim() || selected.baseURL;
  if (selected.kind === 'anthropic') {
    const effort = (env.ANTHROPIC_EFFORT ?? '').trim();
    return new AnthropicProvider({
      model,
      apiKey: key || undefined,
      baseURL: env.ANTHROPIC_BASE_URL || options.baseURL || undefined,
      maxTokens: number(env, 'LLM_MAX_TOKENS', 64000),
      effort: (effort || undefined) as AnthropicOptions['effort'],
      thinking: (env.ANTHROPIC_THINKING ?? 'adaptive').trim().toLowerCase() !== 'off',
      fallbacks: (env.ANTHROPIC_FALLBACKS ?? 'default').trim().toLowerCase() !== 'off',
      client: options.client as Anthropic | undefined
    });
  }
  if (selected.keyRequired && !key && !options.client) throw new ConfigError(`Set ${selected.keyEnv} to use ${name}.`);
  if (!model) throw new ConfigError(`Choose a model for ${name} with --model or LLM_MODEL.`);
  if (name === 'custom' && !baseURL) throw new ConfigError('Set LLM_BASE_URL (or pass --base-url) for the custom provider.');
  const maxTokens = number(env, 'LLM_MAX_TOKENS', 4096);
  let client = options.client as ChatClient | undefined;
  if (!client) {
    client = (selected.kind === 'groq'
      ? new Groq({ apiKey: key, baseURL: options.baseURL || env.GROQ_BASE_URL || null })
      // Local servers ignore the key, but the SDK insists on a non-empty one.
      : new OpenAI({ apiKey: key || 'not-needed', baseURL })) as unknown as ChatClient;
  }
  return new ChatCompletionsProvider(name, client, model, maxTokens, selected.maxTokensParam);
}
