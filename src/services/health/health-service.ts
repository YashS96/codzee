import type { HealthReport, HealthUseCases } from '../../ports/primary/health.js';
import type { HealthIndicator } from '../../ports/secondary/health-indicator.js';

export class HealthService implements HealthUseCases {
  private shuttingDown = false;
  private readonly startedAt = Date.now();

  constructor(
    private readonly indicators: HealthIndicator[],
    private readonly checkTimeoutMs: number,
  ) {}

  liveness() {
    return { status: 'ok' as const, uptimeSec: Math.round((Date.now() - this.startedAt) / 1000) };
  }

  async readiness(): Promise<HealthReport> {
    const results = await Promise.all(
      this.indicators.map(async (indicator) => {
        const started = performance.now();
        try {
          await withTimeout(indicator.check(), this.checkTimeoutMs);
          return [indicator.name, { status: 'up' as const, latencyMs: elapsed(started) }] as const;
        } catch (err) {
          // Connection errors (e.g. AggregateError ECONNREFUSED) can have an empty message.
          const e = err as Error & { code?: string };
          const error = e instanceof Error ? e.message || e.code || e.name : String(err);
          return [indicator.name, { status: 'down' as const, latencyMs: elapsed(started), error }] as const;
        }
      }),
    );
    const checks = Object.fromEntries(results);
    const allUp = results.every(([, r]) => r.status === 'up');
    return { status: this.shuttingDown ? 'shutting_down' : allUp ? 'ok' : 'degraded', checks };
  }

  markShuttingDown(): void {
    this.shuttingDown = true;
  }
}

const elapsed = (start: number) => Math.round(performance.now() - start);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
