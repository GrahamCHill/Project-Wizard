import express from 'express';

export const app = express();
app.disable('x-powered-by');

app.get('/healthz', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/hello', (request, response) => {
  const name = request.query.name;
  if (name !== undefined && (typeof name !== 'string' || name.trim().length > 100)) {
    response.status(400).json({ error: 'name must be a string of at most 100 characters' });
    return;
  }
  response.json({ message: `Hello, ${typeof name === 'string' ? name.trim() || 'world' : 'world'}!` });
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});
