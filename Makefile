# (c) ECOLE POLYTECHNIQUE FEDERALE DE LAUSANNE, Switzerland, 2022.

SHELL := /bin/bash

TRIVY_IMAGE = aquasec/trivy
TRIVY_VERSION = 0.29.2
TRIVY_VCACHE = -v /tmp/trivy/:/root/.cache/
TRIVY_VLOCAL = -v /var/run/docker.sock:/var/run/docker.sock
TRIVY = @docker run --rm ${TRIVY_VCACHE} ${TRIVY_VLOCAL} ${TRIVY_IMAGE}:${TRIVY_VERSION}

.PHONY: help
help:
	@echo "Main:"
	@echo "  make help                  — Display this help"
	@echo "Utilities:"
	@echo "  make scan                  — Scan images for vulnerabilities"
	@echo "Local development:"
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

.PHONY: scan
scan:
	@${TRIVY} image --clear-cache
	@${TRIVY} image --severity HIGH,CRITICAL search-inside_elastic:latest
	@${TRIVY} image --severity HIGH,CRITICAL search-inside_api:latest

.PHONY: print-env
print-env: check-env
	@echo "SEARCH_INSIDE_SESSION_SECRET=${SEARCH_INSIDE_SESSION_SECRET}"
	@echo "SEARCH_INSIDE_ELASTIC_PASSWORD=${SEARCH_INSIDE_ELASTIC_PASSWORD}"
	@echo "SEARCH_INSIDE_API_RO_USERNAME=${SEARCH_INSIDE_API_RO_USERNAME}"
	@echo "SEARCH_INSIDE_API_RO_PASSWORD=${SEARCH_INSIDE_API_RO_PASSWORD}"
	@echo "SEARCH_INSIDE_KIBANA_PASSWORD=${SEARCH_INSIDE_KIBANA_PASSWORD}"
	@echo "DOCKER_BUILDKIT=${DOCKER_BUILDKIT}"

.PHONY: build
build:
	@oc login https://pub-os-exopge.epfl.ch --username ${USER} -n wwp
	@oc port-forward services/httpd-inside 8443:8443 &
	@sleep 5
	@docker compose -f docker-compose.elastic-local.yml -f docker-compose.api.yml -f docker-compose.kibana.yml build
	@pkill oc -9

.PHONY: build-force
build-force:
	@oc login https://pub-os-exopge.epfl.ch --username ${USER} -n wwp
	@oc port-forward services/httpd-inside 8443:8443 &
	@sleep 5
	@docker compose -f docker-compose.elastic-local.yml -f docker-compose.api.yml -f docker-compose.kibana.yml build --force-rm --no-cache --pull
	@pkill oc -9

.PHONY: local-up
local-up: check-env
	@docker compose -f docker-compose.elastic-local.yml -f docker-compose.api.yml -f docker-compose.kibana.yml up

.PHONY: prod-up
prod-up: check-env
	@docker login os-docker-registry.epfl.ch
	@docker compose -f docker-compose.elastic-prod.yml -f docker-compose.api.yml -f docker-compose.kibana.yml up
