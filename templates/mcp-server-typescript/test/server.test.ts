// Tests the server in memory: a client and the server are joined by a linked pair of transports,
// so there is no subprocess and no network.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer, MAX_TEXT } from '../src/server.ts';

let client: Client;
let close: () => Promise<void>;

beforeEach(async () => {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  close = async () => {
    await client.close();
    await server.close();
  };
});

afterEach(async () => {
  await close();
});

const text = (result: { content?: unknown }): string[] =>
  (result.content as Array<{ type: string; text?: string }>).filter(block => block.type === 'text').map(block => block.text ?? '');

describe('server', () => {
  it('describes itself to clients', () => {
    assert.equal(client.getServerVersion()?.name, '__PROJECT_NAME__');
    assert.match(client.getInstructions() ?? '', /text_stats/);
  });

  it('lists tools with schemas and read-only hints', async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(), ['add', 'slugify', 'text_stats']);
    const add = tools.find(tool => tool.name === 'add');
    assert.deepEqual(add?.inputSchema.required, ['a', 'b']);
    for (const tool of tools) assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
    const stats = tools.find(tool => tool.name === 'text_stats');
    assert.deepEqual(Object.keys(stats?.outputSchema?.properties ?? {}).sort(), ['characters', 'lines', 'longestWord', 'words']);
  });

  it('adds numbers', async () => {
    const result = await client.callTool({ name: 'add', arguments: { a: 2, b: 40.5 } });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, { sum: 42.5 });
    assert.deepEqual(text(result), ['42.5']);
  });

  it('validates arguments against the schema', async () => {
    const result = await client.callTool({ name: 'add', arguments: { a: 'two', b: 1 } });
    assert.equal(result.isError, true);
  });

  it('returns structured text statistics', async () => {
    const result = await client.callTool({ name: 'text_stats', arguments: { text: 'one two\nthree' } });
    assert.deepEqual(result.structuredContent, { words: 3, characters: 13, lines: 2, longestWord: 'three' });
    const empty = await client.callTool({ name: 'text_stats', arguments: { text: '' } });
    assert.deepEqual(empty.structuredContent, { words: 0, characters: 0, lines: 0, longestWord: '' });
  });

  it('reports anticipated failures as failed tool calls the model can read', async () => {
    const tooLong = await client.callTool({ name: 'text_stats', arguments: { text: 'x'.repeat(MAX_TEXT + 1) } });
    assert.equal(tooLong.isError, true);
    assert.match(text(tooLong)[0] ?? '', /too long/);
    const empty = await client.callTool({ name: 'slugify', arguments: { text: '***' } });
    assert.equal(empty.isError, true);
  });

  it('makes slugs', async () => {
    for (const [input, slug] of [['Hello, World!', 'hello-world'], ['  Café  au lait  ', 'cafe-au-lait'], ['A--B__C', 'a-b-c']] as const) {
      const result = await client.callTool({ name: 'slugify', arguments: { text: input } });
      assert.deepEqual(result.structuredContent, { slug }, input);
    }
  });

  it('serves a static resource and a resource template', async () => {
    const { resources } = await client.listResources();
    assert.ok(resources.some(resource => resource.uri === 'notes://index'));
    assert.ok(resources.some(resource => resource.uri === 'notes://welcome'));
    const { resourceTemplates } = await client.listResourceTemplates();
    assert.deepEqual(resourceTemplates.map(template => template.uriTemplate), ['notes://{name}']);
    const index = await client.readResource({ uri: 'notes://index' });
    assert.equal((index.contents[0] as { text: string }).text, 'next-steps\nwelcome');
    const note = await client.readResource({ uri: 'notes://welcome' });
    assert.match((note.contents[0] as { text: string }).text, /resource template/);
  });

  it('rejects a note that does not exist', async () => {
    await assert.rejects(client.readResource({ uri: 'notes://missing' }), /no note named 'missing'/);
  });

  it('builds a review prompt', async () => {
    const { prompts } = await client.listPrompts();
    assert.deepEqual(prompts.map(prompt => prompt.name), ['review-code']);
    const prompt = await client.getPrompt({ name: 'review-code', arguments: { code: 'let x = 1', language: 'typescript' } });
    assert.equal(prompt.messages[0]?.role, 'user');
    assert.match((prompt.messages[0]?.content as { text: string }).text, /```typescript\nlet x = 1\n```/);
  });
});
