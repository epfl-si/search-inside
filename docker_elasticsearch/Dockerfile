FROM docker.elastic.co/elasticsearch/elasticsearch:8.2.0 as build-stage
RUN /usr/share/elasticsearch/bin/elasticsearch-plugin install --batch ingest-attachment

ARG ELASTIC_HOST=http://localhost:9200
ARG WP_VERITAS_HOST=wp-veritas.epfl.ch
ARG INSIDE_HOST=httpd-inside.wwp.svc:9200
ARG INSIDE_HOST_HEADER_HOST=inside.epfl.ch
ARG BUILD_ENV=OpenShift

ENV ELASTIC_HOST=$ELASTIC_HOST
ENV WP_VERITAS_HOST=$WP_VERITAS_HOST
ENV INSIDE_HOST=$INSIDE_HOST
ENV INSIDE_HOST_HEADER_HOST=$INSIDE_HOST_HEADER_HOST
ENV BUILD_ENV=$BUILD_ENV

USER root

RUN \
  apt-get update && \
  apt-get install -yqq --no-install-recommends \
    apt-utils \
    gnupg2 \
    wget && \
  rm -rf /var/lib/apt/lists/*

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install Node.js 16
RUN \
  wget -qO- https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add - && \
  echo "deb https://deb.nodesource.com/node_16.x focal main" > /etc/apt/sources.list.d/nodesource.list && \
  apt-get update && \
  apt-get install -yqq --no-install-recommends \
    nodejs=16.* && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json /app
COPY package-lock.json ./
RUN npm install
COPY create_index.js /app
COPY bootstrap-index-build.sh ./

USER elasticsearch
RUN ./bootstrap-index-build.sh


FROM docker.elastic.co/elasticsearch/elasticsearch:8.2.0

RUN /usr/share/elasticsearch/bin/elasticsearch-plugin install --batch ingest-attachment

COPY --from=build-stage /usr/share/elasticsearch/data/ /usr/share/elasticsearch/data/
