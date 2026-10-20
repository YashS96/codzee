import type { Redis } from 'ioredis';
import type { SeatLock } from '../../../ports/secondary/seat-lock.js';

export class RedisSeatLock implements SeatLock {
  constructor(private readonly redis: Redis) {}

  async isLocked(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }

  async lock(key: string, owner: string, ttlSec: number): Promise<void> {
    await this.redis.set(key, owner, 'EX', ttlSec);
  }

  async unlock(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
