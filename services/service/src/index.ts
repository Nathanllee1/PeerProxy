import { WebSocket, WebSocketServer } from 'ws';
import express from "express"
import expressWS from "express-ws"

const baseApp = express()

const {app} = expressWS(baseApp)

const servers: Record<string, WebSocket> = {}
const clients: Record<string, WebSocket> = {}

function generateRandomCode() {
    
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const codeLength = 5;
    let randomCode = '';

    for (var i = 0; i < codeLength; i++) {
        var randomIndex = Math.floor(Math.random() * characters.length);
        randomCode += characters[randomIndex];
    }

    return randomCode;
}


const handleServer = (ws: WebSocket) => {
    const id = "foo" // generateRandomCode()

    servers[id] = ws

    ws.on('error', console.error);

    ws.on('message', function message(data) {
        const serverData = JSON.parse(data.toString())

        clients[serverData["clientId"]].send(JSON.stringify(serverData))
    });

    ws.send(JSON.stringify({mtype: "idAssgn", id}))
}

const handleClient = (ws: WebSocket) => {
    const id = generateRandomCode()
    ws.send(JSON.stringify({mtype: "idAssgn", id}))

    clients[id] = ws;

    ws.on('message', function message(data) {
        const clientData = JSON.parse(data.toString())

        const receiver = clientData["id"]

        if (! (receiver in servers)) {
            console.error(`Id ${receiver} not registered`)
            ws.send(JSON.stringify({mtype: "Error", msg: `Id ${receiver} not registered`}))
            return
        }

        servers[receiver].send(data)

    });
}

app.get("/", function (req, res) {
    res.send("Hello World")
})

app.ws("/", function (ws, req) {
    if (!req.url) {
        return
    }

    // console.error(req.query, req)

    const location = req.url

    switch(req.query["role"]) {
        case "server":
            handleServer(ws)
            break

        case "client":
            handleClient(ws)
            break

        default:
            console.error("Unknown route", req.query)
    }


    
}); 

app.listen(8080)