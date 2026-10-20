---
name: add-http-endpoint
description: Add a Fastify route in the primary HTTP adapter with zod validation, auth guard, rate limiting, and an inject-based test.
---

# Add an HTTP endpoint

1. Create or extend `src/adapters/primary/http/routes/v1/<context>.routes.ts`, exporting a factory `(useCases, guard, opts) => async (app) => {...}` like `auth.routes.ts`.
2. Validate input with a `zod` schema and `.parse(req.body)` — the error handler turns `ZodError` into a 400 `VALIDATION_FAILED`.
3. Protect routes: `{ preHandler: guard.authenticate }`, and `[guard.authenticate, guard.requireRole('admin')]` for admin endpoints. Read the caller with `principalOf(req)`.
4. Call only the primary port (`src/ports/primary`). No repositories, SQL, or Redis in handlers.
5. Mutating endpoints that clients may retry (bookings, payments) must accept an `Idempotency-Key` header.
6. Register the route plugin in `src/adapters/primary/http/routes/v1/index.ts` (served under `/v1/<context>`). Breaking changes go in a new `routes/v2/` folder.
7. Add a test in `test/http/` using `app.inject()` covering: happy path, 400, 401/403, and domain-error mapping (404/409).
