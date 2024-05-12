import express from 'express';
import { readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { Server, Socket } from "socket.io"
import Redis from "ioredis"
import dontenv from "dotenv"
import { createAdapter } from "@socket.io/redis-adapter";
import { generateRandomCode } from './util';

dontenv.config();

const app = express();
const server = createServer(app);

console.log(process.env.REDIS_URL);

const pubClient = new Redis(process.env.REDIS_URL!);
const subClient = pubClient.duplicate();

const io = new Server(server, {
  adapter: createAdapter(pubClient, subClient)
});

function roomExists(roomId: string) {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room !== undefined;
}

const handleServer = (socket: Socket, id: string) => {
  socket.join(id);

  socket.on('message', (data) => {
    const serverData = JSON.parse(data.toString());

    if (!roomExists(serverData["clientId"])) {
      console.error(serverData["clientId"], "not found");
      return;
    }

    socket.to(serverData["clientId"]).emit(JSON.stringify(serverData));

  });

  socket.send(JSON.stringify({ mtype: "idAssgn", id }));
  console.log("Assigning", id);

  socket.on('disconnect', () => {
    console.log(id, "closed");
  });
}

const handleClient = (socket: Socket, id: string) => {

};

io.on('connection', (socket) => {

  const role = socket.handshake.query.role;
  let id = socket.handshake.query.id as string;

  if (!id) {
    id = generateRandomCode();
  }

  switch (role) {

    case "server":
      handleServer(socket, id);
      break;

    case "client":
      handleClient(socket, id);
      break;

  }

})

app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');
});

server.listen(4141, () => {
  console.log('server running at http://localhost:4141');
});
