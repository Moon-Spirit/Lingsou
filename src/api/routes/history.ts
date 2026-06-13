import type { FastifyInstance } from 'fastify';

// History is client-side (localStorage). The server returns an empty list as a
// stub for any future extension (e.g. shared anonymous suggestions).
export async function historyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/history', async () => ({ items: [] }));
}