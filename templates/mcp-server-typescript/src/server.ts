// A small Model Context Protocol server: three tools, a resource, and a prompt.
//
// An MCP server lets an AI application such as Claude Desktop or Claude Code call your code. Tools do
// work, resources expose data the model can read, and prompts are reusable instructions the user can pick.
//
// Over stdio the protocol uses stdout, so never call console.log. Write logs with console.error.
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

export const MAX_TEXT = 100_000;

// Replace this with your own data source. Anything a resource returns becomes context for the model.
export const NOTES: Record<string, string> = {
  welcome: 'This note is served by the notes://{name} resource template.',
  'next-steps': 'Add your own tools in src/server.ts, then run the tests with `npm test`.'
};

// Every tool here only reads its arguments, so say so. Clients use these hints to decide what to confirm.
const readOnly = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };

function failure(message: string) {
  // A result with isError tells the model the call failed and why, so it can react. Throwing does the same
  // for unexpected errors; use this for failures you anticipated.
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: '__PROJECT_NAME__', version: '0.1.0' },
    {
      instructions:
        'Use add for arithmetic, text_stats to measure text, and slugify to make URL-safe names. ' +
        'Read notes://index to see the available notes.'
    }
  );

  server.registerTool(
    'add',
    {
      description: 'Add two numbers.',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      outputSchema: z.object({ sum: z.number() }),
      annotations: readOnly
    },
    async ({ a, b }) => {
      const output = { sum: a + b };
      return { content: [{ type: 'text', text: String(output.sum) }], structuredContent: output };
    }
  );

  server.registerTool(
    'text_stats',
    {
      description: 'Count the words, characters, and lines in some text.',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({
        words: z.number().describe('Number of whitespace-separated words'),
        characters: z.number(),
        lines: z.number(),
        longestWord: z.string()
      }),
      annotations: readOnly
    },
    async ({ text }) => {
      if (text.length > MAX_TEXT) return failure(`The text is too long. Send at most ${MAX_TEXT} characters.`);
      const words = text.split(/\s+/).filter(Boolean);
      const output = {
        words: words.length,
        characters: text.length,
        lines: text === '' ? 0 : text.split(/\r?\n/).length,
        longestWord: words.reduce((longest, word) => (word.length > longest.length ? word : longest), '')
      };
      return { content: [{ type: 'text', text: JSON.stringify(output) }], structuredContent: output };
    }
  );

  server.registerTool(
    'slugify',
    {
      description: 'Turn text into a lowercase, hyphen-separated slug that is safe to use in a URL.',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ slug: z.string() }),
      annotations: readOnly
    },
    async ({ text }) => {
      const slug = text
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!slug) return failure('The text has no letters or digits to make a slug from.');
      return { content: [{ type: 'text', text: slug }], structuredContent: { slug } };
    }
  );

  server.registerResource(
    'notes-index',
    'notes://index',
    { title: 'Note names', description: 'The names of the available notes.', mimeType: 'text/plain' },
    async uri => ({ contents: [{ uri: uri.href, text: Object.keys(NOTES).sort().join('\n') }] })
  );

  server.registerResource(
    'note',
    new ResourceTemplate('notes://{name}', {
      list: async () => ({
        resources: Object.keys(NOTES).map(name => ({ uri: `notes://${name}`, name: `Note: ${name}` }))
      })
    }),
    { title: 'A note', description: 'The text of one note.', mimeType: 'text/plain' },
    async (uri, { name }) => {
      const text = typeof name === 'string' ? NOTES[name] : undefined;
      if (text === undefined) throw new Error(`There is no note named '${String(name)}'.`);
      return { contents: [{ uri: uri.href, text }] };
    }
  );

  server.registerPrompt(
    'review-code',
    {
      title: 'Code review',
      description: 'Ask for a careful code review.',
      argsSchema: z.object({ code: z.string(), language: z.string().optional() })
    },
    ({ code, language }) => {
      const lang = language ?? 'typescript';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Review this ${lang} code. List real bugs first, then risks, then style. Quote the lines you mean.\n\n\`\`\`${lang}\n${code}\n\`\`\``
            }
          }
        ]
      };
    }
  );

  return server;
}
