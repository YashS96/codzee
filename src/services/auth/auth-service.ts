import { Email } from '../../domain/user/email.js';
import { assertPasswordPolicy } from '../../domain/user/password-policy.js';
import { User, type UserProps } from '../../domain/user/user.js';
import { NotFoundError, UnauthorizedError } from '../../domain/shared/errors.js';
import type { AuthTokens, AuthUseCases, AuthenticatedPrincipal, UserView } from '../../ports/primary/auth.js';
import type { Cache } from '../../ports/secondary/cache.js';
import type { PasswordHasher } from '../../ports/secondary/password-hasher.js';
import type { SessionStore } from '../../ports/secondary/session-store.js';
import type { Clock, IdGenerator } from '../../ports/secondary/system.js';
import type { TokenService } from '../../ports/secondary/token-service.js';
import type { UserRepository } from '../../ports/repositories/user-repository.js';

export interface AuthServiceDeps {
  users: UserRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  sessions: SessionStore;
  clock: Clock;
  ids: IdGenerator;
  cache: Cache;
  refreshTokenTtlSec: number;
  profileCacheTtlSec: number;
}

/** Tokens younger than this skip the revocation lookup — they can't have been revoked yet in practice. */
const FRESH_TOKEN_SEC = 60;

const INVALID_CREDENTIALS = 'Invalid email or password';

export class AuthService implements AuthUseCases {
  constructor(private readonly deps: AuthServiceDeps) {}

  async register(input: { email: string; name: string; password: string }): Promise<UserView> {
    const email = Email.create(input.email);
    assertPasswordPolicy(input.password);
    const user = User.register({
      id: this.deps.ids.next(),
      email,
      name: input.name,
      passwordHash: await this.deps.hasher.hash(input.password),
      now: this.deps.clock.now(),
    });
    await this.deps.users.create(user);
    return toView(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthTokens> {
    let email: Email;
    try {
      email = Email.create(input.email);
    } catch {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }
    const user = await this.deps.users.findByEmail(email);
    // Same error for unknown user and wrong password to avoid account enumeration.
    if (!user || !(await this.deps.hasher.verify(input.password, user.passwordHash))) {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    // Peek first and revoke only after new tokens are issued, so a failure while issuing
    // doesn't burn the client's refresh token and force a re-login.
    const userId = await this.deps.sessions.peekRefreshToken(refreshToken);
    if (!userId) throw new UnauthorizedError('Invalid refresh token');
    const user = await this.deps.users.findById(userId);
    if (!user) throw new UnauthorizedError('Invalid refresh token');
    const tokens = await this.issueTokens(user);
    void this.deps.sessions.revokeRefreshToken(refreshToken);
    return tokens;
  }

  async logout(input: { principal: AuthenticatedPrincipal; refreshToken?: string }): Promise<void> {
    const remaining = input.principal.exp - Math.floor(this.deps.clock.now().getTime() / 1000);
    if (remaining > 0) await this.deps.sessions.revokeAccessToken(input.principal.jti, remaining);
    if (input.refreshToken) await this.deps.sessions.revokeRefreshToken(input.refreshToken);
  }

  async authenticate(accessToken: string): Promise<AuthenticatedPrincipal> {
    const claims = await this.deps.tokens.verifyAccessToken(accessToken);
    const ageSec = Math.floor(this.deps.clock.now().getTime() / 1000) - claims.iat;
    if (ageSec > FRESH_TOKEN_SEC && (await this.deps.sessions.isAccessTokenRevoked(claims.jti))) {
      throw new UnauthorizedError('Token has been revoked');
    }
    return { userId: claims.sub, role: claims.role, jti: claims.jti, exp: claims.exp };
  }

  async getProfile(userId: string): Promise<UserView> {
    const cacheKey = `user:${userId}`;
    const cached = await this.deps.cache.get<UserProps>(cacheKey);
    if (cached) return toView(fromCache(cached));

    const user = await this.deps.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    await this.deps.cache.set(cacheKey, user.toSnapshot(), this.deps.profileCacheTtlSec);
    return toView(user);
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const { token, claims } = await this.deps.tokens.issueAccessToken({ userId: user.id, role: user.role });
    const refreshToken = this.deps.tokens.generateRefreshToken();
    await this.deps.sessions.saveRefreshToken(refreshToken, user.id, this.deps.refreshTokenTtlSec);
    return {
      accessToken: token,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: claims.exp - Math.floor(this.deps.clock.now().getTime() / 1000),
    };
  }
}

function fromCache(snapshot: UserProps): User {
  return User.restore({
    ...snapshot,
    email: Email.create((snapshot.email as unknown as { value: string }).value),
    createdAt: new Date(snapshot.createdAt),
    updatedAt: new Date(snapshot.updatedAt),
  });
}

function toView(user: User): UserView {
  return {
    id: user.id,
    email: user.email.value,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
