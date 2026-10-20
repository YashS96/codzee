import path from 'node:path';
import { credentials, Metadata, status, type Client, type ServiceError } from '@grpc/grpc-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadProtos } from '../../src/adapters/primary/grpc/proto.js';
import { buildGrpcServer, type GrpcServer } from '../../src/adapters/primary/grpc/server.js';
import { JwtTokenService } from '../../src/adapters/secondary/security/jwt-token-service.js';
import { loadConfig } from '../../src/config/loader.js';
import { AuthService } from '../../src/services/auth/auth-service.js';
import { HealthService } from '../../src/services/health/health-service.js';
import {
  InMemoryCache,
  InMemorySessionStore,
  InMemoryUserRepository,
  fakeHasher,
  indicator,
  sequentialIds,
} from '../support/fakes.js';

const config = loadConfig({ NODE_ENV: 'test' }, path.resolve('config'));
const silentLog = { error: () => undefined };

type Rpc = (req: object, md: Metadata, cb: (err: ServiceError | null, res: never) => void) => void;
const call = <T>(client: Client, method: string, req: object = {}, md = new Metadata()) =>
  new Promise<T>((resolve, reject) =>
    ((client as unknown as Record<string, Rpc>)[method] as Rpc).call(client, req, md, (err, res) =>
      err ? reject(err) : resolve(res as T),
    ),
  );
const bearer = (token: string) => {
  const md = new Metadata();
  md.set('authorization', `Bearer ${token}`);
  return md;
};

describe('gRPC adapter', () => {
  let server: GrpcServer;
  let auth: Client;
  let healthClient: Client;
  let health: HealthService;

  beforeAll(async () => {
    health = new HealthService([indicator('postgres', true)], config.health.checkTimeoutMs);
    const authService = new AuthService({
      users: new InMemoryUserRepository(),
      hasher: fakeHasher,
      tokens: new JwtTokenService(config.auth.jwt),
      sessions: new InMemorySessionStore(),
      clock: { now: () => new Date() },
      ids: sequentialIds(),
      cache: new InMemoryCache(),
      refreshTokenTtlSec: config.auth.refreshTokenTtlSec,
      profileCacheTtlSec: 60,
    });
    server = buildGrpcServer({ auth: authService, health, log: silentLog, maxMessageBytes: 1024 * 1024 });
    const port = await server.listen('127.0.0.1', 0);
    const { authService: AuthClient, healthService: HealthClient } = loadProtos();
    auth = new AuthClient(`127.0.0.1:${port}`, credentials.createInsecure());
    healthClient = new HealthClient(`127.0.0.1:${port}`, credentials.createInsecure());
  });

  afterAll(async () => {
    auth.close();
    healthClient.close();
    await server.close(1000);
  });

  const creds = { email: 'morpheus@matrix.io', name: 'Morpheus', password: 'free-your-mind-1' };

  it('Register → Login → GetProfile → Refresh → Logout', async () => {
    const user = await call<{ id: string; email: string; role: string }>(auth, 'Register', creds);
    expect(user).toMatchObject({ email: creds.email, role: 'customer' });

    const tokens = await call<{ accessToken: string; refreshToken: string; tokenType: string }>(
      auth,
      'Login',
      {
        email: creds.email,
        password: creds.password,
      },
    );
    expect(tokens.tokenType).toBe('Bearer');

    const me = await call<{ id: string }>(auth, 'GetProfile', {}, bearer(tokens.accessToken));
    expect(me.id).toBe(user.id);

    const refreshed = await call<{ refreshToken: string }>(auth, 'Refresh', {
      refreshToken: tokens.refreshToken,
    });
    expect(refreshed.refreshToken).not.toBe(tokens.refreshToken);

    await expect(call(auth, 'Logout', {}, bearer(tokens.accessToken))).resolves.toEqual({});
  });

  it('maps domain errors to gRPC status codes', async () => {
    await expect(call(auth, 'Register', creds)).rejects.toMatchObject({ code: status.ALREADY_EXISTS });
    await expect(
      call(auth, 'Register', { ...creds, email: 'x@y.io', password: 'short' }),
    ).rejects.toMatchObject({
      code: status.INVALID_ARGUMENT,
    });
    await expect(call(auth, 'GetProfile')).rejects.toMatchObject({ code: status.UNAUTHENTICATED });
  });

  it('implements grpc.health.v1 Check for readiness and liveness', async () => {
    expect(await call(healthClient, 'Check', { service: '' })).toEqual({ status: 'SERVING' });
    await expect(call(healthClient, 'Check', { service: 'nope' })).rejects.toMatchObject({
      code: status.NOT_FOUND,
    });
    health.markShuttingDown();
    expect(await call(healthClient, 'Check', { service: '' })).toEqual({ status: 'NOT_SERVING' });
    expect(await call(healthClient, 'Check', { service: 'liveness' })).toEqual({ status: 'SERVING' });
  });
});
