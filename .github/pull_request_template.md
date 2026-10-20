## What

<!-- One or two sentences on the change. -->

## Why

<!-- Problem / ticket / requirement this addresses. -->

## How

<!-- Key design decisions. Call out any new ports, adapters, migrations, or config keys. -->

## Checklist

- [ ] Hexagonal boundaries respected (domain/ports/services import no adapters or infra libs)
- [ ] Tests added/updated (unit for use cases, HTTP for routes)
- [ ] Migration is forward-only and safe on a live table
- [ ] New config keys added to `config/default.yaml` and `src/config/schema.ts`
- [ ] `npm run check` passes locally
