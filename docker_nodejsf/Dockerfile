FROM node:12-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY serverf.js /app
COPY views/ /app/views
CMD [ "node", "/app/serverf.js" ]