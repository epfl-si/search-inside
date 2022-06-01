FROM docker-registry.default.svc:5000/wwp-test/node:16-alpine

WORKDIR /app

COPY package*.json ./

RUN \
  npm ci && \
  npm cache clean --force

COPY serverapi.js /app

CMD [ "node", "/app/serverapi.js" ]
