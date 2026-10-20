import { z } from 'zod';

const DEV_SECRET = 'dev-only-insecure-secret-change-me-please';

export const configSchema = z
  .object({
    app: z.object({
      name: z.string(),
      env: z.enum(['development', 'test', 'staging', 'production']),
      version: z.string(),
    }),
    server: z.object({
      host: z.string(),
      port: z.coerce.number().int().min(1).max(65535),
      trustProxy: z.boolean(),
      bodyLimitBytes: z.number().int().positive(),
      requestTimeoutMs: z.number().int().positive(),
      cors: z.object({ origins: z.array(z.string()) }),
    }),
    grpc: z.object({
      enabled: z.boolean(),
      host: z.string(),
      port: z.coerce.number().int().min(0).max(65535),
      maxMessageBytes: z.number().int().positive(),
    }),
    log: z.object({
      level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
      pretty: z.boolean(),
    }),
    postgres: z.object({
      url: z.string().url(),
      poolMax: z.number().int().positive(),
      idleTimeoutMs: z.number().int().nonnegative(),
      connectionTimeoutMs: z.number().int().positive(),
      statementTimeoutMs: z.number().int().positive(),
    }),
    redis: z.object({
      url: z.string().url(),
      keyPrefix: z.string(),
      connectTimeoutMs: z.number().int().positive(),
    }),
    auth: z.object({
      jwt: z.object({
        secret: z.string().min(32, 'auth.jwt.secret must be at least 32 characters'),
        issuer: z.string(),
        audience: z.string(),
        accessTokenTtlSec: z.number().int().positive(),
      }),
      refreshTokenTtlSec: z.number().int().positive(),
      bcryptRounds: z.number().int().min(4).max(15),
      rateLimit: z.object({ max: z.number().int().positive(), windowMs: z.number().int().positive() }),
    }),
    booking: z.object({
      holdTtlSec: z.number().int().positive(),
      paymentWindowSec: z.number().int().positive(),
      seatPrice: z.number().positive(),
      expirySweepMs: z.number().int().positive(),
    }),
    health: z.object({ checkTimeoutMs: z.number().int().positive() }),
    shutdown: z.object({
      drainDelayMs: z.number().int().nonnegative(),
      timeoutMs: z.number().int().positive(),
    }),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.app.env === 'production' && cfg.auth.jwt.secret === DEV_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['auth', 'jwt', 'secret'],
        message: 'dev secret used in production',
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;
