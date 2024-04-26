import { WebSocket, WebSocketServer } from 'ws';
import express from "express"
import expressWS from "express-ws"

const baseApp = express()

const { app } = expressWS(baseApp)

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


const handleServer = (ws: WebSocket, preferredId: string | undefined) => {
    const id = preferredId ?? generateRandomCode()

    servers[id] = ws

    ws.on('error', console.error);

    ws.on('close', () => {
        console.log("Closed")
    })

    ws.on('message', function message(data) {
        const serverData = JSON.parse(data.toString())

        if (!clients[serverData["clientId"]]) {
            
            console.error(serverData["clientId"], "not found")
            return
        }

        clients[serverData["clientId"]].send(JSON.stringify(serverData))
    });

    ws.send(JSON.stringify({ mtype: "idAssgn", id }))

    console.log("Assigning", id)

    // Send heartbeat
    setInterval(() => {

        ws.send(JSON.stringify({ mtype: "heartbeat" }))

    }, 5000)
}

const handleClient = (ws: WebSocket) => {
    const id = generateRandomCode()
    ws.send(JSON.stringify({ mtype: "idAssgn", id }))

    clients[id] = ws;

    ws.on('message', function message(data) {
        const clientData = JSON.parse(data.toString())

        if (clientData["mtype"] === "idReq") {
            const id = generateRandomCode()
            ws.send(JSON.stringify({ mtype: "idAssgn", id }))
            clients[id] = ws
            return
        }

        const receiver = clientData["id"]

        if (!(receiver in servers)) {
            console.error(`Id ${receiver} not registered`)
            ws.send(JSON.stringify({ mtype: "Error", msg: `Id ${receiver} not registered` }))
            return
        }

        console.log(data)

        servers[receiver].send(data)

    });

    // Send heartbeat
    setInterval(() => {

        ws.send(JSON.stringify({ mtype: "heartbeat" }))

    }, 5000)
}

app.get("/", function (req, res) {
    console.log("Root directory hit")
    res.send("Hello World")
})

app.ws("/", function (ws, req) {
    console.log("Handling ws")
    if (!req.url) {
        return
    }

    // console.error(req.query, req)

    const location = req.url

    switch (req.query["role"]) {
        case "server":
            handleServer(ws, req.query["id"] as string)
            break

        case "client":
            handleClient(ws)
            break

        default:
            console.error("Unknown route", req.query)
    }
});


app.ws("/signaling2", function (ws, req) {
    
})



app.listen(3000, "", () => {
    console.log("Listening")
})