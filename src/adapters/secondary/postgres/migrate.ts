/* eslint-disable no-console -- CLI entrypoint */
/**
 * Minimal forward-only SQL migrator. Applies migrations/NNNN_*.sql in order, each in its own
 * transaction, under a Postgres advisory lock so concurrent replicas don't race.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type pg from 'pg';
import { loadConfig } from '../../../config/loader.js';
import { createPgPool } from './pool.js';

const LOCK_ID = 727_001;

export async function migrate(
  pool: pg.Pool,
  dir = path.resolve('migrations'),
  log = console.log,
): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
    const done = new Set(rows.map((r) => r.version));
    const files = readdirSync(dir)
      .filter((f) => /^\d{4}_.+\.sql$/.test(f))
      .sort();

    for (const file of files) {
      if (done.has(file)) continue;
      await client.query('BEGIN');
      try {
        await client.query(readFileSync(path.join(dir, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        log(`applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`, { cause: err });
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    client.release();
  }
  return applied;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = loadConfig();
  const pool = createPgPool(cfg.postgres, `${cfg.app.name}-migrate`);
  migrate(pool)
    .then((applied) => console.log(applied.length ? `${applied.length} migration(s) applied` : 'up to date'))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
