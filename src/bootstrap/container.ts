/**
 * Composition root — the only place that knows about every layer.
 * Wires concrete adapters into services through their ports.
 */
import type { FastifyInstance } from 'fastify';
import { buildGrpcServer, type GrpcServer } from '../adapters/primary/grpc/server.js';
import { buildHttpServer } from '../adapters/primary/http/server.js';
import { PostgresHealthIndicator } from '../adapters/secondary/postgres/pg-health.js';
import { PgUserRepository } from '../adapters/repositories/postgres/pg-user-repository.js';
import { createPgPool } from '../adapters/secondary/postgres/pool.js';
import { createRedisClient } from '../adapters/secondary/redis/client.js';
import { RedisCache } from '../adapters/secondary/redis/redis-cache.js';
import { RedisHealthIndicator } from '../adapters/secondary/redis/redis-health.js';
import { RedisSessionStore } from '../adapters/secondary/redis/redis-session-store.js';
import { BcryptPasswordHasher } from '../adapters/secondary/security/bcrypt-password-hasher.js';
import { JwtTokenService } from '../adapters/secondary/security/jwt-token-service.js';
import { systemClock, uuidGenerator } from '../adapters/secondary/system/system.js';
import { AuthService } from '../services/auth/auth-service.js';
import { HealthService } from '../services/health/health-service.js';
import type { AppConfig } from '../config/schema.js';

export interface Container {
  app: FastifyInstance;
  /** Null when grpc.enabled is false. */
  grpc: GrpcServer | null;
  health: HealthService;
  dispose(): Promise<void>;
}

export async function createContainer(config: AppConfig): Promise<Container> {
  const pool = createPgPool(config.postgres, config.app.name);
  const redis = createRedisClient(config.redis);
  // Don't crash on a transient Redis outage; readiness reports it instead.
  redis.on('error', () => undefined);
  await redis.connect().catch(() => undefined);

  const health = new HealthService(
    [new PostgresHealthIndicator(pool), new RedisHealthIndicator(redis)],
    config.health.checkTimeoutMs,
  );

  const auth = new AuthService({
    users: new PgUserRepository(pool),
    hasher: new BcryptPasswordHasher(config.auth.bcryptRounds),
    tokens: new JwtTokenService(config.auth.jwt),
    sessions: new RedisSessionStore(redis),
    clock: systemClock,
    ids: uuidGenerator,
    cache: new RedisCache(redis),
    refreshTokenTtlSec: config.auth.refreshTokenTtlSec,
    profileCacheTtlSec: config.cache.profileTtlSec,
  });

  const app = await buildHttpServer({ config, auth, health, redis });
  pool.on('error', (err) => app.log.error({ err }, 'postgres pool error'));

  const grpc = config.grpc.enabled
    ? buildGrpcServer({ auth, health, log: app.log, maxMessageBytes: config.grpc.maxMessageBytes })
    : null;

  return {
    app,
    grpc,
    health,
    async dispose() {
      // quit() flushes pending commands but waits on a dead connection; disconnect() if not ready.
      const closeRedis = redis.status === 'ready' ? redis.quit() : Promise.resolve(redis.disconnect());
      await Promise.allSettled([pool.end(), closeRedis]);
    },
  };
}
