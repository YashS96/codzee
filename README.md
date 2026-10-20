# Codzee — Distributed Movie Ticket Booking System

_Codzee PR review assessment._

Backend for a distributed movie-ticket booking platform, built with **hexagonal architecture** on Node 22 + TypeScript, exposing HTTP (`/v1`, Fastify) and gRPC (`codzee.v1`), backed by PostgreSQL and Redis.

> Status: platform foundation — config, auth, health/liveness/readiness, metrics, Postgres & Redis adapters, migrations, CI and git hooks. Booking domain lands next.

## Quick start

```bash
nvm use               # Node 22 (see .nvmrc)
npm ci                # also installs git hooks
cp .env.example .env
make infra-up         # Postgres 16 + Redis 7
npm run migrate
npm run dev           # HTTP http://localhost:8080/v1 · gRPC localhost:50051
```

Or run everything in containers: `make docker-up`.

## Scripts

| Command                      | What it does                                                 |
| ---------------------------- | ------------------------------------------------------------ |
| `npm run dev`                | API with hot reload (tsx)                                    |
| `npm run migrate`            | Apply `migrations/*.sql`                                     |
| `npm test`                   | Unit + HTTP tests (no Docker needed)                         |
| `npm run check`              | typecheck + lint + format + tests (what CI and pre-push run) |
| `npm run build && npm start` | Production build                                             |

## Git hooks (husky)

- **pre-commit** — author identity check, secret scan, lint-staged (eslint + prettier), typecheck, tests
- **commit-msg** — Conventional Commits or `TICKET-123: …` via commitlint
- **pre-push** — full `npm run check`

## Docs

- [Architecture](docs/architecture.md)
- [ADR 0001 — Hexagonal architecture](docs/adr/0001-hexagonal-architecture.md)
- [AGENTS.md](AGENTS.md) — conventions for AI agents; sub-agents in `.claude/agents`, skills in `.claude/skills`
