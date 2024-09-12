"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var multer_1 = require("multer");
var compression_1 = require("compression");
var app = (0, express_1.default)();
var port = 3000;
var cookie_parser_1 = require("cookie-parser");
app.use(express_1.default.static("public"));
app.use(express_1.default.text());
app.use((0, cookie_parser_1.default)());
app.use((0, compression_1.default)());
app.post("/foobar", function (req, res) {
    console.log(req.headers);
    console.log(req.body);
    res.json({ "foo": "bar!" });
});
var upload = (0, multer_1.default)({ dest: 'uploads/' });
var storage = multer_1.default.memoryStorage();
var memUpload = (0, multer_1.default)({ storage: storage });
app.post('/upload', upload.single('file'), function (req, res) {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
        8;
    }
    console.log('Uploaded file:', req.file);
    res.send('File uploaded successfully.');
});
app.post('/reflect', memUpload.single('file'), function (req, res) {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    // Log the file metadata for debugging
    console.log('Received file:', req.file);
    // Set the correct content type for the response
    res.type('jpeg');
    // Send the file buffer back in the response
    res.send(req.file.buffer);
});
app.post('/latency', function (req, res) {
    // gets the timestamp in the body and returns it
    res.send(req.body);
});
app.get('/cookies', function (req, res) {
    // get cookies and assign test cookies
    var cookies = req.cookies;
    console.log(cookies);
    res.cookie('test', 'test', {
        path: "/"
    });
    res.cookie('test2', 'test2', {
        path: "/"
    });
    res.end();
});
app.get('/buffer', function (req, res) {
    if (!req.query.size || typeof req.query.size !== 'string') {
        return res.status(400).send('Missing size parameter');
    }
    var size = parseInt(req.query.size, 10);
    console.log(size);
    if (isNaN(size) || size < 0) {
        return res.status(400).send('Invalid size parameter');
    }
    var buffer = Buffer.alloc(size, 'a'); // Creates a buffer filled with 'a'
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Length', size.toString());
    res.send(buffer);
});
app.get("/streaming", function (req, res) {
    var total = 1024 * 1024;
    var i = 0;
    setInterval(function () {
        res.write("hello");
        i++;
        if (i === total) {
            res.end();
        }
    }, 1000);
});
app.get("/redirect", function (req, res) {
    res.send("redirecting");
    res.redirect("/redirected");
});
app.get("/redirected", function (req, res) {
    res.send("redirected");
});
app.listen(port, function () {
    console.log("Example app listening on port ".concat(port));
});
