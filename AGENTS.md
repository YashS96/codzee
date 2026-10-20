# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Codzee — a **Distributed Movie Ticket Booking System** backend. TypeScript (Node 22, ESM), Fastify 5 (HTTP) + grpc-js (gRPC), PostgreSQL 16, Redis 7. Hexagonal architecture (ports & adapters).

## Layout

```
src/
  domain/                  entities, value objects, domain errors — pure TS, no I/O
  ports/
    primary/               inbound: what callers can ask of us (use-case interfaces)
    secondary/             outbound: tokens, hashing, sessions, clock, health indicators
    repositories/          outbound persistence interfaces (UserRepository, …)
  services/                business services implementing ports/primary using the other ports
  adapters/
    primary/http/          Fastify server; routes/v1/* served under /v1
    primary/grpc/          gRPC server; handlers/v1/* for proto/codzee/v1/*.proto
    secondary/             redis/, security/, system/, postgres/ (pool, health, migrator)
    repositories/          postgres/ — implement ports/repositories
  config/                  YAML loader + zod schema
  bootstrap/               composition root (the only place that creates adapters)
proto/                     .proto contracts (codzee.v1, grpc.health.v1)
config/*.yaml              default + per-NODE_ENV overlays, ${ENV:-fallback} interpolation
migrations/*.sql           forward-only SQL, applied by `npm run migrate`
test/                      unit/ (fakes), http/ (fastify.inject), grpc/ (real client), support/fakes.ts
```

## Rules

- Dependency direction: bootstrap → adapters → ports ← services → domain. ESLint enforces it; don't disable the rule.
- New persistence need → interface in `ports/repositories` + implementation in `adapters/repositories/<tech>`. Other external needs → `ports/secondary` + `adapters/secondary/<tech>`. Always add an in-memory fake to `test/support/fakes.ts`.
- HTTP and gRPC are two primary adapters over the same `ports/primary`. A new capability is exposed on both, under `v1`.
- Booking correctness is enforced at the DB (constraints) **and** in the domain; Redis locks are an optimisation, not the source of truth.
- Liveness (`/v1/health/live`, gRPC `liveness`) never touches dependencies. Readiness (`/v1/health/ready`, gRPC `""`) checks all of them.
- Conventional commits (`feat(booking): …`) or ticket-prefixed (`EPIC-1: …`). Commits must be authored as `srivastavyash7@gmail.com` — the pre-commit hook enforces this.

## Commands

| Task       | Command           |
| ---------- | ----------------- |
| Install    | `npm ci`          |
| Infra      | `make infra-up`   |
| Migrate    | `npm run migrate` |
| Dev server | `npm run dev`     |
| All checks | `npm run check`   |

## Agents & skills

Sub-agents live in `.claude/agents/` (architecture-guardian, code-reviewer, test-engineer, booking-domain-expert). Task playbooks live in `.claude/skills/` (add-use-case, add-http-endpoint, add-grpc-method, add-db-migration, add-outbound-adapter, local-dev).
