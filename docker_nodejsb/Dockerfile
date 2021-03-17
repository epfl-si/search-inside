FROM node:12-alpine
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm install
COPY ../push_to_elasticsearch.js /app
CMD ["node", "/app/push_to_elasticsearch.js"]