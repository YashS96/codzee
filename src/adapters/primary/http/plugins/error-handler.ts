import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from '../../../../domain/shared/errors.js';

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown; requestId: string };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError | Error, request, reply) => {
    const requestId = request.id;
    if (err instanceof DomainError) {
      const body: ErrorBody = {
        error: { code: err.code, message: err.message, details: err.details, requestId },
      };
      return reply.status(STATUS_BY_CODE[err.code] ?? 400).send(body);
    }
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return reply
        .status(400)
        .send({ error: { code: 'VALIDATION_FAILED', message: 'Invalid request', details, requestId } });
    }
    const statusCode = (err as FastifyError).statusCode;
    if (statusCode && statusCode < 500) {
      const code = (err as FastifyError).code ?? 'BAD_REQUEST';
      return reply.status(statusCode).send({ error: { code, message: err.message, requestId } });
    }
    request.log.error({ err }, 'unhandled error');
    return reply
      .status(500)
      .send({ error: { code: 'INTERNAL', message: 'Internal server error', requestId } });
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .status(404)
      .send({ error: { code: 'NOT_FOUND', message: 'Route not found', requestId: request.id } }),
  );
}
