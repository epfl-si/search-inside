FROM docker-registry.default.svc:5000/wwp-test/node:20-alpine

ARG WEB2018_URL=https://web2018.epfl.ch/6.1.1/

WORKDIR /app

COPY package*.json ./

RUN \
  mkdir -p /app/views && \
  wget -q -O /app/views/404.ejs ${WEB2018_URL}/errors/404-en.html && \
  npm ci && \
  npm cache clean --force

# Force HTTPS and specific redirect url
RUN \
  sed -i \
    "s/var protocol = req.protocol || \"http\";/var protocol = 'https';/" \
    node_modules/passport-tequila/lib/passport-tequila/protocol.js && \
  sed -i \
    "s/x-forwarded-host/x-tequila-redirect-path/" \
    node_modules/passport-tequila/lib/passport-tequila/protocol.js && \
  sed -i \
    "s/auth_check: auth_check/auth_check: auth_check, allowedrequesthosts: '10.180.21.0\/24'/" \
    node_modules/passport-tequila/lib/passport-tequila/protocol.js

COPY serverapi.js /app

CMD [ "node", "/app/serverapi.js" ]
