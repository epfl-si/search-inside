#!/bin/sh

set -e -x

echo 'Fail the build for test..'
exit 1

if [ -z "${SEARCH_INSIDE_ELASTIC_PASSWORD}" ]; then
  echo "SEARCH_INSIDE_ELASTIC_PASSWORD environment variable is empty"; exit 1;
fi

[[ -f /usr/share/elasticsearch/config/elasticsearch.keystore ]] || (elasticsearch-keystore create)
if ! (elasticsearch-keystore has-passwd --silent) ; then
  # keystore is unencrypted
  if ! (elasticsearch-keystore list | grep -q '^bootstrap.password$'); then
    (echo "$SEARCH_INSIDE_ELASTIC_PASSWORD" | elasticsearch-keystore add -x 'bootstrap.password')
  fi
fi

# Run Elastic
ES_JAVA_OPTS="-Xms2g -Xmx2g" \
  elasticsearch -E xpack.security.enabled=true -E discovery.type=single-node \
                -E xpack.security.http.ssl.enabled=false \
                -d -p /tmp/pid

# Wait for Elastic
while ! curl -XGET -u elastic:$SEARCH_INSIDE_ELASTIC_PASSWORD \
  http://localhost:9200/_cluster/health?wait_for_status=yellow;
do sleep 5;
done

# Build index
node /app/build_index.js

# Stop Elastic
pkill -F /tmp/pid
while ps aux | grep "/usr/share/elasticsearch/jdk/bin/java" | grep -v grep; do sleep 5; done

exit 0
