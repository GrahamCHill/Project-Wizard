// A local server that speaks the streaming protocols of Anthropic and of OpenAI-style APIs.
//
// The tests point the real SDKs at it, so they check the requests the SDKs send and how they parse a
// streamed reply, without a network or an API key. Queue replies with `server.reply(...)`, then read the
// requests the SDK made from `server.requests`.
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

type Json = Record<string, unknown>;

export interface RecordedRequest {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  body: any;
}

function sse(events: Array<[string | null, Json | string]>): string {
  return events.map(([name, data]) => (name ? `event: ${name}\n` : '') + `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`).join('');
}

const halves = (text: string): [string, string] => [text.slice(0, Math.floor(text.length / 2)), text.slice(Math.floor(text.length / 2))];

export function anthropicReply(
  text = '',
  toolCalls: Array<[string, string, unknown]> = [],
  stop = 'end_turn',
  stopDetails?: Json,
  model = 'claude-opus-5-5'
): string {
  const events: Array<[string | null, Json | string]> = [
    ['message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }]
  ];
  let index = 0;
  if (text) {
    events.push(['content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } }]);
    for (const piece of halves(text)) events.push(['content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: piece } }]);
    events.push(['content_block_stop', { type: 'content_block_stop', index }]);
    index++;
  }
  for (const [id, name, args] of toolCalls) {
    const raw = typeof args === 'string' ? args : JSON.stringify(args);
    events.push(['content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id, name, input: {} } }]);
    for (const piece of halves(raw)) events.push(['content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: piece } }]);
    events.push(['content_block_stop', { type: 'content_block_stop', index }]);
    index++;
  }
  events.push(['message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null, ...(stopDetails ? { stop_details: stopDetails } : {}) }, usage: { output_tokens: 5 } }]);
  events.push(['message_stop', { type: 'message_stop' }]);
  return sse(events);
}

export function chatReply(text = '', toolCalls: Array<[string, string, string]> = [], finish?: string, model = 'test-model'): string {
  const chunk = (delta: Json, reason: string | null = null): [null, Json] => [
    null,
    { id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 1, model, choices: [{ index: 0, delta, finish_reason: reason }] }
  ];
  const events: Array<[null, Json | string]> = [chunk({ role: 'assistant', content: '' })];
  if (text) for (const piece of halves(text)) events.push(chunk({ content: piece }));
  toolCalls.forEach(([id, name, raw], position) => {
    events.push(chunk({ tool_calls: [{ index: position, id, type: 'function', function: { name, arguments: '' } }] }));
    for (const piece of halves(raw)) events.push(chunk({ tool_calls: [{ index: position, function: { arguments: piece } }] }));
  });
  events.push(chunk({}, finish ?? (toolCalls.length ? 'tool_calls' : 'stop')));
  events.push([null, '[DONE]']);
  return sse(events);
}

export type Reply = string | { status: number; body: Json };

export class MockServer {
  readonly requests: RecordedRequest[] = [];
  private readonly replies: Reply[] = [];
  private readonly server: Server;
  url = '';

  constructor() {
    this.server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', chunk => chunks.push(chunk as Buffer));
      request.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        this.requests.push({ method: request.method ?? '', path: request.url ?? '', headers: request.headers, body: raw ? JSON.parse(raw) : {} });
        if (request.method === 'GET') {
          const model = (id: string) => ({ id, object: 'model', type: 'model', display_name: id, created_at: '2026-01-01T00:00:00Z' });
          const payload = JSON.stringify({ object: 'list', data: [model('model-b'), model('model-a')], has_more: false, first_id: 'model-b', last_id: 'model-a' });
          response.writeHead(200, { 'content-type': 'application/json' }).end(payload);
          return;
        }
        const reply = this.replies.shift() ?? '';
        if (typeof reply !== 'string') {
          response.writeHead(reply.status, { 'content-type': 'application/json' }).end(JSON.stringify(reply.body));
          return;
        }
        response.writeHead(200, { 'content-type': 'text/event-stream' }).end(reply);
      });
    });
  }

  reply(...replies: Reply[]): void {
    this.replies.push(...replies);
  }

  async start(): Promise<this> {
    await new Promise<void>(resolve => this.server.listen(0, '127.0.0.1', resolve));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    return this;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }
}

/** Starts a server, runs the callback, and always stops the server. */
export async function withServer<T>(run: (server: MockServer) => Promise<T>): Promise<T> {
  const server = await new MockServer().start();
  try {
    return await run(server);
  } finally {
    await server.stop();
  }
}
