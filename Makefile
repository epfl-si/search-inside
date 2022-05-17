# (c) ECOLE POLYTECHNIQUE FEDERALE DE LAUSANNE, Switzerland, 2022.

SHELL := /bin/bash

.PHONY: help
help:
	@echo "Main:"
	@echo "  make help                  — Display this help"
	@echo "Utilities:"
	@echo "  make build                 — Build"
	@echo "  make build-force           — Force build"
	@echo "  make up                    — Run"

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
up: init-elastic-data-dir
	@docker-compose up
