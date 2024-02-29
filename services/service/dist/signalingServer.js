"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_ws_1 = __importDefault(require("express-ws"));
const baseApp = (0, express_1.default)();
const { app } = (0, express_ws_1.default)(baseApp);
const servers = {};
const clients = {};
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
const handleServer = (ws) => {
    const id = "foo"; // generateRandomCode()
    servers[id] = ws;
    ws.on('error', console.error);
    ws.on('close', () => {
        console.log("Closed");
    });
    ws.on('message', function message(data) {
        const serverData = JSON.parse(data.toString());
        clients[serverData["clientId"]].send(JSON.stringify(serverData));
    });
    ws.send(JSON.stringify({ mtype: "idAssgn", id }));
    console.log("Assigning", id);
    // Send heartbeat
    setInterval(() => {
        ws.send(JSON.stringify({ mtype: "heartbeat" }));
    }, 5000);
};
const handleClient = (ws) => {
    const id = generateRandomCode();
    ws.send(JSON.stringify({ mtype: "idAssgn", id }));
    clients[id] = ws;
    ws.on('message', function message(data) {
        const clientData = JSON.parse(data.toString());
        const receiver = clientData["id"];
        if (!(receiver in servers)) {
            console.error(`Id ${receiver} not registered`);
            ws.send(JSON.stringify({ mtype: "Error", msg: `Id ${receiver} not registered` }));
            return;
        }
        console.log(data);
        servers[receiver].send(data);
    });
    // Send heartbeat
    setInterval(() => {
        ws.send(JSON.stringify({ mtype: "heartbeat" }));
    }, 5000);
};
app.get("/", function (req, res) {
    res.send("Hello World");
});
app.ws("/", function (ws, req) {
    if (!req.url) {
        return;
    }
    // console.error(req.query, req)
    const location = req.url;
    switch (req.query["role"]) {
        case "server":
            handleServer(ws);
            break;
        case "client":
            handleClient(ws);
            break;
        default:
            console.error("Unknown route", req.query);
    }
});
app.listen(8080, "", () => {
    console.log("Listening");
});
