#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.ts';

// Hosts such as Claude Desktop start this process and talk to it over stdin and stdout.
const handle = serveStdio(createServer);
console.error('Serving over stdio. Press Ctrl+C to stop.');

process.on('SIGINT', () => {
  void handle.close();
});
