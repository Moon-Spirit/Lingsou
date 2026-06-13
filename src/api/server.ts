import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { registerErrorHandlers } from './errorHandler.js';
import { searchRoutes } from './routes/search.js';
import { historyRoutes } from './routes/history.js';

// Pino's Logger satisfies FastifyBaseLogger structurally, but pino's generic
// types (Logger<never, boolean> etc.) don't unify cleanly with FastifyBaseLogger
// because pino adds a `msgPrefix` property. Pass via `loggerInstance` so Fastify
// doesn't try to construct a new pino instance from options, then cast back to
// the generic FastifyBaseLogger for the returned FastifyInstance type so that
// downstream code (error handlers, routes) sees the default generic.
export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
  });

  await app.register(cors, { origin: true });

  registerErrorHandlers(app);
  await app.register(searchRoutes);
  await app.register(historyRoutes);

  return app as unknown as FastifyInstance;
}

export async function start(): Promise<void> {
  const app = await buildServer();
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    logger.info({ port: config.port }, 'api listening');
  } catch (err) {
    logger.error({ err }, 'failed to start');
    process.exit(1);
  }
}

// CLI entrypoint
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  start();
}