import type { FastifyInstance } from 'fastify';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export function registerMetrics(app: FastifyInstance): Registry {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });
  const total = new Counter({
    name: 'http_requests_total',
    help: 'HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
  });

  app.addHook('onResponse', async (request, reply) => {
    // Use the route template (not the raw URL) to keep label cardinality bounded.
    const route = request.routeOptions.url ?? 'unmatched';
    const labels = { method: request.method, route, status: String(reply.statusCode) };
    duration.observe(labels, reply.elapsedTime / 1000);
    total.inc(labels);
  });

  app.get('/metrics', { logLevel: 'warn' }, async (_req, reply) =>
    reply.type(registry.contentType).send(await registry.metrics()),
  );
  return registry;
}
