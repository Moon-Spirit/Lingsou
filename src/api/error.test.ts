import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { registerErrorHandlers } from './errorHandler.js';
import { SearchQuerySchema } from './schemas.js';

async function buildTestApp() {
  const app = Fastify({ logger: false });
  registerErrorHandlers(app);
  app.get('/ok', async () => ({ ok: true }));
  app.get('/throw', async () => { throw new Error('boom'); });
  app.get('/search', async (req) => {
    const query = SearchQuerySchema.parse(req.query);
    return query;
  });
  return app;
}

describe('error handlers', () => {
  it('returns 200 on success', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/ok' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('returns 404 for unknown routes', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    await app.close();
  });

  it('returns 500 for unhandled throws (no stack leak)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/throw' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('boom');
    await app.close();
  });

  it('returns 400 VALIDATION_ERROR when q is missing', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/search' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });
});
