---
name: add-grpc-method
description: Add or change a gRPC RPC in the primary gRPC adapter — proto definition, handler, error mapping, and a client-based test.
---

# Add a gRPC method

1. Edit or add a proto under `proto/codzee/v1/<context>.proto` (package `codzee.v1`). Never renumber or reuse field numbers; breaking changes go in `proto/codzee/v2/`.
2. If it's a new file, add it to `PROTO_FILES` in `src/adapters/primary/grpc/proto.ts`. Protos are loaded at runtime (no codegen), and `snake_case` fields arrive as `camelCase`.
3. Implement the handler in `src/adapters/primary/grpc/handlers/v1/<context>.handler.ts` using `unary(log, async (call) => …)`. Validate `call.request` with zod via `parse()`, which throws `ValidationError` → `INVALID_ARGUMENT`.
4. Authenticated RPCs read `authorization: Bearer <token>` metadata via `bearerFromMetadata` and call `auth.authenticate`.
5. Call only the primary port, the same one the HTTP route uses. Behaviour must match HTTP.
6. Register the service in `src/adapters/primary/grpc/server.ts` with `server.addService`.
7. Test in `test/grpc/`: `buildGrpcServer(...).listen('127.0.0.1', 0)` plus a client from `loadProtos()`. Assert the status codes (`ALREADY_EXISTS`, `UNAUTHENTICATED`, …).
