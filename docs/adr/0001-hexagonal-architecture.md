# ADR 0001 — Hexagonal architecture

- **Status:** Accepted
- **Date:** 2026-10-20

## Context

The booking system has hard correctness requirements (no double booking under concurrency) and several infrastructure dependencies (Postgres, Redis, payment provider, possibly a message bus) that will change or be swapped in tests.

## Decision

Use ports & adapters. The `domain` and `services` layers are pure TypeScript and depend only on interfaces in `ports/` (`primary`, `secondary`, `repositories`). Infrastructure lives in `adapters/` (`primary` for HTTP/gRPC, `secondary` for Redis/JWT/etc., `repositories` for Postgres) and is wired in a single composition root (`bootstrap/container.ts`). ESLint `no-restricted-imports` enforces the dependency direction.

## Consequences

- Use cases are unit-testable with in-memory fakes — fast, deterministic, no Docker.
- Swapping Redis locks for Postgres advisory locks (or adding Kafka) touches only adapters + wiring.
- More files and indirection than a layered Express app; mitigated by the skills in `.claude/skills/`.
