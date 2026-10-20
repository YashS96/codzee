import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildHttpServer } from '../../src/adapters/primary/http/server.js';
import { JwtTokenService } from '../../src/adapters/secondary/security/jwt-token-service.js';
import { AuthService } from '../../src/services/auth/auth-service.js';
import { HealthService } from '../../src/services/health/health-service.js';
import { loadConfig } from '../../src/config/loader.js';
import {
  InMemorySessionStore,
  InMemoryUserRepository,
  fakeHasher,
  indicator,
  sequentialIds,
} from '../support/fakes.js';

const config = loadConfig({ NODE_ENV: 'test' }, path.resolve('config'));

async function build(opts: { redisUp?: boolean } = {}) {
  const health = new HealthService(
    [indicator('postgres', true), indicator('redis', opts.redisUp ?? true)],
    config.health.checkTimeoutMs,
  );
  const auth = new AuthService({
    users: new InMemoryUserRepository(),
    hasher: fakeHasher,
    tokens: new JwtTokenService(config.auth.jwt),
    sessions: new InMemorySessionStore(),
    clock: { now: () => new Date() },
    ids: sequentialIds(),
    refreshTokenTtlSec: config.auth.refreshTokenTtlSec,
  });
  return { app: await buildHttpServer({ config, auth, health }), health };
}

describe('HTTP adapter', () => {
  let app: FastifyInstance;
  let health: HealthService;

  beforeEach(async () => {
    ({ app, health } = await build());
  });
  afterEach(() => app.close());

  describe('health', () => {
    it('GET /v1/health/live → 200', async () => {
      const res = await app.inject('/v1/health/live');
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ status: 'ok' });
      expect(res.headers['x-request-id']).toBeTruthy();
    });

    it('GET /v1/health/ready → 200 when deps are up', async () => {
      const res = await app.inject('/v1/health/ready');
      expect(res.statusCode).toBe(200);
      expect(res.json().checks).toHaveProperty('postgres');
    });

    it('GET /v1/health/ready → 503 when a dep is down, liveness stays 200', async () => {
      await app.close();
      ({ app } = await build({ redisUp: false }));
      expect((await app.inject('/v1/health/ready')).statusCode).toBe(503);
      expect((await app.inject('/v1/health/live')).statusCode).toBe(200);
    });

    it('GET /v1/health/ready → 503 while draining', async () => {
      health.markShuttingDown();
      const res = await app.inject('/v1/health/ready');
      expect(res.statusCode).toBe(503);
      expect(res.json().status).toBe('shutting_down');
    });

    it('GET /metrics exposes prometheus metrics', async () => {
      await app.inject('/v1/health/live');
      const res = await app.inject('/metrics');
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('http_requests_total');
    });
  });

  describe('auth', () => {
    const creds = { email: 'trinity@matrix.io', name: 'Trinity', password: 'follow-the-1' };

    it('register → login → me → refresh → logout', async () => {
      const reg = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: creds });
      expect(reg.statusCode).toBe(201);
      expect(reg.json()).not.toHaveProperty('passwordHash');

      const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: creds });
      expect(login.statusCode).toBe(200);
      const { accessToken, refreshToken } = login.json();
      const authz = { authorization: `Bearer ${accessToken}` };

      const me = await app.inject({ url: '/v1/auth/me', headers: authz });
      expect(me.statusCode).toBe(200);
      expect(me.json().email).toBe(creds.email);

      const refreshed = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken },
      });
      expect(refreshed.statusCode).toBe(200);

      const logout = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        headers: authz,
        payload: {},
      });
      expect(logout.statusCode).toBe(204);
      expect((await app.inject({ url: '/v1/auth/me', headers: authz })).statusCode).toBe(401);
    });

    it('returns 409 on duplicate registration', async () => {
      await app.inject({ method: 'POST', url: '/v1/auth/register', payload: creds });
      const dup = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: creds });
      expect(dup.statusCode).toBe(409);
      expect(dup.json().error.code).toBe('CONFLICT');
    });

    it('returns 400 with details on invalid body', async () => {
      const res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 1 } });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_FAILED');
    });

    it('returns 401 without a bearer token', async () => {
      const res = await app.inject('/v1/auth/me');
      expect(res.statusCode).toBe(401);
    });

    it('rate limits login attempts', async () => {
      const bad = { email: creds.email, password: 'wrong-pass-1' };
      const codes: number[] = [];
      for (let i = 0; i < config.auth.rateLimit.max + 1; i++) {
        codes.push((await app.inject({ method: 'POST', url: '/v1/auth/login', payload: bad })).statusCode);
      }
      expect(codes.at(-1)).toBe(429);
    });
  });

  it('returns structured 404 for unknown routes', async () => {
    const res = await app.inject('/nope');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
