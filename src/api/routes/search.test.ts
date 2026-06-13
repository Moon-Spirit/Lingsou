import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('search API', () => {
  it('GET /api/health returns ok with meili status', async () => {
    const res = await request(app.server).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.meili).toBe('available');
  });

  it('GET /api/search with empty q returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app.server).get('/api/search?q=');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/search without q returns 404 (route missing)', async () => {
    // Fastify schema rejects missing required querystring fields as 404 by default
    const res = await request(app.server).get('/api/search');
    expect([400, 404]).toContain(res.status);
  });

  it('GET /api/search with q returns 200 + hits array', async () => {
    const res = await request(app.server).get('/api/search?q=InfoQ');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.hits)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.query).toBe('InfoQ');
  });

  it('GET /api/suggest with q returns suggestions array', async () => {
    const res = await request(app.server).get('/api/suggest?q=InfoQ');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.query).toBe('InfoQ');
  });

  it('GET /api/suggest with empty q returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app.server).get('/api/suggest?q=');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/history returns empty items list', async () => {
    const res = await request(app.server).get('/api/history');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });
});