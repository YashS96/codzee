import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildHttpServer } from '../../src/adapters/primary/http/server.js';
import { JwtTokenService } from '../../src/adapters/secondary/security/jwt-token-service.js';
import { loadConfig } from '../../src/config/loader.js';
import { AuthService } from '../../src/services/auth/auth-service.js';
import { HealthService } from '../../src/services/health/health-service.js';
import {
  InMemorySessionStore,
  InMemoryUserRepository,
  fakeHasher,
  makeBookingService,
  sequentialIds,
} from '../support/fakes.js';

const config = loadConfig({ NODE_ENV: 'test' }, path.resolve('config'));
const SHOW = '20000000-0000-4000-8000-000000000001';

describe('Booking HTTP routes', () => {
  let app: FastifyInstance;
  let authz: Record<string, string>;

  beforeEach(async () => {
    const auth = new AuthService({
      users: new InMemoryUserRepository(),
      hasher: fakeHasher,
      tokens: new JwtTokenService(config.auth.jwt),
      sessions: new InMemorySessionStore(),
      clock: { now: () => new Date() },
      ids: sequentialIds(),
      refreshTokenTtlSec: 3600,
    });
    const { booking, bookings } = makeBookingService();
    app = await buildHttpServer({ config, auth, health: new HealthService([], 100), booking, bookings });

    const creds = { email: 'viewer@codzee.io', name: 'Viewer', password: 'popcorn-123' };
    await app.inject({ method: 'POST', url: '/v1/auth/register', payload: creds });
    const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: creds });
    authz = { authorization: `Bearer ${login.json().accessToken}` };
  });
  afterEach(() => app.close());

  it('hold → book → pay → fetch', async () => {
    const hold = await app.inject({
      method: 'POST',
      url: `/v1/shows/${SHOW}/holds`,
      headers: authz,
      payload: { seatIds: ['A1', 'A2'] },
    });
    expect(hold.statusCode).toBe(201);

    const created = await app.inject({
      method: 'POST',
      url: '/v1/bookings',
      headers: { ...authz, 'idempotency-key': 'checkout-123456' },
      payload: { holdId: hold.json().id },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ status: 'PENDING_PAYMENT', amount: 500 });

    const paid = await app.inject({
      method: 'POST',
      url: '/v1/payments/webhook',
      payload: { bookingId: created.json().id, paymentRef: 'pay_abc', status: 'SUCCESS' },
    });
    expect(paid.json().status).toBe('CONFIRMED');

    const fetched = await app.inject({ url: `/v1/bookings/${created.json().id}`, headers: authz });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().status).toBe('CONFIRMED');
  });

  it('returns 409 when a seat is already held', async () => {
    const payload = { seatIds: ['B5'] };
    await app.inject({ method: 'POST', url: `/v1/shows/${SHOW}/holds`, headers: authz, payload });
    const again = await app.inject({
      method: 'POST',
      url: `/v1/shows/${SHOW}/holds`,
      headers: authz,
      payload,
    });
    expect(again.statusCode).toBe(409);
  });

  it('requires an Idempotency-Key to book', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/bookings',
      headers: authz,
      payload: { holdId: SHOW },
    });
    expect(res.statusCode).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/shows/${SHOW}/holds`,
      payload: { seatIds: ['A1'] },
    });
    expect(res.statusCode).toBe(401);
  });
});
