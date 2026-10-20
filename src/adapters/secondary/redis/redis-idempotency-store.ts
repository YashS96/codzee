import type { Redis } from 'ioredis';
import type { IdempotencyStore } from '../../../ports/secondary/idempotency-store.js';

const key = (k: string) => `idempotency:${k}`;

export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(private readonly redis: Redis) {}

  get(k: string): Promise<string | null> {
    return this.redis.get(key(k));
  }

  async save(k: string, resourceId: string, ttlSec: number): Promise<void> {
    await this.redis.set(key(k), resourceId, 'EX', ttlSec);
  }
}
