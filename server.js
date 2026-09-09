require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

const app = express();

// Set up EJS view engine
app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB (Targets your remote EC2 server)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB on EC2'))
  .catch(err => console.error('MongoDB connection error:', err));

// Note Schema
const noteSchema = new mongoose.Schema({
  title: String,
  content: String,
  fileUrl: String,
  fileType: String,
  createdAt: { type: Date, default: Date.now }
});
const Note = mongoose.model('Note', noteSchema);

// Configure AWS S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// Configure Multer-S3 for file uploads
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      cb(null, Date.now().toString() + '-' + file.originalname);
    }
  })
});

// ROUTE 1: Render homepage with list of notes fetched from EC2 Mongo database
app.get('/', async (req, res) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 }); // Get newest notes first
    res.render('index', { notes });
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

// ROUTE 2: Process note submission and handle file streaming to AWS S3
app.post('/notes', upload.single('file'), async (req, res) => {
  try {
    const { title, content } = req.body;
    const fileUrl = req.file ? req.file.location : null;
    const fileType = req.file ? req.file.mimetype : null;

    const newNote = new Note({ title, content, fileUrl, fileType });
    await newNote.save();

    // Redirect back to main page to reload view with updated note list
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Form submission error: ' + err.message);
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
