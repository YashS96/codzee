import type { Redis } from 'ioredis';
import type { Cache } from '../../../ports/secondary/cache.js';

const key = (k: string) => `cache:${k}`;

export class RedisCache implements Cache {
  constructor(private readonly redis: Redis) {}

  async get<T>(k: string): Promise<T | null> {
    const raw = await this.redis.get(key(k));
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(k: string, value: T, ttlSec: number): Promise<void> {
    await this.redis.set(key(k), JSON.stringify(value), 'EX', ttlSec);
  }

  async delete(k: string): Promise<void> {
    await this.redis.del(key(k));
  }
}
