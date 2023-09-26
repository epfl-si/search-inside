FROM docker.elastic.co/elasticsearch/elasticsearch:8.3.1 as build-stage

RUN /usr/share/elasticsearch/bin/elasticsearch-plugin install --batch ingest-attachment

ARG SEARCH_INSIDE_ELASTIC_PASSWORD=elastic
ARG SEARCH_INSIDE_API_RO_USERNAME
ARG SEARCH_INSIDE_API_RO_PASSWORD
ARG SEARCH_INSIDE_KIBANA_PASSWORD
ARG ELASTIC_HOST=http://localhost:9200
ARG WP_VERITAS_HOST=wp-veritas.epfl.ch
ARG INSIDE_HOST=httpd-inside.wwp.svc:8443
ARG INSIDE_HOST_HEADER_HOST=inside.epfl.ch
ARG INSIDE_SITES_TO_INDEX

ENV SEARCH_INSIDE_ELASTIC_PASSWORD=$SEARCH_INSIDE_ELASTIC_PASSWORD
ENV SEARCH_INSIDE_API_RO_USERNAME=$SEARCH_INSIDE_API_RO_USERNAME
ENV SEARCH_INSIDE_API_RO_PASSWORD=$SEARCH_INSIDE_API_RO_PASSWORD
ENV SEARCH_INSIDE_KIBANA_PASSWORD=$SEARCH_INSIDE_KIBANA_PASSWORD
ENV ELASTIC_HOST=$ELASTIC_HOST
ENV WP_VERITAS_HOST=$WP_VERITAS_HOST
ENV INSIDE_HOST=$INSIDE_HOST
ENV INSIDE_HOST_HEADER_HOST=$INSIDE_HOST_HEADER_HOST
ARG INSIDE_SITES_TO_INDEX=$INSIDE_SITES_TO_INDEX

USER root

RUN \
  apt-get update && \
  apt-get install -yqq --no-install-recommends \
    apt-utils \
    gnupg2 \
    curl && \
  rm -rf /var/lib/apt/lists/*

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install Node.js 20
RUN \
  mkdir -p /etc/apt/keyrings && \
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | \
    gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | \
    tee /etc/apt/sources.list.d/nodesource.list && \
  apt-get update && \
  apt-get install -yqq --no-install-recommends \
    nodejs=20.* && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY build_index.js ./
COPY bootstrap-index-build.sh ./

USER elasticsearch
RUN ./bootstrap-index-build.sh


FROM docker.elastic.co/elasticsearch/elasticsearch:8.3.1

RUN /usr/share/elasticsearch/bin/elasticsearch-plugin install --batch ingest-attachment

COPY --from=build-stage /usr/share/elasticsearch/data/ /usr/share/elasticsearch/data/

USER root

RUN \
  chmod -R 777 /usr/share/elasticsearch/data && \
  chown -R elasticsearch:elasticsearch /usr/share/elasticsearch/data

USER elasticsearch
