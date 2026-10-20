import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { SessionStore } from '../../../ports/secondary/session-store.js';

/** Refresh tokens are stored hashed so a Redis dump does not leak usable credentials. */
const refreshKey = (token: string) => `auth:refresh:${createHash('sha256').update(token).digest('hex')}`;
const revokedKey = (jti: string) => `auth:revoked:${jti}`;

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: Redis) {}

  async saveRefreshToken(token: string, userId: string, ttlSec: number): Promise<void> {
    await this.redis.set(refreshKey(token), userId, 'EX', ttlSec);
  }

  async consumeRefreshToken(token: string): Promise<string | null> {
    return this.redis.getdel(refreshKey(token));
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.redis.del(refreshKey(token));
  }

  async revokeAccessToken(jti: string, ttlSec: number): Promise<void> {
    await this.redis.set(revokedKey(jti), '1', 'EX', Math.max(1, ttlSec));
  }

  async isAccessTokenRevoked(jti: string): Promise<boolean> {
    return (await this.redis.exists(revokedKey(jti))) === 1;
  }
}
