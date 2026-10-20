import type pg from 'pg';
import type { HealthIndicator } from '../../../ports/secondary/health-indicator.js';

export class PostgresHealthIndicator implements HealthIndicator {
  readonly name = 'postgres';
  constructor(private readonly pool: pg.Pool) {}

  async check(): Promise<void> {
    await this.pool.query('SELECT 1');
  }
}
