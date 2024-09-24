import express from "express"
import multer from 'multer';
import compression from "compression"

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
  req.on('data', () => {
    // Intentionally empty: discard data chunks
  });

  req.on('end', () => {
    // Send a response after fully consuming the request
    res.sendStatus(200); // You can change the status code or message as needed
  });
})

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