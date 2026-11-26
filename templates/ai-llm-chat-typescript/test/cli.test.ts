import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeProviders, main, type Io } from '../src/cli.ts';
import { PRESETS } from '../src/providers.ts';
import { chatReply, withServer } from '../test-support/mock-llm.ts';

function capture(lines: string[] = []): Io & { stdout: string; stderr: string } {
  const queue = [...lines];
  const io = {
    stdout: '',
    stderr: '',
    out: (text: string) => void (io.stdout += text),
    err: (text: string) => void (io.stderr += text),
    readLine: async () => queue.shift() ?? null
  };
  return io;
}

describe('cli', () => {
  it('lists every provider and what it needs', async () => {
    const io = capture();
    assert.equal(await main(['--list-providers'], {}, io), 0);
    for (const name of Object.keys(PRESETS)) assert.ok(io.stdout.includes(name), name);
    assert.match(io.stdout, /GROQ_API_KEY/);
    assert.match(describeProviders(), /ANTHROPIC_API_KEY/);
  });

  it('shows help', async () => {
    const io = capture();
    assert.equal(await main(['--help'], {}, io), 0);
    assert.match(io.stdout, /--list-models/);
  });

  it('asks one question and prints the answer', () =>
    withServer(async server => {
      server.reply(chatReply('Paris.'));
      const io = capture();
      const code = await main(['--provider', 'groq', '--no-tools', 'Capital', 'of', 'France?'], { GROQ_API_KEY: 'k', GROQ_BASE_URL: server.url }, io);
      assert.deepEqual([code, io.stdout], [0, 'Paris.\n']);
      assert.equal(server.requests[0]!.body.messages.at(-1).content, 'Capital of France?');
      assert.equal('tools' in server.requests[0]!.body, false);
    }));

  it('shows each tool call on stderr', () =>
    withServer(async server => {
      server.reply(chatReply('', [['call_1', 'calculate', '{"expression": "6*7"}']]), chatReply('42'));
      const io = capture();
      const code = await main(['-p', 'groq', '6*7?'], { GROQ_API_KEY: 'k', GROQ_BASE_URL: server.url }, io);
      assert.deepEqual([code, io.stdout], [0, '42\n']);
      assert.match(io.stderr, /\[tool\] calculate\(\{"expression":"6\*7"\}\)/);
    }));

  it('explains a missing key with exit code 2', async () => {
    const io = capture();
    assert.equal(await main(['-p', 'groq', 'hi'], {}, io), 2);
    assert.match(io.stderr, /Set GROQ_API_KEY/);
  });

  it('takes the provider from the environment', async () => {
    const io = capture();
    assert.equal(await main(['hi'], { LLM_PROVIDER: 'openai' }, io), 2);
    assert.match(io.stderr, /OPENAI_API_KEY/);
  });

  it('rejects an unknown option', async () => {
    const io = capture();
    assert.equal(await main(['--nope'], {}, io), 2);
    assert.match(io.stderr, /error:/);
  });

  it('keeps the history until /reset', () =>
    withServer(async server => {
      server.reply(chatReply('one'), chatReply('two'), chatReply('three'));
      const io = capture(['first', 'second', '/reset', 'third', '/exit']);
      assert.equal(await main(['-p', 'groq', '--no-tools'], { GROQ_API_KEY: 'k', GROQ_BASE_URL: server.url }, io), 0);
      assert.equal(io.stdout, 'one\ntwo\nthree\n');
      assert.deepEqual(server.requests.map(request => request.body.messages.length), [2, 4, 2]);
    }));

  it('lists models', () =>
    withServer(async server => {
      const io = capture();
      assert.equal(await main(['-p', 'anthropic', '--list-models'], { ANTHROPIC_API_KEY: 'k', ANTHROPIC_BASE_URL: server.url }, io), 0);
      assert.deepEqual(io.stdout.split('\n').filter(Boolean), ['model-a', 'model-b']);
    }));
});
