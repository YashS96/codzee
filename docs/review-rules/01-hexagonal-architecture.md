# Rule: Hexagonal Architecture Review

**Applies to:** `src/**/*.ts`

Review every change for ports-and-adapters correctness. The only allowed dependency direction is:

`bootstrap → adapters (primary | secondary | repositories) → ports ← services → domain`

## Check

1. **Domain purity** — `src/domain/**` imports only other `src/domain` files. Flag any import of `fastify`, `@grpc/*`, `pg`, `ioredis`, `jose`, `bcryptjs`, `zod`, `node:fs`/`node:net`, or anything under `ports`, `services`, `adapters`, `config`, `bootstrap`.
2. **Ports are contracts only** — `src/ports/**` contains only interfaces, types and DTOs. No classes with logic, no infra imports, no imports from `services` or `adapters`.
3. **Services depend on ports, not adapters** — `src/services/**` may import `domain` and `ports` only. Flag direct use of `pg.Pool`, `Redis`, `FastifyRequest`, gRPC `call` objects, `process.env` or config files.
4. **Correct port type** — persistence goes through `ports/repositories` and is implemented in `adapters/repositories/<tech>/`. Other outbound needs (cache, lock, token, clock, events) use `ports/secondary` and are implemented in `adapters/secondary/<tech>/`. Flag a repository placed under `secondary`, or a cache/lock placed under `repositories`.
5. **Primary adapters are thin** — HTTP routes (`adapters/primary/http/routes/v1`) and gRPC handlers (`adapters/primary/grpc/handlers/v1`) only parse input, call a `ports/primary` interface, and map the result or error. Flag business rules, SQL, Redis calls or repository usage inside a handler.
6. **No infra leakage through ports** — port signatures must not expose `pg` rows, `QueryResult`, Redis key strings, `FastifyReply`, gRPC `Metadata` or `ServiceError`. Domain objects or plain DTOs only.
7. **Single composition root** — only `src/bootstrap/container.ts` may `new` a concrete adapter. Flag `new PgXRepository(...)` or `new Redis(...)` anywhere else (tests excepted).
8. **Errors cross boundaries as domain errors** — services throw `DomainError` subclasses. Only primary adapters translate them to HTTP status codes or gRPC status codes.

## Severity

- **Blocker:** domain or services importing infra or adapters; business logic in a handler; repository bypassing its port.
- **Major:** port leaking infra types; adapter created outside bootstrap; wrong port category.
- **Minor:** naming not matching the pattern (`Pg<Entity>Repository`, `Redis<Thing>`, `<Context>Service`).

For each finding give file:line, the rule number, why it breaks the architecture, and the concrete move or fix (e.g. "extract `SeatLock` port to `src/ports/secondary/seat-lock.ts`, implement in `adapters/secondary/redis/`").
