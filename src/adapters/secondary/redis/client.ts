import { Redis } from 'ioredis';
import type { AppConfig } from '../../../config/schema.js';

export function createRedisClient(cfg: AppConfig['redis']): Redis {
  return new Redis(cfg.url, {
    keyPrefix: cfg.keyPrefix,
    connectTimeout: cfg.connectTimeoutMs,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true,
    lazyConnect: true,
  });
}
