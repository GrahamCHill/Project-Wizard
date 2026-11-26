// Starts the server as a subprocess, the way Claude Desktop and Claude Code do, and talks to it over stdio.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('a real client can call the server over stdio', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../src/index.ts', import.meta.url))]
  });
  const client = new Client({ name: 'stdio-test', version: '1.0.0' });
  await client.connect(transport);
  try {
    assert.equal(client.getServerVersion()?.name, '__PROJECT_NAME__');
    assert.equal((await client.listTools()).tools.length, 3);
    const result = await client.callTool({ name: 'add', arguments: { a: 20, b: 22 } });
    assert.deepEqual(result.structuredContent, { sum: 42 });
  } finally {
    await client.close();
  }
});
