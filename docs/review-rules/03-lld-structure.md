# Rule: Low-Level Design & File Structure Review

**Applies to:** all changed files

Check that new code is in the right place, named consistently, and complete across every layer it touches.

## Expected layout

```
src/domain/<context>/              entities, value objects, policies (<entity>.ts)
src/ports/primary/<context>.ts      use-case interface + DTOs
src/ports/secondary/<name>.ts       outbound non-persistence port
src/ports/repositories/<entity>-repository.ts
src/services/<context>/<context>-service.ts
src/adapters/primary/http/routes/v1/<context>.routes.ts   (registered in routes/v1/index.ts)
src/adapters/primary/grpc/handlers/v1/<context>.handler.ts (registered in grpc/server.ts)
proto/codzee/v1/<context>.proto
src/adapters/repositories/postgres/pg-<entity>-repository.ts
src/adapters/secondary/<tech>/<name>.ts
migrations/NNNN_<description>.sql
test/unit/<context>-service.test.ts · test/http/ · test/grpc/ · test/support/fakes.ts
```

## Check

1. **Completeness of a vertical slice** — a new capability normally adds: a domain model, a primary port, a service, repository and secondary ports, adapters, wiring in `bootstrap/container.ts`, an HTTP route, a gRPC RPC, a migration, and tests. Flag any missing piece, especially a port with no fake in `test/support/fakes.ts` or an adapter that is never wired.
2. **File placement** — each file sits in the folder its responsibility belongs to (see layout). Flag a repository in `services/`, DTOs in `domain/`, SQL outside `adapters/repositories`, or a route file outside `routes/v1/`.
3. **Naming** — files use kebab-case; classes are `<Context>Service`, `Pg<Entity>Repository`, `Redis<Thing>`, `<Thing>HealthIndicator`; ports are named for capability (`SeatLock`), not technology (`RedisLock`).
4. **Single responsibility** — one service per bounded context; flag "god" services or files over ~300 lines mixing concerns. Domain entities own their invariants (no anemic entity with all rules in the service).
5. **Domain modelling** — value objects for constrained values (`Email`, `Money`, `SeatId`); state changes through intention-revealing methods (`booking.confirm()`), not public setters. Illegal state transitions throw a `DomainError`.
6. **API versioning & parity** — HTTP routes live under `/v1`, gRPC under `codzee.v1`. A capability exposed on one transport is exposed on the other with matching validation and error codes. Proto field numbers are never reused or renumbered.
7. **Config hygiene** — new settings go in `config/default.yaml` and `src/config/schema.ts` together. No `process.env` reads outside `src/config`. Secrets have no fallback in `config/production.yaml`.
8. **Migrations** — forward-only, next sequential number, never editing a merged file; invariants enforced with constraints (UNIQUE, CHECK, FK).
9. **Dead or duplicate code** — flag unused exports, copy-pasted mapping logic, and TODOs without a ticket.
10. **Docs** — architecture changes update `docs/architecture.md` and, if structural, add an ADR in `docs/adr/`.

## Severity

- **Major:** missing layer in a vertical slice; HTTP/gRPC behaviour drift; config key missing from the schema; edited merged migration.
- **Minor:** naming or placement deviations; missing docs update.

For each finding, state the expected file path or name and what to add, move or rename.
