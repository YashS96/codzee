.PHONY: install infra-up infra-down migrate dev test check build docker-up docker-down

install:      ## Install deps and git hooks
	npm ci
infra-up:     ## Start Postgres + Redis
	docker compose up -d postgres redis
infra-down:
	docker compose down
migrate:      ## Apply SQL migrations
	npm run migrate
dev: infra-up migrate ## Run API with hot reload
	npm run dev
test:
	npm test
check:        ## Everything CI runs
	npm run check
build:
	npm run build
docker-up:    ## Full stack in containers
	docker compose up --build
docker-down:
	docker compose down -v
help:
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'
