FROM node:18-bullseye-slim

COPY . /app
WORKDIR /app/

RUN npm install
RUN npm run build

ENTRYPOINT ["node", "dist/signalingServer.js"]