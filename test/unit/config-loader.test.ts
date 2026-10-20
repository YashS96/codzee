import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { deepMerge, interpolate, loadConfig } from '../../src/config/loader.js';

const CONFIG_DIR = path.resolve('config');

describe('config loader', () => {
  it('interpolates env vars with fallbacks', () => {
    expect(interpolate('port: ${PORT:-8080}', {})).toBe('port: 8080');
    expect(interpolate('port: ${PORT:-8080}', { PORT: '9000' })).toBe('port: 9000');
  });

  it('throws for a required variable without fallback', () => {
    expect(() => interpolate('${JWT_SECRET}', {})).toThrow(/JWT_SECRET/);
  });

  it('deep merges nested objects and replaces arrays', () => {
    expect(deepMerge({ a: { b: 1, c: 2 }, l: [1] }, { a: { c: 3 }, l: [2] })).toEqual({
      a: { b: 1, c: 3 },
      l: [2],
    });
  });

  it('loads default + test overlay', () => {
    const cfg = loadConfig({ NODE_ENV: 'test' }, CONFIG_DIR);
    expect(cfg.app.env).toBe('test');
    expect(cfg.server.port).toBe(8080);
    expect(cfg.auth.bcryptRounds).toBe(4);
  });

  it('refuses production without required secrets', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' }, CONFIG_DIR)).toThrow(/DATABASE_URL/);
  });

  it('rejects a short JWT secret', () => {
    expect(() => loadConfig({ NODE_ENV: 'development', JWT_SECRET: 'short' }, CONFIG_DIR)).toThrow(
      /auth\.jwt\.secret/,
    );
  });
});
