// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const session = require('express-session');
const app = express();

const uploadsDir = path.join(__dirname, 'uploads');
// Ensure the "uploads" folder exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const dbFile = path.join(__dirname, 'db.json');

// ... (rest of your server.js remains unchanged)





// Helper functions to read/write the JSON database
async function readDatabase() {
  try {
    const data = await fsPromises.readFile(dbFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // If file doesn't exist, return default structure
    return { images: [], comments: [] };
  }
}

async function writeDatabase(db) {
  await fsPromises.writeFile(dbFile, JSON.stringify(db, null, 2));
}

// Middleware to parse JSON and urlencoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up session middleware (use a strong secret in production)
app.use(session({
  secret: 'your-secret-key', // Change this for production!
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // In production, set secure true with HTTPS
}));

// Serve static files from the "public" folder
app.use(express.static('public'));

// Serve the "uploads" folder as static so images can be accessed via URL
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer storage to save files in "uploads/"
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Use timestamp + original name for uniqueness
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

/**
 * POST /upload
 * Expects:
 *   - A field "category" (e.g., "Life", "Vacations", etc.)
 *   - One or more files in field "images"
 * Saves files on disk and stores metadata (caption is empty by default).
 * Only accessible to logged-in admin.
 */
app.post('/upload', upload.array('images'), async (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const category = req.body.category;
  if (!category) {
    return res.status(400).json({ success: false, message: 'Category is required' });
  }
  const db = await readDatabase();
  const files = req.files.map(file => {
    const imageData = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      category: category,
      name: file.originalname,
      path: '/uploads/' + file.filename,
      caption: ''
    };
    db.images.push(imageData);
    return imageData;
  });
  await writeDatabase(db);
  res.json({ success: true, files });
});

/**
 * GET /images?category=...
 * Returns all images that belong to a given category.
 */
app.get('/images', async (req, res) => {
  const category = req.query.category;
  if (!category) {
    return res.status(400).json({ success: false, message: 'Category query parameter is required' });
  }
  const db = await readDatabase();
  const imagesForCategory = db.images.filter(img => img.category === category);
  res.json({ success: true, images: imagesForCategory });
});

/**
 * PUT /images/:id
 * Update image metadata (only caption is updatable).
 * Only accessible to admin.
 */
app.put('/images/:id', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const id = req.params.id;
  const { caption } = req.body;
  const db = await readDatabase();
  const image = db.images.find(img => img.id === id);
  if (!image) {
    return res.status(404).json({ success: false, message: 'Image not found' });
  }
  image.caption = caption;
  await writeDatabase(db);
  res.json({ success: true, image });
});

/**
 * DELETE /images/:id
 * Deletes the image file from disk and removes its metadata.
 * Only accessible to admin.
 */
app.delete('/images/:id', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const id = req.params.id;
  const db = await readDatabase();
  const imageIndex = db.images.findIndex(img => img.id === id);
  if (imageIndex === -1) {
    return res.status(404).json({ success: false, message: 'Image not found' });
  }
  const imageData = db.images[imageIndex];
  try {
    await fsPromises.unlink(path.join(__dirname, imageData.path));
  } catch (error) {
    console.error("Error deleting file:", error);
  }
  db.images.splice(imageIndex, 1);
  await writeDatabase(db);
  res.json({ success: true });
});

/**
 * POST /comments
 * Expects JSON body with: { category, name, comment }
 * Saves a comment.
 */
app.post('/comments', async (req, res) => {
  const { category, name, comment } = req.body;
  if (!category || !comment) {
    return res.status(400).json({ success: false, message: 'Category and comment required' });
  }
  const db = await readDatabase();
  const commentObj = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    category,
    name: name || 'Anonymous',
    comment,
    timestamp: new Date().toISOString()
  };
  db.comments.push(commentObj);
  await writeDatabase(db);
  res.json({ success: true, comment: commentObj });
});

/**
 * GET /comments?category=...
 * Returns all comments for the given category.
 */
app.get('/comments', async (req, res) => {
  const category = req.query.category;
  if (!category) {
    return res.status(400).json({ success: false, message: 'Category query parameter required' });
  }
  const db = await readDatabase();
  const comments = db.comments.filter(c => c.category === category);
  res.json({ success: true, comments });
});

/** 
 * POST /login 
 * Expects JSON body: { password }
 * If the password is correct, sets admin flag in the session.
 */
app.post('/login', (req, res) => {
  const { password } = req.body;
  // For demo, the admin password is "admin"
  if (password === 'chamak') {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Invalid password' });
  }
});

/** 
 * GET /logout 
 * Destroys the session.
 */
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

/** 
 * GET /isAdmin 
 * Returns the current admin status.
 */
app.get('/isAdmin', (req, res) => {
  res.json({ isAdmin: req.session.isAdmin || false });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server started on http://localhost:' + PORT);
});
