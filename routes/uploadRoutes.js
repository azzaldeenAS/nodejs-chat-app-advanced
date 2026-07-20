const express = require('express');
const multer = require('multer');
const path = require('path');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي ملف.' });
  const imageUrl = '/uploads/' + req.file.filename;
  res.json({ imageUrl });
});

module.exports = router;
