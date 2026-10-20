import type { Redis } from 'ioredis';
import type { HealthIndicator } from '../../../ports/secondary/health-indicator.js';

export class RedisHealthIndicator implements HealthIndicator {
  readonly name = 'redis';
  constructor(private readonly redis: Redis) {}

  async check(): Promise<void> {
    const reply = await this.redis.ping();
    if (reply !== 'PONG') throw new Error(`unexpected PING reply: ${reply}`);
  }
}
