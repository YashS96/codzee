---
name: local-dev
description: Start, run, and verify the Codzee API locally (Postgres, Redis, migrations, health checks, auth smoke test).
---

# Local development

```bash
cp .env.example .env
make infra-up        # postgres:16 + redis:7 via docker compose
npm run migrate
npm run dev          # http://localhost:8080
```

Smoke test:

```bash
curl -s localhost:8080/v1/health/live
curl -s localhost:8080/v1/health/ready | jq
curl -s -XPOST localhost:8080/v1/auth/register -H 'content-type: application/json' \
  -d '{"email":"a@b.io","name":"A","password":"passw0rd1"}'
TOKEN=$(curl -s -XPOST localhost:8080/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"a@b.io","password":"passw0rd1"}' | jq -r .accessToken)
curl -s localhost:8080/v1/auth/me -H "authorization: Bearer $TOKEN"
```

gRPC (needs [grpcurl](https://github.com/fullstorydev/grpcurl)):

```bash
grpcurl -plaintext -import-path proto -proto grpc/health/v1/health.proto -d '{"service":""}' localhost:50051 grpc.health.v1.Health/Check
grpcurl -plaintext -import-path proto -proto codzee/v1/auth.proto -H "authorization: Bearer $TOKEN" localhost:50051 codzee.v1.AuthService/GetProfile
```

Full containerised stack: `make docker-up`. Everything CI runs: `npm run check`.
