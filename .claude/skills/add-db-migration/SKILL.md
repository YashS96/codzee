---
name: add-db-migration
description: Create a forward-only Postgres migration and the matching repository changes. Use whenever the schema changes.
---

# Add a DB migration

1. Create `migrations/NNNN_<snake_description>.sql` with the next 4-digit number. Files are applied in lexical order, each in its own transaction, under an advisory lock (`src/adapters/secondary/postgres/migrate.ts`).
2. Forward-only. Never edit a migration that has been merged — add a new one.
3. Encode invariants as constraints: `UNIQUE (show_id, seat_id)` for bookings, `CHECK` for enums/state, FKs with explicit `ON DELETE`.
4. Live-table safety: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction — put it in its own migration and note it. Add columns as nullable or with a constant default.
5. Map rows ↔ domain only inside the repository adapter (`toDomain` pattern in `src/adapters/repositories/postgres/pg-user-repository.ts`); translate `23505` (unique violation) into `ConflictError`.
6. Apply locally: `make infra-up && npm run migrate`.
