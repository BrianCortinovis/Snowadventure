const express = require('express');
const router = express.Router();
const { getDb } = require('../../db');

// GET /api/gallery
router.get('/', (req, res) => {
  const db = getDb();
  const images = db.prepare('SELECT id, filename, alt_text, sort_order FROM gallery_images WHERE is_visible = 1 ORDER BY sort_order ASC, created_at DESC').all();
  res.json(images);
});

module.exports = router;
