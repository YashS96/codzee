# Rule: Async & Concurrency Review

**Applies to:** `src/**/*.ts`, `test/**/*.ts`

This is a Node.js service running as multiple replicas, sharing Postgres and Redis. Review every async path for correctness under concurrency and failure.

## Check

1. **Floating promises** — every promise is `await`ed, returned, or explicitly handled with `void p.catch(...)`. Flag fire-and-forget calls (e.g. `sessions.revoke(token)` without `await`) and `forEach(async ...)`.
2. **Sequential vs parallel** — independent awaits inside a loop should use `Promise.all` or `Promise.allSettled`. Dependent steps must stay sequential. Flag `Promise.all` where one rejection leaves the others half-applied with no compensation.
3. **Check-then-act races** — reading state and then writing based on it (`if (!exists) insert`, `GET` then `SET`) is a race across replicas. Require an atomic operation instead: a DB unique constraint, `INSERT … ON CONFLICT`, `SELECT … FOR UPDATE`, a version column, Redis `SET NX PX`, or a Lua script.
4. **Transactions** — multi-statement writes that must succeed together use one DB transaction on one client (`pool.connect()` → `BEGIN`/`COMMIT`/`ROLLBACK` → `release()` in `finally`). Flag transactions spread across `pool.query` calls, which may run on different connections.
5. **Distributed locks** — Redis locks must have a TTL, a unique owner token, and be released or extended only by the owner (compare-and-delete in Lua). Flag a plain `DEL`, a lock with no expiry, or work that can outlive the lock TTL without a fencing check.
6. **Cross-resource consistency** — a write to Postgres plus a write to Redis or an event publish is not atomic. Flag missing compensation, a missing outbox, or a missing idempotent retry when the second step can fail.
7. **Idempotency** — retryable mutations (booking, payment, webhooks) must be idempotent. The idempotency key is reserved atomically _before_ side effects, not after.
8. **Timeouts and cancellation** — every network call (DB, Redis, HTTP, gRPC) has a bounded timeout. Flag `await` on external I/O with no timeout path, and `setTimeout`/`setInterval` that is never cleared or `unref()`ed.
9. **Error propagation** — no swallowed errors (`catch {}`) on paths that change state. `unhandledRejection` must never be the intended handler.
10. **Graceful shutdown** — new servers, workers, intervals or connections must be stopped in `bootstrap` `dispose()` or the `main.ts` shutdown path.
11. **Tests for races** — concurrency-sensitive code needs a test that fires N parallel attempts (`Promise.allSettled`) and asserts exactly-once results. Flag "concurrency" tests that actually run sequentially.

## Severity

- **Blocker:** a race that can double-book or double-charge; a lock released by a non-owner; a non-atomic idempotency check.
- **Major:** floating promise on a state change; missing transaction; missing timeout on external I/O; unreleased client.
- **Minor:** sequential awaits that could be parallel; missing `unref()`.

Describe each finding as a concrete interleaving: "Replica A reads seat free → Replica B reads seat free → both insert → seat double-booked".
