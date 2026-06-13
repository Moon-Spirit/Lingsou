import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/api/server.js';
import { pushFixtures, removeFixtures, FIXTURE_DOCS } from './setup.js';

let app: FastifyInstance;

beforeAll(async () => {
  // Push fixtures into the production index so search queries have known docs
  // to match. This is additive — IDs are unique (`fixture-1..3`) and
  // `afterAll` removes them so the production index stays clean.
  await pushFixtures();
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await removeFixtures();
});

describe('API integration', () => {
  it('GET /api/health returns 200 with status ok', async () => {
    const res = await request(app.server).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.meili).toBe('string');
  });

  it('GET /api/search?q=搜索引擎 returns fixture-1 with <mark> highlights', async () => {
    const res = await request(app.server).get('/api/search?q=搜索引擎&limit=20');
    expect(res.status).toBe(200);
    expect(res.body.query).toBe('搜索引擎');
    expect(Array.isArray(res.body.hits)).toBe(true);
    expect(res.body.hits.length).toBeGreaterThan(0);

    const fx1 = res.body.hits.find((h: { id: string }) => h.id === 'fixture-1');
    expect(fx1).toBeDefined();
    expect(fx1.title).toBe('搜索引擎原理详解');
    // Meilisearch wraps matched terms in <mark>...</mark>
    expect(fx1._formatted).toBeDefined();
    expect(fx1._formatted.title).toContain('<mark>');
    expect(fx1._formatted.title).toContain('</mark>');
  });

  it('GET /api/search?q=Meilisearch returns fixture-2', async () => {
    const res = await request(app.server).get('/api/search?q=Meilisearch&limit=20');
    expect(res.status).toBe(200);
    const fx = res.body.hits.find((h: { id: string }) => h.id === 'fixture-2');
    expect(fx).toBeDefined();
    expect(fx.title).toBe('Meilisearch 入门');
  });

  it('GET /api/search?q=Node returns fixture-3', async () => {
    const res = await request(app.server).get('/api/search?q=Node&limit=20');
    expect(res.status).toBe(200);
    const fx = res.body.hits.find((h: { id: string }) => h.id === 'fixture-3');
    expect(fx).toBeDefined();
    expect(fx.title).toBe('Node.js 网络爬虫实战');
  });

  it('GET /api/search returns total/hits/processingTimeMs shape', async () => {
    const res = await request(app.server).get('/api/search?q=引擎');
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBeGreaterThan(0);
    expect(typeof res.body.processingTimeMs).toBe('number');
    expect(res.body.offset).toBe(0);
    expect(res.body.limit).toBe(20);
  });

  it('GET /api/suggest?q=爬虫 returns suggestions array containing fixture-3', async () => {
    const res = await request(app.server).get('/api/suggest?q=爬虫');
    expect(res.status).toBe(200);
    expect(res.body.query).toBe('爬虫');
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions.length).toBeGreaterThan(0);

    const titles = res.body.suggestions.map((s: { title: string }) => s.title);
    expect(titles).toContain('Node.js 网络爬虫实战');
    // Each suggestion must expose both title and url
    for (const s of res.body.suggestions) {
      expect(typeof s.title).toBe('string');
      expect(typeof s.url).toBe('string');
    }
  });

  it('GET /api/search?q= (empty) returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app.server).get('/api/search?q=');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/search without q returns 400', async () => {
    const res = await request(app.server).get('/api/search');
    expect(res.status).toBe(400);
  });

  it('GET /api/suggest?q= (empty) returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app.server).get('/api/suggest?q=');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Fixture integrity', () => {
  it('all fixture IDs are unique', () => {
    const ids = FIXTURE_DOCS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all fixtures have required fields', () => {
    for (const d of FIXTURE_DOCS) {
      expect(d.id).toBeTruthy();
      expect(d.url).toMatch(/^https?:\/\//);
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.content.length).toBeGreaterThan(0);
      expect(Array.isArray(d.tokens)).toBe(true);
      expect(d.crawledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(d.domain.length).toBeGreaterThan(0);
    }
  });
});