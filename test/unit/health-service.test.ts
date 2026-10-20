import { describe, expect, it } from 'vitest';
import { HealthService } from '../../src/services/health/health-service.js';
import { indicator } from '../support/fakes.js';

describe('HealthService', () => {
  it('is ok when all indicators are up', async () => {
    const svc = new HealthService([indicator('postgres', true), indicator('redis', true)], 100);
    const report = await svc.readiness();
    expect(report.status).toBe('ok');
    expect(report.checks.postgres?.status).toBe('up');
  });

  it('is degraded when a dependency is down', async () => {
    const svc = new HealthService([indicator('postgres', true), indicator('redis', false)], 100);
    const report = await svc.readiness();
    expect(report.status).toBe('degraded');
    expect(report.checks.redis).toMatchObject({ status: 'down', error: 'redis unreachable' });
  });

  it('times out slow checks', async () => {
    const slow = indicator('postgres', () => new Promise((r) => setTimeout(r, 500)));
    const report = await new HealthService([slow], 20).readiness();
    expect(report.checks.postgres?.error).toMatch(/timed out/);
  });

  it('reports shutting_down after markShuttingDown', async () => {
    const svc = new HealthService([indicator('postgres', true)], 100);
    svc.markShuttingDown();
    expect((await svc.readiness()).status).toBe('shutting_down');
    expect(svc.liveness().status).toBe('ok');
  });
});
