import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` },
    });
  });

  app.setErrorHandler((err: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof ZodError) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        },
      });
      return;
    }
    // Fastify schema validation errors (when using @fastify/type-provider-zod)
    if (err.validation) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
        },
      });
      return;
    }
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      reply.status(err.statusCode).send({
        error: {
          code: err.code || 'CLIENT_ERROR',
          message: err.message,
        },
      });
      return;
    }
    // 5xx: log full, return generic
    req.log.error({ err }, 'unhandled error');
    reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  });
}
