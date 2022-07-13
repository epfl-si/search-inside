# (c) ECOLE POLYTECHNIQUE FEDERALE DE LAUSANNE, Switzerland, 2022.

SHELL := /bin/bash

.PHONY: help
help:
	@echo "Main:"
	@echo "  make help                  — Display this help"
	@echo "Utilities:"
	@echo "  make build                 — Build"
	@echo "  make build-force           — Force build"
	@echo "  make print-env             — Print environment variables"
	@echo "  make local-up              — Run with local Elastic image"
	@echo "  make prod-up               — Run with production Elastic image"

# To add all variable to your shell, use
# export $(xargs < /keybase/team/epfl_searchins/env);
check-env:
ifeq ($(wildcard /keybase/team/epfl_searchins/env),)
	@echo "Be sure to have access to /keybase/team/epfl_searchins/env"
	@exit 1
else
include /keybase/team/epfl_searchins/env
export
endif

.PHONY: print-env
print-env: check-env
	@echo "SEARCH_INSIDE_SESSION_SECRET=${SEARCH_INSIDE_SESSION_SECRET}"
	@echo "SEARCH_INSIDE_ELASTIC_PASSWORD=${SEARCH_INSIDE_ELASTIC_PASSWORD}"
	@echo "SEARCH_INSIDE_API_RO_USERNAME=${SEARCH_INSIDE_API_RO_USERNAME}"
	@echo "SEARCH_INSIDE_API_RO_PASSWORD=${SEARCH_INSIDE_API_RO_PASSWORD}"
	@echo "SEARCH_INSIDE_KIBANA_PASSWORD=${SEARCH_INSIDE_KIBANA_PASSWORD}"

set-dockerfile-dev:
	@cp docker_nodeapi/Dockerfile docker_nodeapi/Dockerfile-dev
	@sed -i 's#docker-registry.default.svc:5000/wwp-test/##g' docker_nodeapi/Dockerfile-dev

.PHONY: build
build: set-dockerfile-dev
	@docker-compose -f docker-compose.elastic-local.yml -f docker-compose.nodeapi.yml -f docker-compose.kibana.yml build

.PHONY: build-force
build-force: set-dockerfile-dev
	@docker-compose -f docker-compose.elastic-local.yml -f docker-compose.nodeapi.yml -f docker-compose.kibana.yml build --force-rm --no-cache --pull

.PHONY: local-up
local-up: check-env
	@docker-compose -f docker-compose.elastic-local.yml -f docker-compose.nodeapi.yml -f docker-compose.kibana.yml up

.PHONY: prod-up
prod-up: check-env
	@docker login os-docker-registry.epfl.ch
	@docker-compose -f docker-compose.elastic-prod.yml -f docker-compose.nodeapi.yml -f docker-compose.kibana.yml up
