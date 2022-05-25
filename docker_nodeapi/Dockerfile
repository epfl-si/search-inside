FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN \
  npm ci && \
  npm cache clean --force

COPY serverapi.js /app

CMD [ "node", "/app/serverapi.js" ]
