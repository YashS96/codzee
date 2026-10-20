---
name: add-outbound-adapter
description: Implement a repository port or secondary (outbound) port with Postgres, Redis, or an external service, including health indicator and wiring.
---

# Add a secondary adapter or repository

1. Repository ports (`src/ports/repositories/`) are implemented in `src/adapters/repositories/<tech>/` (e.g. `PgShowRepository`). Other secondary ports (`src/ports/secondary/`) go in `src/adapters/secondary/<tech>/` (e.g. `RedisSeatLock`).
2. Keep infra details private: Redis key formats, SQL, retry policy stay in the adapter. Hash or namespace keys (see `redis-session-store.ts`).
3. Redis locks: `SET key token NX PX ttl`; release/extend with a Lua script that compares the token. Never `DEL` blindly.
4. New external dependency? Add a `HealthIndicator` and register it in `HealthService` so `/v1/health/ready` reflects it. Liveness must never depend on it.
5. Add config under a new YAML section + `src/config/schema.ts`; read it only in `bootstrap/container.ts` and pass plain values to the adapter.
6. Wire in `src/bootstrap/container.ts` and close resources in `dispose()`.
