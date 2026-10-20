import { beforeEach, describe, expect, it } from 'vitest';
import { JwtTokenService } from '../../src/adapters/secondary/security/jwt-token-service.js';
import { AuthService } from '../../src/services/auth/auth-service.js';
import { ConflictError, UnauthorizedError, ValidationError } from '../../src/domain/shared/errors.js';
import { InMemorySessionStore, InMemoryUserRepository, fakeHasher, sequentialIds } from '../support/fakes.js';

const tokens = new JwtTokenService({
  secret: 'unit-test-secret-unit-test-secret-1234',
  issuer: 'codzee',
  audience: 'codzee-api',
  accessTokenTtlSec: 900,
});

describe('AuthService', () => {
  let sessions: InMemorySessionStore;
  let auth: AuthService;
  const creds = { email: 'Neo@Matrix.io', name: 'Neo', password: 'red-pill-1' };

  beforeEach(() => {
    sessions = new InMemorySessionStore();
    auth = new AuthService({
      users: new InMemoryUserRepository(),
      hasher: fakeHasher,
      tokens,
      sessions,
      clock: { now: () => new Date() },
      ids: sequentialIds(),
      refreshTokenTtlSec: 3600,
    });
  });

  it('registers a customer with a normalized email', async () => {
    const user = await auth.register(creds);
    expect(user).toMatchObject({ email: 'neo@matrix.io', role: 'customer', name: 'Neo' });
  });

  it('rejects duplicate emails', async () => {
    await auth.register(creds);
    await expect(auth.register({ ...creds, email: 'neo@matrix.io' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('enforces the password policy', async () => {
    await expect(auth.register({ ...creds, password: 'short' })).rejects.toBeInstanceOf(ValidationError);
    await expect(auth.register({ ...creds, password: 'lettersonly' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('logs in and authenticates the access token', async () => {
    const user = await auth.register(creds);
    const t = await auth.login({ email: creds.email, password: creds.password });
    expect(t.tokenType).toBe('Bearer');
    const principal = await auth.authenticate(t.accessToken);
    expect(principal).toMatchObject({ userId: user.id, role: 'customer' });
  });

  it('uses the same error for unknown user and wrong password', async () => {
    await auth.register(creds);
    const a = auth.login({ email: 'nobody@x.io', password: 'whatever1' });
    const b = auth.login({ email: creds.email, password: 'wrong-pass-1' });
    await expect(a).rejects.toThrow('Invalid email or password');
    await expect(b).rejects.toThrow('Invalid email or password');
  });

  it('rotates refresh tokens (single use)', async () => {
    await auth.register(creds);
    const first = await auth.login(creds);
    const second = await auth.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(auth.refresh(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('logout revokes the access token and refresh token', async () => {
    await auth.register(creds);
    const t = await auth.login(creds);
    const principal = await auth.authenticate(t.accessToken);
    await auth.logout({ principal, refreshToken: t.refreshToken });
    await expect(auth.authenticate(t.accessToken)).rejects.toThrow(/revoked/);
    await expect(auth.refresh(t.refreshToken)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects tampered tokens', async () => {
    await expect(auth.authenticate('not.a.jwt')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
