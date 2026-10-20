import { randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { AccessTokenClaims, TokenService } from '../../../ports/secondary/token-service.js';
import { UnauthorizedError } from '../../../domain/shared/errors.js';
import { ROLES, type Role } from '../../../domain/user/user.js';

export interface JwtOptions {
  secret: string;
  issuer: string;
  audience: string;
  accessTokenTtlSec: number;
}

export class JwtTokenService implements TokenService {
  private readonly key: Uint8Array;

  constructor(private readonly opts: JwtOptions) {
    this.key = new TextEncoder().encode(opts.secret);
  }

  async issueAccessToken(input: { userId: string; role: Role }) {
    const jti = randomUUID();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + this.opts.accessTokenTtlSec;
    const token = await new SignJWT({ role: input.role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(input.userId)
      .setJti(jti)
      .setIssuer(this.opts.issuer)
      .setAudience(this.opts.audience)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(this.key);
    return { token, claims: { sub: input.userId, role: input.role, jti, iat, exp } };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.opts.issuer,
        audience: this.opts.audience,
        algorithms: ['HS256'],
      });
      const role = payload.role as Role;
      if (!payload.sub || !payload.jti || !payload.exp || !payload.iat || !ROLES.includes(role)) {
        throw new Error('missing claims');
      }
      return { sub: payload.sub, role, jti: payload.jti, iat: payload.iat, exp: payload.exp };
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  }

  generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }
}
