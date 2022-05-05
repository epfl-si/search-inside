FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install && \
    npm install -g nodemon@^2.0.16
COPY serverf.js /app
COPY views/ /app/views
CMD [ "node", "/app/serverf.js" ]
