import express from "express"
import multer from 'multer';
import compression from "compression"
import { Readable } from 'stream';



// add dotenv
import dotenv from "dotenv"
dotenv.config();

const app = express()
const port = process.env.PORT || 3000;

import cookieParser from "cookie-parser"

app.use(express.static("public"))
app.use(express.text());
app.use(cookieParser())

app.use(compression())

app.post("/foobar", (req, res) => {
  console.log(req.headers)
  console.log(req.body)
  res.json({ "foo": "bar!" })
})


const upload = multer({ dest: 'uploads/' });

const storage = multer.memoryStorage();
const memUpload = multer({ storage: storage });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');8
  }

  console.log('Uploaded file:', req.file);
  res.send('File uploaded successfully.');
});

app.post('/reflect', memUpload.single('file'), (req, res) => {
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

app.post('/latency', (req, res) => {

  // gets the timestamp in the body and returns it
  res.send(req.body)

})

app.get('/cookies', (req, res) => {
  // get cookies and assign test cookies
  const cookies = req.cookies

  console.log(cookies)

  res.cookie('test', 'test', {
    path: "/"
  })

  res.cookie('test2', 'test2', {
    path: "/"
  })

  res.end()

})


app.get('/stream', (req, res) => {
  res.set({
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked'
  });

  const packetSize = 1024; // 1 KB

  const readable = new Readable({
      read(size) {
          const data = Buffer.alloc(packetSize);
          this.push(data);
      }
  });

  // Pipe the readable stream to the response
  readable.pipe(res);

  // Handle client disconnect
  req.on('close', () => {
      readable.destroy();
  });
});

app.get('/buffer', (req, res) => {

  if (!req.query.size || typeof req.query.size !== 'string') {
    return res.status(400).send('Missing size parameter');
  }

  const size = parseInt(req.query.size, 10);

  console.log(size)

  if (isNaN(size) || size < 0) {
      return res.status(400).send('Invalid size parameter');
  }

  const buffer = Buffer.alloc(size, 'a'); // Creates a buffer filled with 'a'

  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Length', size.toString());
  res.send(buffer);
});


app.post('/submit', (req, res) => {

  // Get id query param
  const id = req.query.id;

  console.log("Processing", id)

  // Initialize a variable to keep track of the total size
  let totalSize = 0;

  req.on('data', (chunk) => {
    // Accumulate the size of each chunk
    totalSize += chunk.length;
  });

  req.on('end', () => {
    // Log the total size of the data received
    console.log(`Received ${totalSize} bytes for id ${id}`);
    // Send a response after fully consuming the request
    res.sendStatus(200);
  });
});


app.get("/streaming", (req, res) => {
  const total = 1024 * 1024
  let i = 0

  setInterval(() => {
    res.write("hello")
    i++
    if (i === total) {
      res.end()
    }
  }, 1000)
})

app.get("/redirect", (req, res) => {
  res.send("redirecting")
  res.redirect("/redirected") 
})

app.get("/redirected", (req, res) => {
  res.send("redirected")
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})