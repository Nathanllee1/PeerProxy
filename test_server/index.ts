import express from "express"
import multer from 'multer';
import compression from "compression"

const app = express()
const port = 3000

app.use(express.static("public"))
app.use(express.text());

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


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})