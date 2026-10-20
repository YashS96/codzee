---
name: add-use-case
description: Add a new use case (primary port + service + repository/secondary ports + tests) following this repo's hexagonal layout. Use when implementing any new business capability.
---

# Add a use case

1. **Domain first.** Put entities/value objects/invariants in `src/domain/<context>/`. Throw `ValidationError`/`ConflictError`/etc. from `src/domain/shared/errors.ts`. No infra imports.
2. **Primary port.** Add or extend an interface in `src/ports/primary/<context>.ts` describing what callers can do (plain DTOs in/out, never domain objects across the boundary).
3. **Repository + secondary ports.** Persistence goes in `src/ports/repositories/<entity>-repository.ts`; other external needs (cache, lock, clock, events) in `src/ports/secondary/`. Shape them around the use case, not around Postgres/Redis.
4. **Service.** Implement the primary port in `src/services/<context>/<context>-service.ts`, constructor-injected with a `Deps` object of ports (see `AuthService`).
5. **Fakes + tests.** Add in-memory fakes to `test/support/fakes.ts` and unit tests in `test/unit/<context>-service.test.ts`.
6. **Adapters + wiring.** Implement repositories/secondary ports (see `add-outbound-adapter`), expose over HTTP (`add-http-endpoint`) and gRPC (`add-grpc-method`), then wire in `src/bootstrap/container.ts`.
7. Run `npm run check`.
