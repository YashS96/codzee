export type ComponentStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'degraded' | 'shutting_down';
  checks: Record<string, { status: ComponentStatus; latencyMs: number; error?: string }>;
}

export interface HealthUseCases {
  liveness(): { status: 'ok'; uptimeSec: number };
  readiness(): Promise<HealthReport>;
  markShuttingDown(): void;
}
