import type { Role } from '../../domain/user/user.js';

export interface AccessTokenClaims {
  sub: string;
  role: Role;
  jti: string;
  /** Expiry as epoch seconds. */
  exp: number;
}

export interface TokenService {
  issueAccessToken(input: {
    userId: string;
    role: Role;
  }): Promise<{ token: string; claims: AccessTokenClaims }>;
  /** Throws UnauthorizedError when invalid or expired. */
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
  generateRefreshToken(): string;
}
