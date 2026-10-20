# Rule: Booking Correctness & Data Integrity Review

**Applies to:** `src/domain/**`, `src/services/**`, `src/adapters/repositories/**`, `migrations/**`

The core guarantee of this system is that **a seat for a show is sold at most once**, and every confirmed booking has exactly one successful payment.

## Check

1. **DB-level guarantees** — "one booking per seat per show" is enforced by a UNIQUE constraint or exclusion constraint in a migration, not only by application code or Redis.
2. **State machine** — seat states (`AVAILABLE → HELD → BOOKED`, `HELD → AVAILABLE`) and booking states (`PENDING_PAYMENT → CONFIRMED | FAILED | EXPIRED`) are modelled in the domain. Flag transitions from terminal states (e.g. `EXPIRED → CONFIRMED` on a late payment).
3. **Holds expire** — every hold has an expiry both in Redis (TTL) and in Postgres (`expires_at`), and an expiry path that releases seats.
4. **Money** — amounts are stored as integer minor units (`amount_cents bigint`) with a currency code. Flag `float`/`numeric` arithmetic in JS.
5. **Ownership checks** — a user can read, cancel or pay only their own holds and bookings. Admin-only operations (catalog CRUD) use `requireRole('admin')` / an equivalent gRPC check.
6. **Webhooks** — payment callbacks verify a signature, are idempotent on the provider's event id, and tolerate duplicates and out-of-order delivery.
7. **PII** — responses and logs do not expose other users' emails, payment details or password hashes. Check the pino `redact` paths when new sensitive fields are added.

## Severity

- **Blocker:** any path that can double-sell a seat, confirm without payment, or let a user act on another user's booking.
- **Major:** missing constraint backing a domain invariant; unverified webhook; float money.
