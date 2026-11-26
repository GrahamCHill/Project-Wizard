// A Cloudflare Worker is a function that receives a Request and returns a Response. It runs close to
// your users on Cloudflare's network, so there is no server to manage.
//
// `fetch` is the whole interface. Tests call it directly with a Request, so they need no running server.

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const MAX_NAME_LENGTH = 50;

/** A JSON response. Every API answer goes through here so the headers stay consistent. */
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

/** Builds the greeting for a name taken from the query string. Returns an error text for a bad name. */
export function greeting(rawName) {
  const name = (rawName ?? '').trim() || 'world';
  if (name.length > MAX_NAME_LENGTH) return { error: `The name must be at most ${MAX_NAME_LENGTH} characters.` };
  // Names are echoed inside JSON, never into HTML, so no escaping is needed here. Escape them if you render a page.
  return { message: `Hello, ${name}!` };
}

/** Counts visits in Workers KV. KV is eventually consistent, so treat the number as approximate. */
async function countVisit(env) {
  if (!env.VISITS) return json({ error: 'No VISITS KV namespace is bound. See wrangler.jsonc.' }, 501);
  const visits = (Number(await env.VISITS.get('count')) || 0) + 1;
  await env.VISITS.put('count', String(visits));
  return json({ visits });
}

export default {
  /**
   * @param {Request} request
   * @param {{ VISITS?: { get(key: string): Promise<string | null>, put(key: string, value: string): Promise<void> } }} env
   */
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const method = request.method;

    if (url.pathname === '/') {
      return json({ name: '__PROJECT_NAME__', endpoints: ['/healthz', '/api/greet?name=Ada', '/api/visits'] });
    }
    if (url.pathname === '/healthz') return json({ status: 'ok' });

    if (url.pathname === '/api/greet') {
      if (method !== 'GET') return json({ error: 'Method not allowed.' }, 405, { allow: 'GET' });
      const result = greeting(url.searchParams.get('name'));
      return 'error' in result ? json(result, 400) : json(result);
    }

    if (url.pathname === '/api/visits') {
      if (method !== 'POST') return json({ error: 'Send a POST request to count a visit.' }, 405, { allow: 'POST' });
      return countVisit(env);
    }

    return json({ error: 'Not found.' }, 404);
  }
};
