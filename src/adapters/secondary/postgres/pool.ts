import pg from 'pg';
import type { AppConfig } from '../../../config/schema.js';

export function createPgPool(cfg: AppConfig['postgres'], appName: string): pg.Pool {
  return new pg.Pool({
    connectionString: cfg.url,
    max: cfg.poolMax,
    idleTimeoutMillis: cfg.idleTimeoutMs,
    connectionTimeoutMillis: cfg.connectionTimeoutMs,
    statement_timeout: cfg.statementTimeoutMs,
    application_name: appName,
  });
}
