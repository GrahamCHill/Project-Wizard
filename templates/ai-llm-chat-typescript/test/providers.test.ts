// Runs each provider adapter against the mock server, through the real vendor SDK.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import OpenAI from 'openai';
import { runTurn } from '../src/agent.ts';
import { AnthropicProvider, ConfigError, makeProvider, type HistoryItem, type Provider } from '../src/providers.ts';
import { defaultTools } from '../src/tools.ts';
import { anthropicReply, chatReply, withServer } from '../test-support/mock-llm.ts';

async function chat(provider: Provider, text: string, tools = true) {
  const history: HistoryItem[] = [];
  const streamed: string[] = [];
  const turn = await runTurn(provider, history, text, tools ? defaultTools() : [], { onText: chunk => streamed.push(chunk) });
  return { turn, history, streamed: streamed.join('') };
}

describe('Claude', () => {
  const claude = (url: string, env: Record<string, string> = {}) =>
    makeProvider('anthropic', { env: { ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_BASE_URL: url, ...env } });

  it('streams text with the documented request shape', () =>
    withServer(async server => {
      server.reply(anthropicReply('Hello there'));
      const { turn, streamed } = await chat(claude(server.url), 'Hi');
      assert.deepEqual([turn.text, streamed, turn.stopReason, turn.provider], ['Hello there', 'Hello there', 'end_turn', 'anthropic']);
      const request = server.requests[0]!;
      assert.equal(request.headers.authorization, 'Bearer test-key');
      assert.equal(request.body.model, 'claude-opus-5-5');
      assert.equal(request.body.stream, true);
      assert.deepEqual(request.body.thinking, { type: 'adaptive' });
      assert.deepEqual(request.body.messages, [{ role: 'user', content: 'Hi' }]);
      assert.equal(request.body.max_tokens, 64000);
      assert.equal('temperature' in request.body, false);
    }));

  it('turns on refusal fallbacks by default and can turn them off', () =>
    withServer(async server => {
      server.reply(anthropicReply('a'), anthropicReply('b'));
      await chat(claude(server.url), 'Hi');
      await chat(claude(server.url, { ANTHROPIC_FALLBACKS: 'off' }), 'Hi');
      const [enabled, disabled] = server.requests;
      assert.match(String(enabled!.headers['anthropic-beta']), /server-side-fallback-2026-07-01/);
      assert.equal(enabled!.body.fallbacks, 'default');
      assert.equal('fallbacks' in disabled!.body, false);
      assert.doesNotMatch(String(disabled!.headers['anthropic-beta'] ?? ''), /server-side-fallback/);
    }));

  it('follows the environment for thinking, effort, and the token limit', () =>
    withServer(async server => {
      server.reply(anthropicReply('ok'));
      await chat(claude(server.url, { ANTHROPIC_THINKING: 'off', ANTHROPIC_EFFORT: 'high', LLM_MAX_TOKENS: '2000' }), 'Hi');
      const body = server.requests[0]!.body;
      assert.equal('thinking' in body, false);
      assert.deepEqual(body.output_config, { effort: 'high' });
      assert.equal(body.max_tokens, 2000);
    }));

  it('runs tools and sends the results back in one user message', () =>
    withServer(async server => {
      server.reply(
        anthropicReply('Let me check.', [['toolu_1', 'calculate', { expression: '6 * 7' }], ['toolu_2', 'calculate', { expression: '2 ** 5' }]], 'tool_use'),
        anthropicReply('42 and 32')
      );
      const { turn, history, streamed } = await chat(claude(server.url), '6*7 and 2^5?');
      assert.equal(turn.text, '42 and 32');
      assert.equal(streamed, 'Let me check.42 and 32');
      const [first, second] = server.requests.map(request => request.body);
      assert.equal(first.tools[0].name, 'calculate');
      assert.equal(first.tools[0].eager_input_streaming, true);
      assert.deepEqual(first.tools[0].input_schema.required, ['expression']);
      const [, assistant, results] = second.messages;
      assert.deepEqual(assistant.content.map((block: { type: string }) => block.type), ['text', 'tool_use', 'tool_use']);
      assert.deepEqual(assistant.content[1].input, { expression: '6 * 7' });
      assert.equal(results.role, 'user');
      assert.deepEqual(results.content.map((block: any) => [block.tool_use_id, block.content, block.is_error]), [['toolu_1', '42', false], ['toolu_2', '32', false]]);
      assert.deepEqual(history.map(item => item.role), ['user', 'assistant', 'tool', 'assistant']);
    }));

  it('returns an error result for a tool input that fails validation', () =>
    withServer(async server => {
      server.reply(anthropicReply('', [['toolu_1', 'calculate', { expression: 5 }]], 'tool_use'), anthropicReply('Sorry.'));
      await chat(claude(server.url), 'x');
      const result = server.requests[1]!.body.messages[2].content[0];
      assert.equal(result.is_error, true);
      assert.match(result.content, /must be of type string/);
    }));

  it('reports a refusal and its category without running tools', () =>
    withServer(async server => {
      server.reply(anthropicReply('', [], 'refusal', { type: 'refusal', category: 'cyber', explanation: null }));
      const { turn, history } = await chat(claude(server.url), 'x');
      assert.deepEqual([turn.stopReason, turn.detail], ['refusal', 'cyber']);
      assert.equal(history.length, 2);
    }));

  it('rebuilds a turn written by another provider as plain blocks', () => {
    const history: HistoryItem[] = [
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: 'hello', toolCalls: [], provider: 'groq' }
    ];
    assert.deepEqual(AnthropicProvider.messages(history)[1], { role: 'assistant', content: [{ type: 'text', text: 'hello' }] });
  });

  it('lists models', () =>
    withServer(async server => {
      assert.deepEqual(await claude(server.url).listModels(), ['model-a', 'model-b']);
    }));
});

