FROM docker-registry.default.svc:5000/wwp-test/node:16-alpine

ARG WEB2018_URL=https://web2018.epfl.ch/6.1.1/

WORKDIR /app

COPY package*.json ./

RUN \
  mkdir -p /app/views && \
  wget -q -O /app/views/404.ejs ${WEB2018_URL}/errors/404-en.html && \
  npm ci && \
  npm cache clean --force

COPY serverapi.js /app

CMD [ "node", "/app/serverapi.js" ]
