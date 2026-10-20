# Architecture

```
   HTTP /v1/*            gRPC codzee.v1.*
        │                      │
┌───────▼──────────────────────▼─────────── adapters/primary ─┐
│ Fastify routes/v1 · auth guard   │ gRPC handlers/v1 · health │
└──────────────────────────┬──────────────────────────────────┘
                           ▼  ports/primary  (AuthUseCases, HealthUseCases, …)
┌──────────────────────────────────────────────── services ───┐
│ AuthService · HealthService · (CatalogService, BookingService)│
└───────────┬───────────────────────────────────┬─────────────┘
            ▼ ports/repositories                ▼ ports/secondary
┌──── adapters/repositories ────┐   ┌──────── adapters/secondary ────────┐
│ PgUserRepository (Postgres)   │   │ Redis session store · JWT · bcrypt │
└───────────────────────────────┘   │ clock/ids · PG/Redis health        │
                                    └────────────────────────────────────┘
            domain/ (entities, value objects, errors) — used by services and ports only
```

| Layer              | Folder                                       | Depends on                   |
| ------------------ | -------------------------------------------- | ---------------------------- |
| Domain             | `src/domain`                                 | nothing                      |
| Ports              | `src/ports/{primary,secondary,repositories}` | domain                       |
| Services           | `src/services`                               | domain, ports                |
| Primary adapters   | `src/adapters/primary/{http,grpc}`           | ports/primary, domain errors |
| Secondary adapters | `src/adapters/secondary/*`                   | ports/secondary              |
| Repositories       | `src/adapters/repositories/*`                | ports/repositories, domain   |
| Composition root   | `src/bootstrap`                              | everything                   |

## HTTP endpoints (all under `/v1`)

| Route                    | Purpose                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `GET /v1/health/live`    | Liveness — process & event loop only. Never checks deps.                            |
| `GET /v1/health/ready`   | Readiness — Postgres + Redis with per-check timeout; 503 when degraded or draining. |
| `GET /v1/health`         | Detailed report (version, uptime, per-dependency latency).                          |
| `POST /v1/auth/register` | Create customer account.                                                            |
| `POST /v1/auth/login`    | Issue access JWT (15 min) + opaque refresh token (7 d, Redis).                      |
| `POST /v1/auth/refresh`  | Rotate refresh token (single-use, atomic `GETDEL`).                                 |
| `POST /v1/auth/logout`   | Revoke access token `jti` + refresh token.                                          |
| `GET /v1/auth/me`        | Current user profile.                                                               |
| `GET /metrics`           | Prometheus metrics (unversioned — an ops endpoint, not API).                        |

## gRPC (port 50051)

| Service                                                | RPCs                                                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `codzee.v1.AuthService` (`proto/codzee/v1/auth.proto`) | `Register`, `Login`, `Refresh`, `Logout`, `GetProfile` — auth via `authorization: Bearer` metadata |
| `grpc.health.v1.Health`                                | `Check` — `service: ""` = readiness, `service: "liveness"` = liveness                              |

Domain errors map to status codes: validation → `INVALID_ARGUMENT`, unauthorized → `UNAUTHENTICATED`, forbidden → `PERMISSION_DENIED`, not found → `NOT_FOUND`, conflict → `ALREADY_EXISTS`. The domain code is also sent in `error-code` trailing metadata. gRPC is plaintext; TLS terminates at the ingress/mesh.

## Auth model

- Access token: HS256 JWT with `sub`, `role`, `jti`, `iss`, `aud`, `exp`. Revocation list in Redis keyed by `jti` with TTL = remaining lifetime.
- Refresh token: 48 random bytes, stored as `sha256` hash in Redis → userId. Rotated on every use.
- HTTP login and register are rate limited per IP, counters shared across replicas via Redis. (gRPC has no rate limiting yet.)

## Graceful shutdown

`SIGTERM` → readiness flips to 503 / `NOT_SERVING` → wait `shutdown.drainDelayMs` (LB deregisters) → HTTP `app.close()` and gRPC `tryShutdown()` drain in-flight calls → close PG pool + Redis → exit. A hard timeout (`shutdown.timeoutMs`) forces exit.

## Configuration

`config/default.yaml` ← deep-merged with `config/<NODE_ENV>.yaml`, `${VAR:-fallback}` interpolated from env, validated by zod at startup (fail fast). Production overlay has no fallbacks for secrets and rejects the dev JWT secret.