describe('Groq', () => {
  const groq = (url: string, model?: string) => makeProvider('groq', { model, env: { GROQ_API_KEY: 'gsk-test', GROQ_BASE_URL: url } });

  it('uses the Groq endpoint and a default model', () =>
    withServer(async server => {
      server.reply(chatReply('Hi from Groq'));
      const { turn, streamed } = await chat(groq(server.url), 'Hi');
      assert.deepEqual([turn.text, streamed, turn.provider], ['Hi from Groq', 'Hi from Groq', 'groq']);
      const request = server.requests[0]!;
      assert.equal(request.path, '/openai/v1/chat/completions');
      assert.equal(request.headers.authorization, 'Bearer gsk-test');
      assert.equal(request.body.model, 'llama-3.3-70b-versatile');
      assert.equal(request.body.max_completion_tokens, 4096);
      assert.equal(request.body.stream, true);
      assert.deepEqual(request.body.messages, [{ role: 'user', content: 'Hi' }]);
      assert.equal(request.body.tools[0].function.name, 'calculate');
    }));

  it('lets the model be chosen', () =>
    withServer(async server => {
      server.reply(chatReply('ok'));
      await chat(groq(server.url, 'openai/gpt-oss-20b'), 'x');
      assert.equal(server.requests[0]!.body.model, 'openai/gpt-oss-20b');
    }));

  it('runs parallel tool calls', () =>
    withServer(async server => {
      server.reply(chatReply('', [['call_a', 'calculate', '{"expression": "1 + 2"}'], ['call_b', 'get_time', '{"utc_offset_hours": 2}']]), chatReply('done'));
      const { turn } = await chat(groq(server.url), 'x');
      assert.equal(turn.text, 'done');
      const messages = server.requests[1]!.body.messages;
      assert.deepEqual(messages[1].tool_calls.map((call: { id: string }) => call.id), ['call_a', 'call_b']);
      assert.equal(messages[1].tool_calls[0].function.arguments, '{"expression":"1 + 2"}');
      const tools = messages.filter((message: { role: string }) => message.role === 'tool');
      assert.deepEqual(tools.map((message: any) => [message.tool_call_id, message.content[0]]), [['call_a', '3'], ['call_b', '2']]);
    }));

  it('turns invalid JSON arguments into an error the model can read', () =>
    withServer(async server => {
      server.reply(chatReply('', [['call_a', 'calculate', '{"expression": ']]), chatReply('retrying'));
      await chat(groq(server.url), 'x');
      const tool = server.requests[1]!.body.messages.at(-1);
      assert.equal(tool.role, 'tool');
      assert.match(tool.content, /^Error: Tool arguments were not valid JSON/);
    }));

  it('explains a missing key', () => {
    assert.throws(() => makeProvider('groq', { env: {} }), error => error instanceof ConfigError && /GROQ_API_KEY/.test(error.message));
  });
});

