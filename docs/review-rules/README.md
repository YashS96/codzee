# Codzee review rules

Custom review instructions for the Codzee PR review bot. Paste each file into the platform as a separate rule.

| #   | Rule                                                                 | Focus                                                                 |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | [Hexagonal architecture](01-hexagonal-architecture.md)               | dependency direction, port/adapter placement, thin handlers           |
| 2   | [Async & concurrency](02-async-concurrency.md)                       | floating promises, races, transactions, locks, idempotency, timeouts  |
| 3   | [LLD & file structure](03-lld-structure.md)                          | vertical-slice completeness, file placement, naming, HTTP/gRPC parity |
| 4   | [Booking correctness & data integrity](04-booking-data-integrity.md) | no double-selling, state machines, money, ownership, webhooks         |
