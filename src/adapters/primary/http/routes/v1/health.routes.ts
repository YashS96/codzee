import type { FastifyInstance } from 'fastify';
import type { HealthUseCases } from '../../../../../ports/primary/health.js';

export function healthRoutes(health: HealthUseCases, info: { name: string; version: string }) {
  return async (app: FastifyInstance) => {
    // Liveness: process is up and the event loop responds. Never checks dependencies,
    // otherwise a Postgres blip would make Kubernetes restart every pod.
    app.get('/live', { logLevel: 'warn' }, async () => health.liveness());

    // Readiness: safe to receive traffic (dependencies reachable, not draining).
    app.get('/ready', { logLevel: 'warn' }, async (_req, reply) => {
      const report = await health.readiness();
      return reply.status(report.status === 'ok' ? 200 : 503).send(report);
    });

    app.get('/', async (_req, reply) => {
      const report = await health.readiness();
      return reply
        .status(report.status === 'ok' ? 200 : 503)
        .send({ ...report, service: info.name, version: info.version, ...health.liveness() });
    });
  };
}