describe('OpenAI-compatible servers', () => {
  it('needs no key for a local server, but needs a model', () =>
    withServer(async server => {
      server.reply(chatReply('local reply'));
      const provider = makeProvider('ollama', { model: 'llama3.2', baseURL: server.url + '/v1', env: {} });
      assert.equal((await chat(provider, 'Hi')).turn.text, 'local reply');
      const request = server.requests[0]!;
      assert.equal(request.path, '/v1/chat/completions');
      assert.equal(request.body.model, 'llama3.2');
      assert.equal(request.body.max_tokens, 4096);
      assert.throws(() => makeProvider('ollama', { env: {} }), /Choose a model/);
    }));

  it('uses max_completion_tokens and its key for OpenAI', () =>
    withServer(async server => {
      server.reply(chatReply('ok'));
      await chat(makeProvider('openai', { model: 'any-model', baseURL: server.url + '/v1', env: { OPENAI_API_KEY: 'sk-test' } }), 'x');
      const request = server.requests[0]!;
      assert.equal(request.headers.authorization, 'Bearer sk-test');
      assert.equal(request.body.max_completion_tokens, 4096);
      assert.equal('max_tokens' in request.body, false);
    }));

  it('reads a custom server from the environment', () =>
    withServer(async server => {
      server.reply(chatReply('custom'));
      const env = { LLM_BASE_URL: server.url + '/v1', LLM_MODEL: 'my-model', LLM_MAX_TOKENS: '100' };
      assert.equal((await chat(makeProvider('custom', { env }), 'x')).turn.text, 'custom');
      assert.equal(server.requests[0]!.body.model, 'my-model');
      assert.equal(server.requests[0]!.body.max_tokens, 100);
      assert.throws(() => makeProvider('custom', { model: 'm', env: {} }), /LLM_BASE_URL/);
    }));

  it('reports a length stop and a content filter stop', () =>
    withServer(async server => {
      server.reply(chatReply('partial', [], 'length'), chatReply('', [], 'content_filter'));
      const provider = makeProvider('ollama', { model: 'm', baseURL: server.url + '/v1', env: {} });
      assert.equal((await chat(provider, 'x', false)).turn.stopReason, 'max_tokens');
      assert.equal((await chat(provider, 'x', false)).turn.stopReason, 'refusal');
    }));

  it('lets API errors reach the caller', () =>
    withServer(async server => {
      server.reply({ status: 401, body: { error: { message: 'bad key', type: 'invalid_request_error' } } });
      const provider = makeProvider('openai', { model: 'm', baseURL: server.url + '/v1', env: { OPENAI_API_KEY: 'bad' } });
      await assert.rejects(chat(provider, 'x'), OpenAI.AuthenticationError);
    }));

  it('lists the choices for an unknown provider', () => {
    assert.throws(() => makeProvider('nope', { env: {} }), /Choose one of: anthropic, groq, openai/);
  });
});
