#!/bin/sh

set -e -x

# Run Elastic
ES_JAVA_OPTS="-Xms2g -Xmx2g" \
  elasticsearch -E xpack.security.enabled=false -E discovery.type=single-node \
                -E xpack.security.http.ssl.enabled=false &

# Wait for Elastic
while ! curl http://localhost:9200/_cat/health?h=st; do sleep 5; done

# Build index
node /app/build_index.js

# Check index
curl http://localhost:9200/_cat/indices
