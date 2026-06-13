import type { FastifyInstance } from 'fastify';
import { SearchQuerySchema, SuggestQuerySchema } from '../schemas.js';
import { createClient, search, suggest } from '../../meili/index.js';
import { config } from '../../config.js';
import type { SearchResponse, SuggestResponse } from '../../types/index.js';

interface HealthOk {
  status: 'ok';
  meili: string;
}
interface HealthDegraded {
  status: 'degraded';
  meili: 'unavailable';
}
type HealthResponse = HealthOk | HealthDegraded;

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  const client = createClient();

  app.get('/api/health', async (): Promise<HealthResponse> => {
    try {
      const h = await client.health();
      return { status: 'ok', meili: h.status };
    } catch {
      return { status: 'degraded', meili: 'unavailable' };
    }
  });

  app.get<{ Querystring: { q?: string; limit?: string; offset?: string } }>(
    '/api/search',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 1, maxLength: 200 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (req): Promise<SearchResponse> => {
      const parsed = SearchQuerySchema.parse(req.query);
      return search(client, config.meiliIndex, parsed.q, {
        limit: parsed.limit,
        offset: parsed.offset,
      });
    }
  );

  app.get<{ Querystring: { q?: string; limit?: string } }>(
    '/api/suggest',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 1, maxLength: 100 },
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
          },
        },
      },
    },
    async (req): Promise<SuggestResponse> => {
      const parsed = SuggestQuerySchema.parse(req.query);
      return suggest(client, config.meiliIndex, parsed.q, parsed.limit);
    }
  );
}