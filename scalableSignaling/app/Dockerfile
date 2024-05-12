FROM node:21-slim

COPY . /app
WORKDIR /app/

RUN npm install
RUN npm run build

ENTRYPOINT ["node", "dist/server.js"]

EXPOSE 4141