import { createServer } from 'node:http';

const server = createServer((request, response) => {
  const path = request.url?.split('?')[0];
  if (path !== '/') {
    response.writeHead(404).end();
    return;
  }
  if (request.method !== 'GET') {
    response.writeHead(405, { Allow: 'GET' }).end();
    return;
  }

  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ message: 'Hello from __PROJECT_NAME__!' }));
});

server.listen(8080, '127.0.0.1', () => {
  console.log('Listening on http://127.0.0.1:8080');
});
