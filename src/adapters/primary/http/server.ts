import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { AuthUseCases } from '../../../ports/primary/auth.js';
import type { BookingUseCases } from '../../../ports/primary/booking.js';
import type { HealthUseCases } from '../../../ports/primary/health.js';
import type { BookingRepository } from '../../../ports/repositories/booking-repository.js';
import type { AppConfig } from '../../../config/schema.js';
import { makeAuthGuard } from './plugins/auth-guard.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerMetrics } from './plugins/metrics.js';
import { v1Routes } from './routes/v1/index.js';

export interface HttpDeps {
  config: AppConfig;
  auth: AuthUseCases;
  health: HealthUseCases;
  booking: BookingUseCases;
  bookings: BookingRepository;
  /** When provided, rate-limit counters are shared across replicas. */
  redis?: Redis;
}

export async function buildHttpServer(deps: HttpDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const app = Fastify({
    logger: {
      level: config.log.level,
      redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.refreshToken'],
      ...(config.log.pretty ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
    },
    trustProxy: config.server.trustProxy,
    bodyLimit: config.server.bodyLimitBytes,
    requestTimeout: config.server.requestTimeoutMs,
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  registerErrorHandler(app);
  await app.register(helmet);
  await app.register(cors, { origin: config.server.cors.origins, credentials: true });
  await app.register(rateLimit, {
    global: false,
    ...(deps.redis ? { redis: deps.redis, nameSpace: 'ratelimit:' } : {}),
  });
  registerMetrics(app);

  const guard = makeAuthGuard(deps.auth);
  await app.register(
    v1Routes({
      auth: deps.auth,
      health: deps.health,
      booking: deps.booking,
      bookings: deps.bookings,
      guard,
      info: { name: config.app.name, version: config.app.version },
      authOptions: {
        rateLimit: { max: config.auth.rateLimit.max, timeWindow: config.auth.rateLimit.windowMs },
      },
    }),
    { prefix: '/v1' },
  );

  return app;
}
