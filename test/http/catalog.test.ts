import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildHttpServer } from '../../src/adapters/primary/http/server.js';
import { JwtTokenService } from '../../src/adapters/secondary/security/jwt-token-service.js';
import { loadConfig } from '../../src/config/loader.js';
import { Email } from '../../src/domain/user/email.js';
import { User } from '../../src/domain/user/user.js';
import { AuthService } from '../../src/services/auth/auth-service.js';
import { HealthService } from '../../src/services/health/health-service.js';
import {
  InMemorySessionStore,
  InMemoryUserRepository,
  fakeHasher,
  makeCatalogService,
  sequentialIds,
} from '../support/fakes.js';

const config = loadConfig({ NODE_ENV: 'test' }, path.resolve('config'));
const PASSWORD = 'admin-pass-1';

describe('Catalog HTTP routes', () => {
  let app: FastifyInstance;
  let adminAuth: Record<string, string>;
  let customerAuth: Record<string, string>;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    const now = new Date();
    await users.create(
      User.restore({
        id: 'admin-1',
        email: Email.create('admin@codzee.io'),
        name: 'Admin',
        passwordHash: await fakeHasher.hash(PASSWORD),
        role: 'admin',
        createdAt: now,
        updatedAt: now,
      }),
    );
    const auth = new AuthService({
      users,
      hasher: fakeHasher,
      tokens: new JwtTokenService(config.auth.jwt),
      sessions: new InMemorySessionStore(),
      clock: { now: () => new Date() },
      ids: sequentialIds(),
      refreshTokenTtlSec: 3600,
    });
    app = await buildHttpServer({
      config,
      auth,
      health: new HealthService([], 100),
      catalog: makeCatalogService().catalog,
    });

    const login = async (email: string) => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email, password: PASSWORD },
      });
      return { authorization: `Bearer ${res.json().accessToken}` };
    };
    adminAuth = await login('admin@codzee.io');
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'fan@codzee.io', name: 'Fan', password: PASSWORD },
    });
    customerAuth = await login('fan@codzee.io');
  });
  afterEach(() => app.close());

  const post = (url: string, payload: object, headers: Record<string, string>) =>
    app.inject({ method: 'POST', url, payload, headers });

  it('lets an admin build the catalog and anyone list shows', async () => {
    const movie = await post(
      '/v1/catalog/movies',
      { title: 'Dune', durationMin: 155, language: 'en', certification: 'UA' },
      adminAuth,
    );
    expect(movie.statusCode).toBe(201);
    const cinema = await post('/v1/catalog/cinemas', { name: 'INOX', city: 'Pune' }, adminAuth);
    const screen = await post(
      `/v1/catalog/cinemas/${cinema.json().id}/screens`,
      { name: 'Screen 2', rows: 8, seatsPerRow: 12 },
      adminAuth,
    );
    expect(screen.json().capacity).toBe(96);

    const startsAt = new Date(Date.now() + 86_400_000).toISOString();
    const show = await post(
      '/v1/catalog/shows',
      { movieId: movie.json().id, screenId: screen.json().id, startsAt, price: 320 },
      adminAuth,
    );
    expect(show.statusCode).toBe(201);

    const list = await app.inject(`/v1/catalog/shows?movieId=${movie.json().id}`);
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0].movie.title).toBe('Dune');
  });

  it('forbids customers from creating movies and cinemas', async () => {
    const movie = await post(
      '/v1/catalog/movies',
      { title: 'Dune', durationMin: 155, language: 'en', certification: 'UA' },
      customerAuth,
    );
    expect(movie.statusCode).toBe(403);
    expect((await post('/v1/catalog/cinemas', { name: 'X', city: 'Y' }, customerAuth)).statusCode).toBe(403);
  });

  it('requires authentication for writes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/catalog/cinemas',
      payload: { name: 'X', city: 'Y' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 when scheduling for an unknown movie', async () => {
    const res = await post(
      '/v1/catalog/shows',
      {
        movieId: '00000000-0000-4000-8000-000000000999',
        screenId: '00000000-0000-4000-8000-000000000998',
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        price: 100,
      },
      adminAuth,
    );
    expect(res.statusCode).toBe(404);
  });
});
