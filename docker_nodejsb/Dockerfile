FROM docker-registry.default.svc:5000/wwp-test/node:16-alpine
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm install && \
    npm install -g nodemon@^2.0.16
COPY push_to_elasticsearch.js /app
CMD ["node", "/app/push_to_elasticsearch.js"]
