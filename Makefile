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
	@echo "  make up                    — Run"

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

init-elastic-data-dir:
	@mkdir -p .elastic_data
	@chmod 777 .elastic_data

set-dockerfile-dev:
	@cp docker_nodejsb/Dockerfile docker_nodejsb/Dockerfile-dev
	@sed -i 's#docker-registry.default.svc:5000/wwp-test/##g' docker_nodejsb/Dockerfile-dev
	@cp docker_nodejsf/Dockerfile docker_nodejsf/Dockerfile-dev
	@sed -i 's#docker-registry.default.svc:5000/wwp-test/##g' docker_nodejsf/Dockerfile-dev

.PHONY: build
build: set-dockerfile-dev
	@docker-compose build

.PHONY: build-force
build-force: set-dockerfile-dev
	@docker-compose build --force-rm --no-cache --pull

.PHONY: up
up: check-env init-elastic-data-dir
	@docker-compose up
